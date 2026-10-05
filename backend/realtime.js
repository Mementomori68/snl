// realtime.js — WebSocket-сервер для мгновенных сообщений
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

// Карта: userId → Set<WebSocket> (у одного юзера может быть несколько вкладок)
const clients = new Map();

function initRealtime(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Токен передаём в query: ws://localhost:3000/ws?token=xxx
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    let userId;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      userId = payload.userId;
    } catch {
      ws.close(1008, 'Invalid token');
      return;
    }

    // Регистрируем клиента
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId).add(ws);
    console.log(`[ws] ${userId} подключился (всего: ${clients.get(userId).size})`);

    ws.on('close', () => {
      clients.get(userId)?.delete(ws);
      if (clients.get(userId)?.size === 0) clients.delete(userId);
      console.log(`[ws] ${userId} отключился`);
    });

    ws.on('error', (err) => console.error('[ws] error:', err.message));
  });

  console.log('🔌 WebSocket: /ws');
}

// Отправить данные конкретному пользователю
function sendToUser(userId, data) {
  const set = clients.get(userId);
  if (!set) return;
  const msg = JSON.stringify(data);
  set.forEach((ws) => {
    if (ws.readyState === 1) ws.send(msg); // 1 = OPEN
  });
}

module.exports = { initRealtime, sendToUser };