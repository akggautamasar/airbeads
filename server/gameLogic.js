// ============================================================
// gameLogic.js — Core Bead Battle game state & rule engine
// ============================================================

/**
 * Board node layout (hourglass):
 *
 *   A — B — C        (indices 0,1,2)
 *   |   |   |
 *   D — E — F        (indices 3,4,5)
 *    \  |  /
 *       G            (index 6)
 *    /  |  \
 *   H — I — J        (indices 7,8,9)
 *   |   |   |
 *   K — L — M        (indices 10,11,12)
 */

const NODE_NAMES = ['A','B','C','D','E','F','G','H','I','J','K','L','M'];

// Adjacency list: each node maps to its directly connected neighbors
const ADJACENCY = {
  A: ['B','D'],
  B: ['A','C','E'],
  C: ['B','F'],
  D: ['A','E','H'],
  E: ['B','D','F','G'],
  F: ['C','E','J'],
  G: ['E','H','I','J'],
  H: ['D','G','I','K'],
  I: ['H','J','G','L'],
  J: ['F','G','I','M'],
  K: ['H','L'],
  L: ['K','M','I'],
  M: ['J','L']
};

// Jump paths: [middleNode, landingNode] — for capture moves
// A capture goes: fromNode → middleNode (opponent) → landingNode (empty)
// These are pre-computed straight-line triplets
const JUMP_LINES = [
  ['A','B','C'], ['C','B','A'],
  ['A','D','H'], ['H','D','A'],
  ['B','E','G'], ['G','E','B'],
  ['C','F','J'], ['J','F','C'],
  ['D','E','F'], ['F','E','D'],
  ['D','H','K'], ['K','H','D'],
  ['E','G','I'], ['I','G','E'],   // vertical through center
  ['F','J','M'], ['M','J','F'],
  ['H','I','J'], ['J','I','H'],
  ['H','K','L'], ['L','K','H'],   // won't happen but safe
  ['I','L','M'], ['M','L','I'],   // wait — K-L-M row
  ['K','L','M'], ['M','L','K'],
  ['G','H','D'], ['D','H','G'],   // diagonal legs of hourglass
  ['G','I','L'], ['L','I','G'],
  ['G','J','F'], ['F','J','G'],
  ['E','D','A'], ['A','D','E'],   // upper diagonals treated as straights
  ['E','F','C'], ['C','F','E'],
];

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

  // 2. Capture (jump) moves
  for (const [a, mid, land] of JUMP_LINES) {
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

  // Check win conditions
  let status = 'playing';
  let winner = null;

  const opponent = nextPlayer;
  const opponentBeads = NODE_NAMES.filter(n => newBoard[n] === opponent);

  if (opponentBeads.length === 0) {
    // Opponent has no beads left
    status = 'won';
    winner = currentPlayer;
  } else {
    // Check if opponent can make any move
    const opponentMoves = getAllValidMoves(newBoard, opponent);
    if (Object.keys(opponentMoves).length === 0) {
      status = 'won';
      winner = currentPlayer;
    }
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
