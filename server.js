const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const ROUND_MS = 18000;
let connectedPlayers = 0;

function createSeed() {
  return crypto.randomBytes(32).toString('hex');
}

function computeCrashPoint(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const numeric = BigInt('0x' + hash.slice(0, 16));
  const normalized = Number(numeric % 1000000n) / 1000000;
  return Number((1.1 + normalized * 8.9).toFixed(2));
}

function createRound() {
  const seed = createSeed();
  const seedHash = crypto.createHash('sha256').update(seed).digest('hex');
  const crashPoint = computeCrashPoint(seed);

  return {
    id: Date.now(),
    seed,
    seedHash,
    crashPoint,
    startedAt: Date.now(),
    endsAt: Date.now() + ROUND_MS
  };
}

let currentRound = createRound();

function broadcastRound() {
  io.emit('round:update', currentRound);
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, roundId: currentRound.id, crashPoint: currentRound.crashPoint });
});

app.get('/api/round', (_req, res) => {
  res.json(currentRound);
});

io.on('connection', (socket) => {
  connectedPlayers += 1;
  socket.emit('round:update', currentRound);
  io.emit('lobby:update', { players: connectedPlayers });

  socket.on('client:bet', ({ bet }) => {
    if (!bet || Number(bet) <= 0) return;
    socket.emit('bet:ack', { accepted: true, bet: Number(bet) });
  });

  socket.on('disconnect', () => {
    connectedPlayers = Math.max(0, connectedPlayers - 1);
    io.emit('lobby:update', { players: connectedPlayers });
  });
});

setInterval(() => {
  currentRound = createRound();
  broadcastRound();
}, ROUND_MS);

server.listen(PORT, () => {
  console.log(`Aviator server running on http://localhost:${PORT}`);
});
