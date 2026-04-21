// ============================================================
// app.js — UPDATED (FORCED + CHAIN CAPTURE SUPPORT)
// ============================================================

(function () {
  'use strict';

  let socket;
  let myPlayerNumber = null;
  let roomCode = null;
  let gameState = null;
  let players = {};
  let selectedNode = null;
  let currentValidMoves = [];
  let animating = false;

  const screens = {
    lobby: document.getElementById('screen-lobby'),
    waiting: document.getElementById('screen-waiting'),
    game: document.getElementById('screen-game')
  };

  const $ = id => document.getElementById(id);

  function init() {
    socket = io();
    attachSocketListeners();
    attachUIListeners();
    Board.initBoard(onNodeClick);
  }

  function showScreen(name) {
    for (const [k, el] of Object.entries(screens)) {
      el.classList.toggle('active', k === name);
    }
  }

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

    socket.on('room_joined', ({ code, playerNumber, players: pl }) => {
      roomCode = code;
      myPlayerNumber = playerNumber;
      players = pl;
    });

    socket.on('game_start', ({ gameState: gs, players: pl }) => {
      players = pl;
      gameState = gs;
      selectedNode = null;
      currentValidMoves = [];
      initGameUI();
      showScreen('game');
      Board.renderBoard(gameState, null, []);
    });

    socket.on('valid_moves', ({ fromNode, moves }) => {
      selectedNode = fromNode;
      currentValidMoves = moves;
      Board.renderBoard(gameState, selectedNode, moves);
    });

    // 🔥 UPDATED HANDLER
    socket.on('game_state_update', ({ gameState: gs, chainActive }) => {

      gameState = gs;

      const last = gs.lastMove;

      // Animation (unchanged)
      if (last && !animating) {
        animating = true;

        Board.animateMove(
          last.from,
          last.to,
          last.isCapture ? (myPlayerNumber === 1 ? 2 : 1) : gs.currentPlayer === 1 ? 2 : 1,
          () => {
            animating = false;
            postUpdate(chainActive);
          }
        );
      } else {
        postUpdate(chainActive);
      }
    });

    function postUpdate(chainActive) {

      if (chainActive && gameState.selected) {
        // 🔥 KEEP SAME PLAYER + SAME BEAD
        selectedNode = gameState.selected;
        currentValidMoves = gameState.validMoves;

        Board.renderBoard(gameState, selectedNode, currentValidMoves);
        updateStatus("Continue capture!");
      } else {
        selectedNode = null;
        currentValidMoves = [];

        Board.renderBoard(gameState, null, []);
        updateHUD();
      }
    }

    socket.on('game_over', ({ winner, winnerName }) => {
      alert(winner === myPlayerNumber ? "You Win!" : "You Lose!");
    });
  }

  function attachUIListeners() {}

  // 🔥 UPDATED CLICK LOGIC
  function onNodeClick(nodeName) {
    if (!gameState || gameState.status !== 'playing') return;
    if (animating) return;

    const isMyTurn = gameState.currentPlayer === myPlayerNumber;

    // 🔥 CHAIN MODE LOCK
    if (gameState.selected) {
      if (nodeName === gameState.selected) return;

      const move = currentValidMoves.find(m => m.to === nodeName);
      if (move) {
        socket.emit('make_move', {
          code: roomCode,
          from: gameState.selected,
          to: nodeName
        });
      }
      return;
    }

    // Move execution
    const move = currentValidMoves.find(m => m.to === nodeName);
    if (move && selectedNode) {
      socket.emit('make_move', {
        code: roomCode,
        from: selectedNode,
        to: nodeName
      });
      return;
    }

    // Select bead
    if (isMyTurn && gameState.board[nodeName] === myPlayerNumber) {
      socket.emit('select_bead', { code: roomCode, node: nodeName });
    }
  }

  function initGameUI() {
    $('win-overlay').classList.add('hidden');
    updateHUD();
  }

  function updateHUD() {
    if (!gameState) return;
    const isMyTurn = gameState.currentPlayer === myPlayerNumber;
    updateStatus(isMyTurn ? 'Your turn' : 'Opponent turn');
  }

  function updateStatus(msg) {
    $('status-bar').textContent = msg;
  }

  function setLobbyMessage(msg) {
    $('lobby-message').textContent = msg;
  }

  document.addEventListener('DOMContentLoaded', init);

})();
```
