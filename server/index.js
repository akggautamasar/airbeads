// ============================================================
// index.js — Express server + Socket.io event hub
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const {
  createRoom,
  joinRoom,
  disconnectPlayer,
  resetRoom,
  getRoom,
  getRoomBySocket
} = require('./roomManager');

const {
  getValidMovesForNode,
  applyMove,
  countBeads
} = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint (useful for Render/Koyeb)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Catch-all: serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ─────────────────────────────────────────────
// Socket.io event handlers
// ─────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // ── CREATE ROOM ──────────────────────────────
  socket.on('create_room', ({ playerName } = {}) => {
    const result = createRoom(socket.id, playerName);
    socket.join(result.code);
    socket.emit('room_created', {
      code: result.code,
      playerNumber: result.playerNumber
    });
    console.log(`[Room] Created: ${result.code} by ${socket.id}`);
  });

  // ── JOIN ROOM ────────────────────────────────
  socket.on('join_room', ({ code, playerName } = {}) => {
    const upperCode = (code || '').toUpperCase().trim();
    const result = joinRoom(upperCode, socket.id, playerName);

    if (result.error) {
      socket.emit('join_error', { message: result.error });
      return;
    }

    socket.join(upperCode);
    const room = getRoom(upperCode);

    socket.emit('room_joined', {
      code: upperCode,
      playerNumber: result.playerNumber,
      players: room.players,
      reconnected: result.reconnected || false
    });

    if (result.gameStarted) {
      // Notify both players that the game is starting
      io.to(upperCode).emit('game_start', {
        gameState: room.gameState,
        players: room.players
      });
      console.log(`[Game] Started in room ${upperCode}`);
    } else if (result.reconnected && room.gameState) {
      // Send current state to reconnecting player
      socket.emit('game_state_sync', { gameState: room.gameState, players: room.players });
    }
  });

  // ── SELECT BEAD ─────────────────────────────
  // Client asks: "what moves can this bead make?"
  socket.on('select_bead', ({ code, node }) => {
    const room = getRoom(code);
    if (!room || !room.gameState) return;

    const { board, currentPlayer } = room.gameState;
    // Determine which player this socket is
    const playerNumber = getPlayerNumber(room, socket.id);
    if (playerNumber !== currentPlayer) return; // not your turn
    if (board[node] !== currentPlayer) return;   // not your bead

    const moves = getValidMovesForNode(board, node, currentPlayer);
    socket.emit('valid_moves', { fromNode: node, moves });
  });

  // ── MAKE MOVE ───────────────────────────────
  socket.on('make_move', ({ code, from, to }) => {
    const room = getRoom(code);
    if (!room || !room.gameState) return;
    if (room.gameState.status !== 'playing') return;

    const playerNumber = getPlayerNumber(room, socket.id);
    if (playerNumber !== room.gameState.currentPlayer) {
      socket.emit('move_error', { message: 'Not your turn' });
      return;
    }

    const result = applyMove(room.gameState, from, to);
    if (result.error) {
      socket.emit('move_error', { message: result.error });
      return;
    }

    // Update room state
    room.gameState = result;

    // Broadcast updated state to everyone in room
    io.to(code).emit('game_state_update', {
      gameState: room.gameState,
      beadCounts: countBeads(room.gameState.board)
    });

    if (result.status === 'won') {
      io.to(code).emit('game_over', {
        winner: result.winner,
        winnerName: room.players[result.winner]?.name || `Player ${result.winner}`
      });
      console.log(`[Game] Over in room ${code}. Winner: P${result.winner}`);
    }
  });

  // ── REMATCH ─────────────────────────────────
  socket.on('request_rematch', ({ code }) => {
    const room = getRoom(code);
    if (!room) return;

    // Mark this player as wanting rematch
    const playerNumber = getPlayerNumber(room, socket.id);
    if (!room.rematchVotes) room.rematchVotes = new Set();
    room.rematchVotes.add(playerNumber);

    // Notify both players
    io.to(code).emit('rematch_vote', { votes: [...room.rematchVotes] });

    // If both voted, start new game
    if (room.rematchVotes.size === 2) {
      room.rematchVotes = new Set();
      const reset = resetRoom(code);
      io.to(code).emit('game_start', {
        gameState: reset.gameState,
        players: reset.players
      });
      console.log(`[Game] Rematch started in room ${code}`);
    }
  });

  // ── DISCONNECT ──────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] Socket disconnected: ${socket.id}`);
    const info = disconnectPlayer(socket.id);
    if (info) {
      io.to(info.code).emit('player_disconnected', {
        playerNumber: info.playerNumber
      });
    }
  });

  // ── CHAT / PING (optional QOL) ───────────────
  socket.on('ping_opponent', ({ code }) => {
    socket.to(code).emit('opponent_ping');
  });
});

// ─────────────────────────────────────────────
// Helper: find which player number a socket is
// ─────────────────────────────────────────────
function getPlayerNumber(room, socketId) {
  for (const [num, player] of Object.entries(room.players)) {
    if (player && player.id === socketId) return parseInt(num);
  }
  return null;
}

server.listen(PORT, () => {
  console.log(`\n🎮 Bead Battle server running on http://localhost:${PORT}\n`);
});
