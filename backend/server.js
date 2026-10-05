// server.js — точка входа приложения
require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { router: authRouter } = require('./auth');
const { initRealtime } = require('./realtime');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------
// CORS — разрешаем только нужные origin
// ------------------------------------------------------------
app.use(cors({
  origin: [
    'https://mementomori68.github.io',
    'https://boxlike.fxtun.ru',      // ← было banjo
    'http://127.0.0.1:5500',
    'http://localhost:5500'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ------------------------------------------------------------
// Rate limiting для чувствительных эндпоинтов
// ------------------------------------------------------------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10,                   // 10 попыток с одного IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток. Попробуйте позже.' }
});

// Общий мягкий лимит для всего API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 120,            // 120 запросов в минуту с одного IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Подождите немного.' }
});

// ------------------------------------------------------------
// Служебные эндпоинты
// ------------------------------------------------------------
app.get('/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/db-check', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW() AS now');
    res.json({ ok: true, db_time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------
// Роуты с лимитерами
// ВАЖНО: лимитеры должны быть ДО роутеров
// ------------------------------------------------------------
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.use('/auth', authRouter);

app.use('/api', apiLimiter, require('./api'));

// ------------------------------------------------------------
// HTTP-сервер + WebSocket
// ------------------------------------------------------------
const server = http.createServer(app);
initRealtime(server);

server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: /ws`);
});