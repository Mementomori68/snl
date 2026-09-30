// ============================================================
// Работа с авторизацией Supabase
// ============================================================

let currentUser = null;
let currentProfile = null;

// Загрузка текущей сессии при старте страницы
async function initAuth() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        currentUser = session.user;
        // Пробуем получить профиль (имя пользователя)
        const { data: profile } = await db
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        currentProfile = profile || { username: currentUser.email.split('@')[0] };
    }
    updateAuthUI();
}

// Регистрация
async function register(email, password, username) {
    const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
            data: { username }  // сохраняем имя в метаданных
        }
    });
    if (error) throw error;

    // Создаём запись в таблице profiles
    if (data.user) {
        await db.from('profiles').insert({
            id: data.user.id,
            username: username
        });
    }
    return data;
}

// Вход
async function login(email, password) {
    const { data, error } = await db.auth.signInWithPassword({
        email,
        password
    });
    if (error) throw error;
    return data;
}

// Выход
async function logout() {
    await db.auth.signOut();
    currentUser = null;
    currentProfile = null;
    updateAuthUI();
    // Перезагружаем комментарии, чтобы убрать форму
    if (typeof loadAllComments === 'function') loadAllComments();
}

// Обновление интерфейса в зависимости от статуса входа
function updateAuthUI() {
    const authBox = document.getElementById('auth-box');
    if (!authBox) return;

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

// Открыть модальное окно входа/регистрации
function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'flex';
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
}

// Обработка формы входа/регистрации
async function handleAuthSubmit(event) {
    event.preventDefault();
    const mode = document.getElementById('auth-mode').value; // 'login' или 'register'
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const username = document.getElementById('auth-username').value.trim();
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

// Переключение между входом и регистрацией
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

// Подписка на изменения статуса авторизации
db.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUser = session.user;
    } else {
        currentUser = null;
        currentProfile = null;
    }
    updateAuthUI();
});

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', initAuth);