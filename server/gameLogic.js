```js
// ============================================================
// gameLogic.js — FINAL VERSION (Forced + Unlimited Chain Capture)
// ============================================================

const NODE_NAMES = ['A','B','C','D','E','F','G','H','I','J','K','L','M'];

const ADJACENCY = {
  A: ['B', 'D'],
  B: ['A', 'C', 'E'],
  C: ['B', 'F'],
  D: ['A', 'E', 'G'],
  E: ['B', 'D', 'F', 'G'],
  F: ['C', 'E', 'G'],
  G: ['D', 'E', 'F', 'H', 'I', 'J'],
  H: ['G', 'I', 'K'],
  I: ['G', 'H', 'J', 'L'],
  J: ['G', 'I', 'M'],
  K: ['H', 'L'],
  L: ['K', 'M', 'I'],
  M: ['J', 'L']
};

const JUMP_LINES = [
  ['A','B','C'], ['C','B','A'],
  ['A','D','G'], ['G','D','A'],
  ['C','F','G'], ['G','F','C'],
  ['D','E','F'], ['F','E','D'],
  ['B','E','G'], ['G','E','B'],
  ['D','G','J'], ['J','G','D'],
  ['F','G','H'], ['H','G','F'],
  ['G','I','L'], ['L','I','G'],
  ['H','I','J'], ['J','I','H'],
  ['G','H','K'], ['K','H','G'],
  ['G','J','M'], ['M','J','G'],
  ['K','L','M'], ['M','L','K']
];

// Remove duplicate jump lines
const seen = new Set();
const JUMP_LINES_DEDUPED = JUMP_LINES.filter(line => {
  const key = line.join('-');
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const INITIAL_STATE = () => ({
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
  status: 'playing',
  winner: null,
  lastMove: null
});

// ============================================================
// VALID MOVES (FORCED CAPTURE)
// ============================================================

function getValidMovesForNode(board, fromNode, currentPlayer) {
  const opponent = currentPlayer === 1 ? 2 : 1;
  const captureMoves = [];

  // Capture moves
  for (const [a, mid, land] of JUMP_LINES_DEDUPED) {
    if (a === fromNode) {
      if (board[mid] === opponent && board[land] === 0) {
        captureMoves.push({
          to: land,
          isCapture: true,
          capturedNode: mid
        });
      }
    }
  }

  // If capture exists → only capture allowed
  if (captureMoves.length > 0) return captureMoves;

  // Normal moves
  const normalMoves = [];
  for (const neighbor of ADJACENCY[fromNode]) {
    if (board[neighbor] === 0) {
      normalMoves.push({
        to: neighbor,
        isCapture: false,
        capturedNode: null
      });
    }
  }

  return normalMoves;
}

// ============================================================
// APPLY MOVE (UNLIMITED CHAIN CAPTURE)
// ============================================================

function applyMove(state, fromNode, toNode) {
  const { board, currentPlayer } = state;

  if (board[fromNode] !== currentPlayer) {
    return { error: 'Not your bead' };
  }

  const moves = getValidMovesForNode(board, fromNode, currentPlayer);
  const move = moves.find(m => m.to === toNode);

  if (!move) {
    return { error: 'Invalid move' };
  }

  const newBoard = { ...board };
  const newCaptured = { ...state.capturedBy };

  // Execute move
  newBoard[toNode] = currentPlayer;
  newBoard[fromNode] = 0;

  if (move.isCapture) {
    newBoard[move.capturedNode] = 0;
    newCaptured[currentPlayer] =
      (newCaptured[currentPlayer] || 0) + 1;
  }

  let currentNode = toNode;

  // 🔥 CHECK FOR NEXT CAPTURE (FORCED CONTINUE)
  if (move.isCapture) {
    const nextCaptures = getValidMovesForNode(newBoard, currentNode, currentPlayer)
      .filter(m => m.isCapture);

    if (nextCaptures.length > 0) {
      // SAME PLAYER MUST CONTINUE
      return {
        board: newBoard,
        currentPlayer: currentPlayer,
        selected: currentNode,
        validMoves: nextCaptures,
        capturedBy: newCaptured,
        status: 'playing',
        winner: null,
        lastMove: {
          from: fromNode,
          to: toNode,
          isCapture: true,
          capturedNode: move.capturedNode
        }
      };
    }
  }

  // SWITCH TURN
  const nextPlayer = currentPlayer === 1 ? 2 : 1;

  let status = 'playing';
  let winner = null;

  const opponentBeads = NODE_NAMES.filter(
    n => newBoard[n] === nextPlayer
  );

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
    lastMove: {
      from: fromNode,
      to: toNode,
      isCapture: move.isCapture,
      capturedNode: move.capturedNode
    }
  };
}

// ============================================================
// COUNT BEADS
// ============================================================

function countBeads(board) {
  let p1 = 0, p2 = 0;

  for (const node of NODE_NAMES) {
    if (board[node] === 1) p1++;
    else if (board[node] === 2) p2++;
  }

  return { 1: p1, 2: p2 };
}

// ============================================================

module.exports = {
  NODE_NAMES,
  ADJACENCY,
  INITIAL_STATE,
  getValidMovesForNode,
  applyMove,
  countBeads
};
```
