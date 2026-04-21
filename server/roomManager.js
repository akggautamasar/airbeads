// ============================================================
// roomManager.js — Room lifecycle & player slot management
// ============================================================

const { INITIAL_STATE } = require('./gameLogic');

// In-memory store: roomCode -> roomData
const rooms = {};

/**
 * Generate a short, human-readable 4-char room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid ambiguous chars
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (rooms[code]);
  return code;
}

/**
 * Create a new room, assign creator as player 1
 */
function createRoom(socketId, playerName) {
  const code = generateRoomCode();
  rooms[code] = {
    code,
    players: {
      1: { id: socketId, name: playerName || 'Player 1', connected: true },
      2: null
    },
    gameState: null,       // null until both players join
    spectators: [],
    createdAt: Date.now()
  };
  return { code, playerNumber: 1 };
}

/**
 * Join an existing room as player 2 (or reconnect)
 */
function joinRoom(code, socketId, playerName) {
  const room = rooms[code];
  if (!room) return { error: 'Room not found' };

  // Check if this socket is reconnecting as an existing player
  for (const [num, player] of Object.entries(room.players)) {
    if (player && player.id === socketId) {
      player.connected = true;
      return { code, playerNumber: parseInt(num), reconnected: true };
    }
  }

  // Slot 2 open?
  if (!room.players[2]) {
    room.players[2] = { id: socketId, name: playerName || 'Player 2', connected: true };
    // Start game immediately
    room.gameState = INITIAL_STATE();
    return { code, playerNumber: 2, gameStarted: true };
  }

  return { error: 'Room is full' };
}

/**
 * Handle disconnection — mark player disconnected but keep room
 */
function disconnectPlayer(socketId) {
  for (const room of Object.values(rooms)) {
    for (const [num, player] of Object.entries(room.players)) {
      if (player && player.id === socketId) {
        player.connected = false;
        return { code: room.code, playerNumber: parseInt(num) };
      }
    }
  }
  return null;
}

/**
 * Attempt reconnect by matching new socketId to disconnected player slot
 */
function reconnectPlayer(code, playerNumber, newSocketId) {
  const room = rooms[code];
  if (!room) return false;
  const player = room.players[playerNumber];
  if (!player) return false;
  player.id = newSocketId;
  player.connected = true;
  return true;
}

/**
 * Reset game state for a rematch
 */
function resetRoom(code) {
  const room = rooms[code];
  if (!room) return null;
  room.gameState = INITIAL_STATE();
  return room;
}

/**
 * Get room by code
 */
function getRoom(code) {
  return rooms[code] || null;
}

/**
 * Get room by socket id
 */
function getRoomBySocket(socketId) {
  for (const room of Object.values(rooms)) {
    for (const player of Object.values(room.players)) {
      if (player && player.id === socketId) return room;
    }
  }
  return null;
}

/**
 * Delete stale rooms (older than 2 hours with no activity)
 */
function cleanupRooms() {
  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  for (const [code, room] of Object.entries(rooms)) {
    if (now - room.createdAt > TWO_HOURS) {
      delete rooms[code];
    }
  }
}

// Clean up every 30 minutes
setInterval(cleanupRooms, 30 * 60 * 1000);

module.exports = {
  createRoom,
  joinRoom,
  disconnectPlayer,
  reconnectPlayer,
  resetRoom,
  getRoom,
  getRoomBySocket
};
