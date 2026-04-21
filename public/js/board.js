// ============================================================
// board.js — SVG board renderer & interaction layer
// ============================================================

/**
 * REAL hourglass board (matching the hand-drawn original):
 *
 *  Top row:      A ————— B ————— C        (wide)
 *                 \      |      /
 *  Upper mid:     D ——— E ——— F            (narrow inner row)
 *                  \    |    /
 *  Center:              G                  (pinch point)
 *                  /    |    \
 *  Lower mid:     H ——— I ——— J            (narrow inner row)
 *                 /      |      \
 *  Bottom row:   K ————— L ————— M        (wide)
 *
 *  The key visual: top corners A,C spread WIDE outward,
 *  D,F pinch inward toward center G, then H,J pinch again,
 *  and K,M spread wide again — true hourglass/bowtie shape.
 */

// Base positions (un-rotated, viewBox 340×440)
const BASE_POSITIONS = {
  //  Top row — wide
  A: { x: 30,  y: 30  },
  B: { x: 170, y: 30  },
  C: { x: 310, y: 30  },
  //  Upper middle — narrow
  D: { x: 90,  y: 140 },
  E: { x: 170, y: 140 },
  F: { x: 250, y: 140 },
  //  Center pinch
  G: { x: 170, y: 220 },
  //  Lower middle — narrow
  H: { x: 90,  y: 300 },
  I: { x: 170, y: 300 },
  J: { x: 250, y: 300 },
  //  Bottom row — wide
  K: { x: 30,  y: 410 },
  L: { x: 170, y: 410 },
  M: { x: 310, y: 410 }
};

// All edges — matching the original drawing exactly
const EDGES = [
  // Top row horizontal
  ['A','B'], ['B','C'],
  // Top row outer diagonals down to upper-mid corners
  ['A','D'], ['C','F'],
  // Upper mid horizontal
  ['D','E'], ['E','F'],
  // Upper mid diagonals converging to center
  ['D','G'], ['E','G'], ['F','G'],
  // Lower mid diagonals spreading from center
  ['G','H'], ['G','I'], ['G','J'],
  // Lower mid horizontal
  ['H','I'], ['I','J'],
  // Lower mid outer diagonals down to bottom corners
  ['H','K'], ['J','M'],
  // Bottom row horizontal
  ['K','L'], ['L','M'],
  // Bottom mid vertical to bottom row
  ['I','L']
];

// Current rotation state: 0 = normal, 1 = 180° (flipped for P2 perspective)
let _boardRotated = false;

/** Get positions, possibly rotated 180° */
function getNodePositions() {
  if (!_boardRotated) return BASE_POSITIONS;
  // Rotate 180° around centre of viewBox (170, 220)
  const cx = 170, cy = 220;
  const rotated = {};
  for (const [name, pos] of Object.entries(BASE_POSITIONS)) {
    rotated[name] = {
      x: 2 * cx - pos.x,
      y: 2 * cy - pos.y
    };
  }
  return rotated;
}

