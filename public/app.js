const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const multDisplay = document.getElementById('multiplier');
const startBtn = document.getElementById('startBtn');
const cashoutBtn = document.getElementById('cashoutBtn');
const betInput = document.getElementById('betInput');
const statusText = document.getElementById('status');
const crashInfo = document.getElementById('crashInfo');
const balanceDisplay = document.getElementById('balanceDisplay');
const playersDisplay = document.getElementById('playersDisplay');
const roundDisplay = document.getElementById('roundDisplay');
const crashDisplay = document.getElementById('crashDisplay');
const soundToggle = document.getElementById('soundToggle');

const roundsDisplay = document.getElementById('roundsDisplay');
const winsDisplay = document.getElementById('winsDisplay');
const lossesDisplay = document.getElementById('lossesDisplay');
const bestDisplay = document.getElementById('bestDisplay');
const winRateDisplay = document.getElementById('winRateDisplay');
const historyList = document.getElementById('historyList');

let balance = 1000;
let currentBet = 10;
let multiplier = 1.00;
let crashPoint = 1.00;
let animationFrameId = null;
let startTime = 0;
let planeX = 50;
let planeY = 280;
let roundActive = false;
let roundEnded = false;
let soundEnabled = true;

const stats = {
  totalRounds: 0,
  wins: 0,
  losses: 0,
  bestMultiplier: 0,
  history: []
};

function setBet(amount) {
  if (!roundActive) {
    betInput.value = amount;
    currentBet = amount;
  }
}

document.querySelectorAll('[data-bet]').forEach((button) => {
  button.addEventListener('click', () => setBet(Number(button.dataset.bet)));
});

function updateBalance() {
  balanceDisplay.textContent = `$${balance}`;
}

function updateStats() {
  roundsDisplay.textContent = stats.totalRounds;
  winsDisplay.textContent = stats.wins;
  lossesDisplay.textContent = stats.losses;
  bestDisplay.textContent = `${stats.bestMultiplier.toFixed(2)}x`;
  const winRate = stats.totalRounds > 0 ? Math.round((stats.wins / stats.totalRounds) * 100) : 0;
  winRateDisplay.textContent = `${winRate}%`;
}

function renderHistory() {
  historyList.innerHTML = '';
  stats.history.forEach((entry) => {
    const item = document.createElement('div');
    item.className = `history-item ${entry.result === 'win' ? 'win' : 'loss'}`;
    item.textContent = `${entry.multiplier.toFixed(2)}x`;
    item.title = `${entry.result === 'win' ? 'Win' : 'Loss'} • ${entry.time}`;
    historyList.appendChild(item);
  });
}

function saveHistory() {
  localStorage.setItem('aviatorGameHistory', JSON.stringify(stats.history));
}

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem('aviatorGameHistory') || '[]');
    if (Array.isArray(saved)) {
      stats.history = saved;
    }
  } catch (error) {
    stats.history = [];
  }
  renderHistory();
}

function addHistoryEntry(multiplierValue, result) {
  stats.history.unshift({
    multiplier: multiplierValue,
    result,
    time: new Date().toLocaleTimeString()
  });
  if (stats.history.length > 15) stats.history.pop();
  renderHistory();
  saveHistory();
}

function playSound(type) {
  if (!soundEnabled) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;

  const audio = new AudioCtor();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.connect(gain);
  gain.connect(audio.destination);

  if (type === 'start') {
    oscillator.type = 'sine';
    oscillator.frequency.value = 700;
    gain.gain.value = 0.05;
  } else if (type === 'cashout') {
    oscillator.type = 'triangle';
    oscillator.frequency.value = 900;
    gain.gain.value = 0.08;
  } else {
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 220;
    gain.gain.value = 0.09;
  }

  oscillator.start();
  oscillator.stop(audio.currentTime + 0.18);
}

