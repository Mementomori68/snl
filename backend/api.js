// api.js — посты, комментарии, сообщения
const express = require('express');
const db = require('./db');
const { authMiddleware } = require('./auth');
const { sendToUser } = require('./realtime');

const router = express.Router();

// ==================== ПОСТЫ ====================

// GET /api/posts — все посты
router.get('/posts', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM posts ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('get posts error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/posts — создать пост (только админ)
router.post('/posts', authMiddleware, async (req, res) => {
  try {
    const me = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.userId]);
    if (me.rows.length === 0 || !me.rows[0].is_admin) {
      return res.status(403).json({ error: 'Только админ может создавать посты' });
    }

    const { title, text, date, image_url } = req.body;
    if (!title || !text) {
      return res.status(400).json({ error: 'Заполните заголовок и текст' });
    }

    const result = await db.query(
      'INSERT INTO posts (title, text, date, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, text, date || new Date().toISOString().slice(0, 10), image_url || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('create post error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/posts/:id — удалить пост (только админ)
router.delete('/posts/:id', authMiddleware, async (req, res) => {
  try {
    const me = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.userId]);
    if (me.rows.length === 0 || !me.rows[0].is_admin) {
      return res.status(403).json({ error: 'Только админ' });
    }

    await db.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('delete post error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ==================== КОММЕНТАРИИ ====================

// GET /api/comments/:postId
router.get('/comments/:postId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC',
      [req.params.postId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('get comments error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/comments
router.post('/comments', authMiddleware, async (req, res) => {
  try {
    const { post_id, text } = req.body;
    if (!post_id || !text) {
      return res.status(400).json({ error: 'Нет post_id или text' });
    }

    const me = await db.query('SELECT username FROM users WHERE id = $1', [req.userId]);
    if (me.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });

    const result = await db.query(
      'INSERT INTO comments (post_id, user_id, author_name, text) VALUES ($1, $2, $3, $4) RETURNING *',
      [post_id, req.userId, me.rows[0].username, text]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('create comment error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/comments/:id
router.delete('/comments/:id', authMiddleware, async (req, res) => {
  try {
    const row = await db.query('SELECT user_id FROM comments WHERE id = $1', [req.params.id]);
    if (row.rows.length === 0) return res.status(404).json({ error: 'Не найдено' });
    if (row.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Не ваш комментарий' });
    }
    await db.query('DELETE FROM comments WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('delete comment error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ==================== СООБЩЕНИЯ ====================

// GET /api/messages/:peerId — переписка
router.get('/messages/:peerId', authMiddleware, async (req, res) => {
  try {
    const peerId = req.params.peerId;
    const result = await db.query(
      `SELECT * FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [req.userId, peerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('get messages error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/messages — отправить сообщение
router.post('/messages', authMiddleware, async (req, res) => {
  try {
    const { receiver_id, text } = req.body;
    if (!receiver_id || !text) {
      return res.status(400).json({ error: 'Нет receiver_id или text' });
    }

    const result = await db.query(
      'INSERT INTO messages (sender_id, receiver_id, text) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, receiver_id, text]
    );

    const msg = result.rows[0];

    // Пушим получателю и себе (на другие вкладки/устройства)
    sendToUser(receiver_id, { type: 'message', message: msg });
    sendToUser(req.userId, { type: 'message', message: msg });

    res.json(msg);
  } catch (err) {
    console.error('send message error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/dialogs — список собеседников
router.get('/dialogs', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT
         CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS peer_id
       FROM messages
       WHERE sender_id = $1 OR receiver_id = $1`,
      [req.userId]
    );
    res.json(result.rows.map(r => r.peer_id));
  } catch (err) {
    console.error('get dialogs error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/users — поиск пользователей
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const q = req.query.q ? `%${req.query.q}%` : '%';
    const result = await db.query(
      `SELECT id, username FROM users
       WHERE id != $1 AND username ILIKE $2
       LIMIT 30`,
      [req.userId, q]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('get users error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;