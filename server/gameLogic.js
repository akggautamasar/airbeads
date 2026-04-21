// ============================================================
// gameLogic.js — Core Bead Battle game state & rule engine
// ============================================================

/**
 * REAL hourglass board (matching original hand-drawn design):
 *
 *   A ————— B ————— C        ← top row (wide)
 *    \      |      /
 *     D ——— E ——— F           ← upper middle (narrow)
 *      \    |    /
 *           G                 ← center pinch node
 *      /    |    \
 *     H ——— I ——— J           ← lower middle (narrow)
 *    /       |      \
 *   K ————— L ————— M        ← bottom row (wide)
 *
 *  Diagonal connections form the hourglass "X" shape.
 */

const NODE_NAMES = ['A','B','C','D','E','F','G','H','I','J','K','L','M'];

// Adjacency list: each node maps to its directly connected neighbors
const ADJACENCY = {
  // Top row
  A: ['B', 'D'],
  B: ['A', 'C', 'E'],
  C: ['B', 'F'],
  // Upper middle
  D: ['A', 'E', 'G'],
  E: ['B', 'D', 'F', 'G'],
  F: ['C', 'E', 'G'],
  // Center
  G: ['D', 'E', 'F', 'H', 'I', 'J'],
  // Lower middle
  H: ['G', 'I', 'K'],
  I: ['G', 'H', 'J', 'L'],
  J: ['G', 'I', 'M'],
  // Bottom row
  K: ['H', 'L'],
  L: ['K', 'M', 'I'],
  M: ['J', 'L']
};

// Jump (capture) lines: [from, over, land] — all straight-line triplets
// A capture: from → over(opponent) → land(empty), all collinear
const JUMP_LINES = [
  // Top row horizontal
  ['A','B','C'], ['C','B','A'],
  // Top diagonals through upper-mid to center
  ['A','D','G'], ['G','D','A'],
  ['C','F','G'], ['G','F','C'],
  // Upper mid horizontal
  ['D','E','F'], ['F','E','D'],
  // Upper mid verticals to center
  ['B','E','G'], ['G','E','B'],
  // Center through lower mid to bottom
  ['D','G','J'], ['J','G','D'],   // diagonal cross
  ['F','G','H'], ['H','G','F'],   // diagonal cross other way
  // Lower mid verticals from center
  ['G','I','L'], ['L','I','G'],
  // Lower mid horizontal
  ['H','I','J'], ['J','I','H'],
  // Bottom diagonals
  ['G','H','K'], ['K','H','G'],
  ['G','J','M'], ['M','J','G'],
  // Bottom row horizontal
  ['K','L','M'], ['M','L','K'],
  // Verticals: top→mid→center
  ['A','D','G'], // already above, keep unique
  // Full verticals top to bottom through middle column
  ['B','E','G'], ['G','E','B'],   // already listed
  ['G','I','L'], ['L','I','G'],   // already listed
];

// De-duplicate jump lines (we listed some twice for clarity)
const _seenJumps = new Set();
const JUMP_LINES_DEDUPED = [];
for (const triplet of JUMP_LINES) {
  const key = triplet.join('-');
  if (!_seenJumps.has(key)) {
    _seenJumps.add(key);
    JUMP_LINES_DEDUPED.push(triplet);
  }
}

// Initial positions
const INITIAL_STATE = () => ({
  // board: node -> 1 (player1), 2 (player2), 0 (empty)
  board: {
    A:1, B:1, C:1,
    D:1, E:1, F:1,
    G:0,
    H:2, I:2, J:2,
    K:2, L:2, M:2
  },
  currentPlayer: 1,
  selected: null,
  validMoves: [],
  capturedBy: { 1: 0, 2: 0 },
  status: 'playing', // 'playing' | 'won'
  winner: null,
  lastMove: null,
});

/**
 * Returns all valid moves for a given node owned by currentPlayer.
 * Returns array of { to, isCapture, capturedNode }
 */
function getValidMovesForNode(board, fromNode, currentPlayer) {
  const moves = [];

  // 1. Simple adjacent moves
  for (const neighbor of ADJACENCY[fromNode]) {
    if (board[neighbor] === 0) {
      moves.push({ to: neighbor, isCapture: false, capturedNode: null });
    }
  }

  // 2. Capture (jump) moves — jump over adjacent opponent to empty node beyond
  for (const [a, mid, land] of JUMP_LINES_DEDUPED) {
    if (a === fromNode) {
      const opponent = currentPlayer === 1 ? 2 : 1;
      if (board[mid] === opponent && board[land] === 0) {
        moves.push({ to: land, isCapture: true, capturedNode: mid });
      }
    }
  }

  return moves;
}

/**
 * Returns all valid moves for the current player across all their beads.
 */
function getAllValidMoves(board, currentPlayer) {
  const allMoves = {};
  for (const node of NODE_NAMES) {
    if (board[node] === currentPlayer) {
      const moves = getValidMovesForNode(board, node, currentPlayer);
      if (moves.length > 0) allMoves[node] = moves;
    }
  }
  return allMoves;
}

/**
 * Apply a move and return the new game state.
 * Validates the move before applying.
 */
function applyMove(state, fromNode, toNode) {
  const { board, currentPlayer } = state;

  // Validate it's the right player's bead
  if (board[fromNode] !== currentPlayer) return { error: 'Not your bead' };

  // Get valid moves for this bead
  const moves = getValidMovesForNode(board, fromNode, currentPlayer);
  const move = moves.find(m => m.to === toNode);
  if (!move) return { error: 'Invalid move' };

  // Apply move to a new board copy
  const newBoard = { ...board };
  newBoard[toNode] = currentPlayer;
  newBoard[fromNode] = 0;

  let newCaptured = { ...state.capturedBy };
  if (move.isCapture) {
    newBoard[move.capturedNode] = 0;
    newCaptured[currentPlayer] = (newCaptured[currentPlayer] || 0) + 1;
  }

  const nextPlayer = currentPlayer === 1 ? 2 : 1;

  // Win condition: opponent has zero beads remaining
  let status = 'playing';
  let winner = null;

  const opponentBeads = NODE_NAMES.filter(n => newBoard[n] === nextPlayer);
  if (opponentBeads.length === 0) {
    status = 'won';
    winner = currentPlayer;
  }

  return {
    board: newBoard,
    currentPlayer: status === 'playing' ? nextPlayer : currentPlayer,
    selected: null,
    validMoves: [],
    capturedBy: newCaptured,
    status,
    winner,
    lastMove: { from: fromNode, to: toNode, isCapture: move.isCapture, capturedNode: move.capturedNode }
  };
}

/**
 * Count beads for each player
 */
function countBeads(board) {
  let p1 = 0, p2 = 0;
  for (const node of NODE_NAMES) {
    if (board[node] === 1) p1++;
    else if (board[node] === 2) p2++;
  }
  return { 1: p1, 2: p2 };
}

module.exports = {
  NODE_NAMES,
  ADJACENCY,
  INITIAL_STATE,
  getValidMovesForNode,
  getAllValidMoves,
  applyMove,
  countBeads
};