function startRound() {
  const betVal = Number(betInput.value);
  if (!Number.isFinite(betVal) || betVal <= 0) {
    statusText.textContent = '❌ Enter a valid bet.';
    return;
  }

  if (betVal > balance) {
    statusText.textContent = '❌ Not enough balance.';
    return;
  }

  currentBet = Math.floor(betVal);
  balance -= currentBet;

  crashPoint = +(1.1 + Math.random() * 5.0).toFixed(2);
  multiplier = 1.00;
  planeX = 50;
  planeY = 280;
  startTime = performance.now();
  roundActive = true;
  roundEnded = false;

  startBtn.disabled = true;
  cashoutBtn.disabled = false;
  betInput.disabled = true;
  multDisplay.style.color = '#22c55e';
  statusText.textContent = '✈️ Flight in progress...';
  crashInfo.textContent = '';
  crashInfo.style.borderLeftColor = '#ef4444';

  socket.emit('client:bet', { bet: currentBet });
  playSound('start');
  updateBalance();
  drawGame();

  cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(animateFlight);
}

function animateFlight(timestamp) {
  if (!roundActive) return;

  const elapsed = timestamp - startTime;
  multiplier = 1 + (Math.pow(1.06, elapsed / 300) - 1) * 1.3;

  planeX = 50 + elapsed * 0.15;
  planeY = 280 - elapsed * 0.08;

  if (planeX > canvas.width - 22) planeX = canvas.width - 22;
  if (planeY < 35) planeY = 35;

  multDisplay.textContent = `${multiplier.toFixed(2)}x`;
  drawGame();

  if (multiplier >= crashPoint) {
    endRound(true);
    return;
  }

  animationFrameId = requestAnimationFrame(animateFlight);
}

function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(1, '#1e293b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(50, 280);
  ctx.lineTo(planeX, planeY);
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.save();
  ctx.translate(planeX, planeY);

  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(14, 0);
  ctx.lineTo(0, -12);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(`Crash: ${crashPoint.toFixed(2)}x`, 12, 25);

  if (roundActive) {
    ctx.fillStyle = '#22c55e';
    ctx.fillText(`Current: ${multiplier.toFixed(2)}x`, canvas.width - 190, 25);
  }
}

function endRound(crashed) {
  roundActive = false;
  roundEnded = true;
  cancelAnimationFrame(animationFrameId);

  startBtn.disabled = false;
  cashoutBtn.disabled = true;
  betInput.disabled = false;

  stats.totalRounds += 1;

  if (crashed) {
    multDisplay.textContent = `💥 CRASHED @ ${multiplier.toFixed(2)}x`;
    multDisplay.style.color = '#ef4444';
    statusText.textContent = `❌ Crashed at ${crashPoint.toFixed(2)}x. You lost $${currentBet}.`;
    crashInfo.textContent = `Crash point: ${crashPoint.toFixed(2)}x`;
    crashInfo.style.borderLeftColor = '#ef4444';
    stats.losses += 1;
    playSound('crash');
    addHistoryEntry(multiplier, 'loss');
  } else {
    const payout = Math.round(currentBet * multiplier);
    balance += payout;
    multDisplay.textContent = `🎉 CASHED OUT @ ${multiplier.toFixed(2)}x`;
    multDisplay.style.color = '#facc15';
    statusText.textContent = `✅ Cashed out at ${multiplier.toFixed(2)}x. You won $${payout}!`;
    crashInfo.textContent = `Payout: $${payout}`;
    crashInfo.style.borderLeftColor = '#22c55e';
    stats.wins += 1;
    playSound('cashout');
    addHistoryEntry(multiplier, 'win');
  }

  if (multiplier > stats.bestMultiplier) {
    stats.bestMultiplier = multiplier;
  }

  updateBalance();
  updateStats();
  drawGame();
}

cashoutBtn.addEventListener('click', () => {
  if (roundActive && !roundEnded) {
    endRound(false);
  }
});

startBtn.addEventListener('click', startRound);

soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
});

betInput.addEventListener('change', () => {
  const val = Number(betInput.value);
  if (Number.isFinite(val) && val > 0) {
    currentBet = Math.floor(val);
  }
});

socket.on('lobby:update', ({ players }) => {
  playersDisplay.textContent = players;
});

socket.on('round:update', ({ crashPoint: serverCrash, id }) => {
  crashPoint = Number(serverCrash.toFixed(2));
  roundDisplay.textContent = id;
  crashDisplay.textContent = `${crashPoint.toFixed(2)}x`;
  if (!roundActive) {
    multDisplay.textContent = '1.00x';
    multDisplay.style.color = '#22c55e';
  }
});

loadHistory();
updateBalance();
updateStats();
drawGame();
