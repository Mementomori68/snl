// api-client.js — обёртка для запросов к нашему бэкенду
// Пока локально, потом заменим на https://api.твой-домен.ru
const API_URL = 'http://localhost:3000';

// ---------- Токен и юзер ----------
function getToken() {
  return localStorage.getItem('token');
}

function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function getCurrentUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

// ---------- Основная функция запроса ----------
async function api(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(API_URL + endpoint, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Токен истёк
  if (res.status === 401) {
    clearAuth();
    // Открываем модалку входа, если она есть на странице
    if (typeof openAuthModal === 'function') openAuthModal();
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}