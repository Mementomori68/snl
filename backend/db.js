// db.js — подключение к PostgreSQL
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Простой лог при подключении
pool.on('connect', () => {
  console.log('✅ PostgreSQL: соединение установлено');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL ошибка:', err.message);
});

// Экспортируем объект с методом query
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};