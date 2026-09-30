// ============================================================
// Работа с авторизацией Supabase + привязка к OneSignal
// ============================================================

let currentUser = null;
let currentProfile = null;

// ---------- Связка пользователя с OneSignal ----------
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

// ---------- Загрузка сессии при старте ----------
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

        // Привязываем к OneSignal
        await linkOneSignalUser(currentUser.id);
    }
    updateAuthUI();
}

// ---------- Регистрация ----------
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

// ---------- Вход ----------
async function login(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

// ---------- Выход ----------
async function logout() {
    try {
        if (window.OneSignalDeferred) {
            window.OneSignalDeferred.push(async function(OneSignal) {
                try {
                    await OneSignal.logout();
                } catch (e) {
                    console.warn('OneSignal logout error:', e);
                }
            });
        }
    } catch (e) {}

    await db.auth.signOut();
    currentUser = null;
    currentProfile = null;
    updateAuthUI();

    if (typeof loadAllComments === 'function') loadAllComments();
}

// ---------- Обновление интерфейса ----------
function updateAuthUI() {
    // Старый auth-box (если есть где-то)
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

    // Бейдж пользователя в правом верхнем углу (future.html)
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

    // Перезагружаем посты, чтобы показать/скрыть админ-панель
    if (typeof loadPosts === 'function') {
        const postsContainer = document.getElementById('posts-container');
        if (postsContainer) loadPosts();
    }
}

// ---------- Модальное окно ----------
function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('open');
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('open');
}

// ---------- Отправка формы входа/регистрации ----------
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

// ---------- Переключение режима ----------
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

// ---------- Подписка на изменения авторизации ----------
db.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUser = session.user;
        linkOneSignalUser(session.user.id);
    } else {
        currentUser = null;
        currentProfile = null;
    }
    updateAuthUI();
});

// ---------- Старт ----------
document.addEventListener('DOMContentLoaded', initAuth);