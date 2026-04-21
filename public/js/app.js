// ============================================================
// app.js — Client-side game controller
// Connects to Socket.io, handles UI state, delegates to board.js
// ============================================================

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────
  let socket;
  let myPlayerNumber = null;   // 1 or 2
  let roomCode = null;
  let gameState = null;
  let players = {};
  let selectedNode = null;
  let currentValidMoves = [];  // [{to, isCapture, capturedNode}]
  let animating = false;

  // ── DOM refs ──────────────────────────────────────────────
  const screens = {
    lobby:   document.getElementById('screen-lobby'),
    waiting: document.getElementById('screen-waiting'),
    game:    document.getElementById('screen-game')
  };

  const $ = id => document.getElementById(id);

  // ── Init ──────────────────────────────────────────────────
  function init() {
    socket = io();
    attachSocketListeners();
    attachUIListeners();
    Board.initBoard(onNodeClick);
    console.log('Bead Battle client ready');
  }

  // ── Screen management ─────────────────────────────────────
  function showScreen(name) {
    for (const [k, el] of Object.entries(screens)) {
      el.classList.toggle('active', k === name);
    }
  }

  // ── Socket listeners ──────────────────────────────────────
  function attachSocketListeners() {

    socket.on('room_created', ({ code, playerNumber }) => {
      roomCode = code;
      myPlayerNumber = playerNumber;
      $('display-code').textContent = code;
      showScreen('waiting');
    });

    socket.on('join_error', ({ message }) => {
      setLobbyMessage(message, true);
    });

    socket.on('room_joined', ({ code, playerNumber, players: pl, reconnected }) => {
      roomCode = code;
      myPlayerNumber = playerNumber;
      players = pl;
      if (!reconnected) Sounds.connected();
    });

    socket.on('game_start', ({ gameState: gs, players: pl }) => {
      players = pl;
      gameState = gs;
      selectedNode = null;
      currentValidMoves = [];
      initGameUI();
      showScreen('game');
      Board.renderBoard(gameState, null, []);
      Sounds.connected();
    });

    socket.on('game_state_sync', ({ gameState: gs, players: pl }) => {
      players = pl;
      gameState = gs;
      Board.renderBoard(gameState, selectedNode, currentValidMoves);
      updateHUD();
      showScreen('game');
    });

    socket.on('valid_moves', ({ fromNode, moves }) => {
      selectedNode = fromNode;
      currentValidMoves = moves;
      Board.renderBoard(gameState, selectedNode, moves);
      updateStatus(moves.length === 0
        ? 'No moves available for that bead'
        : `${moves.length} move${moves.length > 1 ? 's' : ''} available`);
    });

    socket.on('game_state_update', ({ gameState: gs, beadCounts }) => {
      const prev = gameState;
      gameState = gs;
      selectedNode = null;
      currentValidMoves = [];

      const last = gs.lastMove;
      if (last && !animating) {
        animating = true;
        if (last.isCapture) {
          Board.animateCapture(last.capturedNode);
          Sounds.capture();
        } else {
          Sounds.move();
        }
        Board.animateMove(last.from, last.to, last.isCapture ? (myPlayerNumber === 1 ? 2 : 1) : gs.currentPlayer === 1 ? 2 : 1, () => {
          animating = false;
          Board.renderBoard(gameState, null, []);
          updateHUD();
        });
      } else {
        Board.renderBoard(gameState, null, []);
        updateHUD();
      }

      // Update turn status
      const isMyTurn = gameState.currentPlayer === myPlayerNumber;
      updateStatus(isMyTurn ? 'Your turn — select a bead' : `Waiting for opponent…`);
    });

    socket.on('game_over', ({ winner, winnerName }) => {
      setTimeout(() => {
        Board.celebrateWinner(gameState.board, winner);
        $('win-title').textContent = `${winnerName} Wins!`;
        $('win-subtitle').textContent = winner === myPlayerNumber
          ? 'Victory is yours!'
          : 'Better luck next time…';
        $('win-overlay').classList.remove('hidden');
        Sounds.win();
      }, 400);
    });

    socket.on('rematch_vote', ({ votes }) => {
      const needed = 2 - votes.length;
      $('rematch-status').textContent = needed > 0
        ? `Waiting for opponent to accept… (${votes.length}/2)`
        : 'Starting rematch…';
    });

    socket.on('player_disconnected', ({ playerNumber }) => {
      showToast('Opponent disconnected — waiting for reconnect…');
    });

    socket.on('opponent_ping', () => {
      showBoardMessage('Opponent is thinking…');
    });
  }

  // ── UI listeners ──────────────────────────────────────────
  function attachUIListeners() {
    $('btn-create').addEventListener('click', () => {
      const name = $('player-name').value.trim() || 'Player 1';
      socket.emit('create_room', { playerName: name });
    });

    $('btn-join').addEventListener('click', doJoin);

    $('room-code-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') doJoin();
    });

    $('btn-copy-code').addEventListener('click', () => {
      navigator.clipboard.writeText(roomCode).then(() => {
        $('btn-copy-code').textContent = '✓';
        setTimeout(() => $('btn-copy-code').textContent = '⎘', 1500);
      });
    });

    $('btn-rotate').addEventListener('click', () => {
      Board.flipBoard();
      Sounds.select();
      const isRotated = document.getElementById('btn-rotate').classList.toggle('rotated');
    });

    $('btn-restart').addEventListener('click', () => {
      if (confirm('Request a new game?')) {
        socket.emit('request_rematch', { code: roomCode });
      }
    });

    $('btn-rematch').addEventListener('click', () => {
      socket.emit('request_rematch', { code: roomCode });
      $('rematch-status').textContent = 'Waiting for opponent… (1/2)';
      $('btn-rematch').disabled = true;
    });

    $('btn-lobby').addEventListener('click', () => {
      location.reload();
    });

    // Enter on player name field → create room
    $('player-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') $('btn-create').click();
    });
  }

  function doJoin() {
    const code = $('room-code-input').value.trim().toUpperCase();
    if (!code || code.length !== 4) {
      setLobbyMessage('Please enter a 4-character room code', true);
      return;
    }
    const name = $('player-name').value.trim() || 'Player 2';
    socket.emit('join_room', { code, playerName: name });
  }

  // ── Node click handler (from board.js) ────────────────────
  function onNodeClick(nodeName) {
    if (!gameState || gameState.status !== 'playing') return;
    if (animating) return;

    const isMyTurn = gameState.currentPlayer === myPlayerNumber;

    // If I click a valid destination node
    const destMove = currentValidMoves.find(m => m.to === nodeName);
    if (destMove && selectedNode) {
      // Execute move
      socket.emit('make_move', { code: roomCode, from: selectedNode, to: nodeName });
      selectedNode = null;
      currentValidMoves = [];
      Board.renderBoard(gameState, null, []);
      return;
    }

    // If I click one of my own beads and it's my turn
    if (isMyTurn && gameState.board[nodeName] === myPlayerNumber) {
      Sounds.select();
      // Deselect if clicking same node
      if (selectedNode === nodeName) {
        selectedNode = null;
        currentValidMoves = [];
        Board.renderBoard(gameState, null, []);
        updateStatus('Your turn — select a bead');
        return;
      }
      socket.emit('select_bead', { code: roomCode, node: nodeName });
      return;
    }

    // Clicked somewhere invalid
    if (!isMyTurn) return;
    if (selectedNode) {
      Sounds.invalid();
      updateStatus('Invalid destination — click a highlighted node');
    }
  }

  // ── HUD updates ───────────────────────────────────────────
  function initGameUI() {
    const p1name = players[1]?.name || 'Player 1';
    const p2name = players[2]?.name || 'Player 2';
    $('name-p1').textContent = p1name;
    $('name-p2').textContent = p2name;
    $('win-overlay').classList.add('hidden');
    $('rematch-status').textContent = '';
    $('btn-rematch').disabled = false;
    updateHUD();
  }

  function updateHUD() {
    if (!gameState) return;
    const { board, currentPlayer } = gameState;

    // Bead counts
    let c1 = 0, c2 = 0;
    for (const v of Object.values(board)) {
      if (v === 1) c1++;
      else if (v === 2) c2++;
    }
    $('count-p1').textContent = c1;
    $('count-p2').textContent = c2;

    // Turn pip
    const pip = $('turn-pip');
    pip.className = 'turn-pip' + (currentPlayer === 1 ? ' p1-turn' : ' p2-turn');

    // Turn text
    $('turn-text').textContent = currentPlayer === 1
      ? (players[1]?.name || 'Player 1')
      : (players[2]?.name || 'Player 2');

    // Highlight active panel
    $('panel-p1').classList.toggle('active', currentPlayer === 1);
    $('panel-p2').classList.toggle('active', currentPlayer === 2);
    $('panel-p1').classList.toggle('your-turn', currentPlayer === myPlayerNumber && myPlayerNumber === 1);
    $('panel-p2').classList.toggle('your-turn', currentPlayer === myPlayerNumber && myPlayerNumber === 2);

    // Status bar
    const isMyTurn = currentPlayer === myPlayerNumber;
    updateStatus(isMyTurn ? 'Your turn — select a bead' : 'Opponent\'s turn…');
  }

  function updateStatus(msg) {
    $('status-bar').textContent = msg;
  }

  function setLobbyMessage(msg, isError = false) {
    const el = $('lobby-message');
    el.textContent = msg;
    el.className = 'lobby-message' + (isError ? ' error' : ' success');
  }

  function showBoardMessage(msg) {
    const el = $('board-message');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.add('hidden'), 2000);
  }

  let toastTimer;
  function showToast(msg) {
    const toast = $('toast-disconnect');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 5000);
  }

  // ── Bootstrap ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
