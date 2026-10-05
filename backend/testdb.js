// test-db.js — быстрая проверка подключения к БД
const db = require('./db');

(async () => {
  try {
    const result = await db.query('SELECT NOW() AS now, version() AS version');
    console.log('Время на сервере:', result.rows[0].now);
    console.log('Версия PostgreSQL:', result.rows[0].version);

    const tables = await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    );
    console.log('Таблицы в БД:', tables.rows.map(r => r.tablename).join(', '));

    process.exit(0);
  } catch (err) {
    console.error('Ошибка:', err.message);
    process.exit(1);
  }
})();