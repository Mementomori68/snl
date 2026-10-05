// server.js — точка входа приложения
require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { router: authRouter } = require('./auth');
const { initRealtime } = require('./realtime');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

app.use('/auth', authRouter);
app.use('/api', require('./api'));

// Оборачиваем Express в HTTP-сервер
const server = http.createServer(app);
initRealtime(server);

server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
});