/** Toggle board rotation */
function rotateBoard() {
  _boardRotated = !_boardRotated;
  return _boardRotated;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const NODE_RADIUS = 17;

let _onNodeClick = null; // callback injected by app.js
let _lastGameState = null;
let _lastSelected = null;
let _lastValidMoves = [];

/**
 * Public API: initialise the board SVG.
 * @param {function} onNodeClick - called with nodeName when a node is clicked
 */
function initBoard(onNodeClick) {
  _onNodeClick = onNodeClick;
  _drawBoard();
}

/** Internal: draw/redraw all lines and node circles */
function _drawBoard() {
  const svg = document.getElementById('game-board');
  svg.innerHTML = '';
  const NP = getNodePositions();

  // Draw edges first (below nodes)
  for (const [a, b] of EDGES) {
    const pa = NP[a];
    const pb = NP[b];
    const line = _svgEl('line', {
      x1: pa.x, y1: pa.y,
      x2: pb.x, y2: pb.y,
      class: 'board-line',
      'data-edge': `${a}-${b}`
    });
    svg.appendChild(line);
  }

  // Draw node circles
  for (const [name, pos] of Object.entries(NP)) {
    const circle = _svgEl('circle', {
      cx: pos.x,
      cy: pos.y,
      r: NODE_RADIUS,
      class: 'node-circle',
      'data-node': name
    });
    circle.addEventListener('click', () => _onNodeClick && _onNodeClick(name));
    svg.appendChild(circle);
  }
}

/**
 * Toggle 180° rotation — call from app.js rotate button.
 * Re-renders the board keeping current game state.
 */
function flipBoard() {
  rotateBoard();
  _drawBoard();
  if (_lastGameState) renderBoard(_lastGameState, _lastSelected, _lastValidMoves);
}

/**
 * Re-render the board based on the current gameState.
 * @param {object} gameState
 * @param {string|null} selectedNode
 * @param {Array}  validMoves  — array of {to, isCapture} objects
 */
function renderBoard(gameState, selectedNode, validMoves) {
  if (!gameState) return;
  // Cache for rotate re-renders
  _lastGameState = gameState;
  _lastSelected = selectedNode;
  _lastValidMoves = validMoves || [];

  const { board } = gameState;
  const validTo = {};
  if (validMoves) {
    for (const mv of validMoves) validTo[mv.to] = mv.isCapture;
  }

  const svg = document.getElementById('game-board');

  for (const name of Object.keys(BASE_POSITIONS)) {
    const circle = svg.querySelector(`[data-node="${name}"]`);
    if (!circle) continue;

    // Reset classes
    circle.className.baseVal = 'node-circle';
    circle.setAttribute('r', NODE_RADIUS);

    const owner = board[name];
    if (owner === 1) circle.classList.add('p1-bead');
    else if (owner === 2) circle.classList.add('p2-bead');

    if (name === selectedNode) circle.classList.add('selected');

    if (name in validTo) {
      if (validTo[name]) circle.classList.add('capture-move');
      else               circle.classList.add('valid-move');
    }
  }
}

/**
 * Animate a bead moving from one node to another.
 */
function animateMove(fromNode, toNode, playerNumber, onComplete) {
  const svg = document.getElementById('game-board');
  const NP = getNodePositions();
  const pFrom = NP[fromNode];
  const pTo   = NP[toNode];
  const color = playerNumber === 1 ? '#d45a2a' : '#4a8fc4';

  const ghost = _svgEl('circle', {
    cx: pFrom.x, cy: pFrom.y,
    r: NODE_RADIUS - 2,
    fill: color,
    opacity: 0.85,
    'pointer-events': 'none'
  });
  svg.appendChild(ghost);

  const startTime = performance.now();
  const dur = 280;

  function step(now) {
    const t = Math.min((now - startTime) / dur, 1);
    const ease = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
    ghost.setAttribute('cx', pFrom.x + (pTo.x - pFrom.x) * ease);
    ghost.setAttribute('cy', pFrom.y + (pTo.y - pFrom.y) * ease);
    if (t < 1) requestAnimationFrame(step);
    else {
      ghost.remove();
      if (onComplete) onComplete();
    }
  }
  requestAnimationFrame(step);
}

/**
 * Flash a captured node with a burst effect.
 */
function animateCapture(capturedNode) {
  const svg = document.getElementById('game-board');
  const NP = getNodePositions();
  const pos = NP[capturedNode];

  const burst = _svgEl('circle', {
    cx: pos.x, cy: pos.y,
    r: NODE_RADIUS,
    fill: '#ff4444',
    opacity: 1,
    'pointer-events': 'none'
  });
  svg.appendChild(burst);

  const startTime = performance.now();
  const dur = 350;
  function step(now) {
    const t = Math.min((now - startTime) / dur, 1);
    burst.setAttribute('r', NODE_RADIUS + t * 20);
    burst.setAttribute('opacity', 1 - t);
    if (t < 1) requestAnimationFrame(step);
    else burst.remove();
  }
  requestAnimationFrame(step);
}

/**
 * Flash the winning bead path with a golden glow.
 */
function celebrateWinner(board, winnerPlayer) {
  const svg = document.getElementById('game-board');
  for (const [name, owner] of Object.entries(board)) {
    if (owner !== winnerPlayer) continue;
    const circle = svg.querySelector(`[data-node="${name}"]`);
    if (!circle) continue;
    circle.style.animation = 'none';
    circle.style.filter = `drop-shadow(0 0 14px gold)`;
    // Pulse via keyframe
    circle.animate([
      { r: NODE_RADIUS,      opacity: 1 },
      { r: NODE_RADIUS + 4,  opacity: 0.8 },
      { r: NODE_RADIUS,      opacity: 1 }
    ], { duration: 900, iterations: Infinity });
  }
}

// ── SVG helper ──────────────────────────────────────────────
function _svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// Export to global scope (no bundler)
window.Board = { initBoard, renderBoard, animateMove, animateCapture, celebrateWinner, flipBoard };
