// ============================================================
// auth.js — авторизация через наш API + WebSocket realtime
// ============================================================

let currentUser = null;
let currentProfile = null;
let ws = null;

window.currentChatUserId = window.currentChatUserId || null;

// ------------------------------------------------------------
// OneSignal: привязка пользователя
// ------------------------------------------------------------
async function linkOneSignalUser(userId) {
  try {
    if (window.OneSignalDeferred) {
      window.OneSignalDeferred.push(async function(OneSignal) {
        try {
          await OneSignal.login(userId);
          console.log('OneSignal: привязан пользователь', userId);
        } catch (err) {
          console.warn('OneSignal login error:', err);
        }
      });
    }
  } catch (err) {
    console.warn('OneSignal link error:', err);
  }
}

// ------------------------------------------------------------
// WebSocket — realtime сообщения
// ------------------------------------------------------------
function connectWebSocket() {
  const token = getToken();
  if (!token) return;

  if (ws) {
    try { ws.close(); } catch (e) {}
    ws = null;
  }

  ws = new WebSocket('ws://localhost:3000/ws?token=' + token);

  ws.onopen = () => console.log('[ws] Подключено');
  ws.onclose = () => console.log('[ws] Отключено');
  ws.onerror = (e) => console.error('[ws] Ошибка', e);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'message' && data.message) {
        handleIncomingMessage(data.message);
      }
    } catch (err) {
      console.error('[ws] Некорректное сообщение', err);
    }
  };
}

function handleIncomingMessage(row) {
  if (!row || !currentUser) return;

  if (document.querySelector(`[data-msg-id="${row.id}"]`)) return;

  const peerId = row.sender_id === currentUser.id ? row.receiver_id : row.sender_id;

  if (window.currentChatUserId && window.currentChatUserId === peerId) {
    if (typeof window.appendMessageToDOM === 'function') {
      window.appendMessageToDOM(row);
    }
  } else {
    if (typeof window.bumpUnread === 'function') {
      window.bumpUnread(peerId);
    }
  }
}

// ------------------------------------------------------------
// Загрузка сессии при старте
// ------------------------------------------------------------
async function initAuth() {
  const token = getToken();

  if (token) {
    try {
      const data = await api('/auth/me');
      currentUser = data.user;
      currentProfile = { username: data.user.username };

      await linkOneSignalUser(currentUser.id);
      connectWebSocket();
    } catch (err) {
      // Токен невалиден — сброс
      clearAuth();
      currentUser = null;
      currentProfile = null;
    }
  }

  updateAuthUI();
}

// ------------------------------------------------------------
// Регистрация
// ------------------------------------------------------------
async function register(email, password, username) {
  const data = await api('/auth/register', {
    method: 'POST',
    body: { email, password, username }
  });
  setAuth(data.token, data.user);
  currentUser = data.user;
  currentProfile = { username: data.user.username };
  return data;
}

// ------------------------------------------------------------
// Вход
// ------------------------------------------------------------
async function login(email, password) {
  const data = await api('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  setAuth(data.token, data.user);
  currentUser = data.user;
  currentProfile = { username: data.user.username };
  return data;
}

// ------------------------------------------------------------
// Выход
// ------------------------------------------------------------
async function logout() {
  if (ws) {
    try { ws.close(); } catch (e) {}
    ws = null;
  }

  try {
    if (window.OneSignalDeferred) {
      window.OneSignalDeferred.push(async function(OneSignal) {
        try { await OneSignal.logout(); } catch (e) {}
      });
    }
  } catch (e) {}

  clearAuth();
  currentUser = null;
  currentProfile = null;
  window.currentChatUserId = null;

  updateAuthUI();

  if (typeof loadAllComments === 'function') loadAllComments();
}

// ------------------------------------------------------------
// UI авторизации
// ------------------------------------------------------------
function updateAuthUI() {
  const badge = document.getElementById('user-badge');
  const nameEl = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');

  if (badge && nameEl && avatarEl) {
    if (currentUser) {
      const name = currentProfile?.username || currentUser.email.split('@')[0];
      nameEl.textContent = name;
      avatarEl.textContent = name.charAt(0).toUpperCase();
    } else {
      nameEl.textContent = 'Войти';
      avatarEl.textContent = '?';
    }
  }

  if (typeof loadPosts === 'function') {
    const postsContainer = document.getElementById('posts-container');
    if (postsContainer) loadPosts();
  }
}

// ------------------------------------------------------------
// Модальное окно
// ------------------------------------------------------------
function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('open');
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('open');
}

// ------------------------------------------------------------
// Форма входа/регистрации
// ------------------------------------------------------------
async function handleAuthSubmit(event) {
  event.preventDefault();

  const mode = document.getElementById('auth-mode').value;
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const usernameInput = document.getElementById('auth-username');
  const username = usernameInput ? usernameInput.value.trim() : '';
  const errorEl = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit');

  errorEl.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = '...';

  try {
    if (mode === 'register') {
      if (!username) throw new Error('Введите имя');
      if (password.length < 6) throw new Error('Пароль минимум 6 символов');
      await register(email, password, username);
    } else {
      await login(email, password);
    }

    await linkOneSignalUser(currentUser.id);
    connectWebSocket();

    closeAuthModal();
    updateAuthUI();

    if (typeof loadAllComments === 'function') loadAllComments();
  } catch (err) {
    errorEl.textContent = err.message || 'Ошибка';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'register' ? 'Зарегистрироваться' : 'Войти';
  }
}

function switchAuthMode() {
  const modeInput = document.getElementById('auth-mode');
  const usernameRow = document.getElementById('auth-username-row');
  const title = document.getElementById('auth-title');
  const submitBtn = document.getElementById('auth-submit');
  const switchLink = document.getElementById('auth-switch');

  if (modeInput.value === 'login') {
    modeInput.value = 'register';
    usernameRow.style.display = 'block';
    title.textContent = 'Регистрация';
    submitBtn.textContent = 'Зарегистрироваться';
    switchLink.textContent = 'Уже есть аккаунт? Войти';
  } else {
    modeInput.value = 'login';
    usernameRow.style.display = 'none';
    title.textContent = 'Вход';
    submitBtn.textContent = 'Войти';
    switchLink.textContent = 'Нет аккаунта? Зарегистрироваться';
  }
}

// ------------------------------------------------------------
// Старт
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', initAuth);