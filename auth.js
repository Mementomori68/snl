// ============================================================
// auth.js — Supabase auth + OneSignal + Realtime messages
// ============================================================

let currentUser = null;
let currentProfile = null;

// id пользователя, с которым сейчас открыт диалог (ставится из UI чата)
window.currentChatUserId = window.currentChatUserId || null;

// ------------------------------------------------------------
// OneSignal: привязка пользователя к external_id = auth.uid
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
// Realtime: подписка на новые сообщения пользователя
// ------------------------------------------------------------
let messagesChannel = null;

function subscribeToMessages(userId, onNewMessage) {
    if (!userId || typeof db === 'undefined') return;

    // снимаем старый канал, чтобы не плодить дубли
    if (messagesChannel) {
        db.removeChannel(messagesChannel);
        messagesChannel = null;
    }

    messagesChannel = db
        .channel('messages:' + userId + ':' + Date.now())
        // входящие
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${userId}`
            },
            (payload) => onNewMessage(payload.new)
        )
        // исходящие (для мультидевайса)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `sender_id=eq.${userId}`
            },
            (payload) => onNewMessage(payload.new)
        )
        .subscribe((status) => {
            console.log('[realtime] messages status:', status);
        });

    return messagesChannel;
}

function unsubscribeFromMessages() {
    if (messagesChannel) {
        try { db.removeChannel(messagesChannel); } catch (e) {}
        messagesChannel = null;
    }
}

// ------------------------------------------------------------
// Обработчик входящего сообщения из realtime
// ------------------------------------------------------------
function handleIncomingMessage(row) {
    if (!row || !currentUser) return;

    // защита от дублей (два .on() могут дать один и тот же ивент)
    if (document.querySelector(`[data-msg-id="${row.id}"]`)) return;

    const peerId = row.sender_id === currentUser.id ? row.receiver_id : row.sender_id;

    if (window.currentChatUserId && window.currentChatUserId === peerId) {
        if (typeof window.appendMessageToDOM === 'function') {
            window.appendMessageToDOM(row);
        }
    } else {
        if (typeof window.bumpUnread === 'function') {
            window.bumpUnread(peerId);
        } else {
            console.log('[realtime] новое сообщение от', peerId, ':', row.text);
        }
    }
}

// ------------------------------------------------------------
// Загрузка сессии при старте
// ------------------------------------------------------------
async function initAuth() {
    const { data: { session } } = await db.auth.getSession();

    if (session) {
        currentUser = session.user;

        try {
            const { data: profile } = await db
                .from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .single();
            currentProfile = profile || { username: currentUser.email.split('@')[0] };
        } catch (e) {
            currentProfile = { username: currentUser.email.split('@')[0] };
        }

        await linkOneSignalUser(currentUser.id);

        // === realtime ===
        subscribeToMessages(currentUser.id, handleIncomingMessage);
    }

    updateAuthUI();
}

// ------------------------------------------------------------
// Регистрация
// ------------------------------------------------------------
async function register(email, password, username) {
    const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { data: { username } }
    });
    if (error) throw error;

    if (data.user) {
        await db.from('profiles').insert({
            id: data.user.id,
            username: username
        });
    }
    return data;
}

// ------------------------------------------------------------
// Вход
// ------------------------------------------------------------
async function login(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

// ------------------------------------------------------------
// Выход
// ------------------------------------------------------------
async function logout() {
    // отписываемся от realtime до signOut
    unsubscribeFromMessages();

    try {
        if (window.OneSignalDeferred) {
            window.OneSignalDeferred.push(async function(OneSignal) {
                try { await OneSignal.logout(); } catch (e) {}
            });
        }
    } catch (e) {}

    await db.auth.signOut();

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
    const authBox = document.getElementById('auth-box');
    if (authBox) {
        if (currentUser) {
            const name = currentProfile?.username || currentUser.email;
            authBox.innerHTML = `
                <span class="auth-user">👤 ${escapeHtml(name)}</span>
                <button class="auth-btn" onclick="logout()">Выйти</button>
            `;
        } else {
            authBox.innerHTML = `
                <button class="auth-btn auth-btn-primary" onclick="openAuthModal()">Войти</button>
            `;
        }
    }

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
            await login(email, password);
        } else {
            await login(email, password);
        }
        closeAuthModal();
        await initAuth();
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
// Реакция на смену авторизации
// ------------------------------------------------------------
db.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUser = session.user;
        linkOneSignalUser(session.user.id);
        subscribeToMessages(session.user.id, handleIncomingMessage);
    } else {
        currentUser = null;
        currentProfile = null;
        unsubscribeFromMessages();
    }
    updateAuthUI();
});

// ------------------------------------------------------------
// Старт
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', initAuth);