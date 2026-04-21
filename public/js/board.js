// ============================================================
// board.js — SVG board renderer & interaction layer
// ============================================================

/**
 * Node pixel positions within a 340×420 viewBox.
 *
 *   A(55,40)  B(170,40)  C(285,40)
 *   D(55,140) E(170,140) F(285,140)
 *                G(170,210)
 *   H(55,280) I(170,280) J(285,280)
 *   K(55,380) L(170,380) M(285,380)
 */
const NODE_POSITIONS = {
  A: { x: 55,  y: 40  },
  B: { x: 170, y: 40  },
  C: { x: 285, y: 40  },
  D: { x: 55,  y: 140 },
  E: { x: 170, y: 140 },
  F: { x: 285, y: 140 },
  G: { x: 170, y: 210 },
  H: { x: 55,  y: 280 },
  I: { x: 170, y: 280 },
  J: { x: 285, y: 280 },
  K: { x: 55,  y: 380 },
  L: { x: 170, y: 380 },
  M: { x: 285, y: 380 }
};

// All edges to draw as lines (undirected)
const EDGES = [
  ['A','B'], ['B','C'],
  ['A','D'], ['B','E'], ['C','F'],
  ['D','E'], ['E','F'],
  ['D','H'],            ['F','J'],
  ['E','G'],
  ['G','H'], ['G','I'], ['G','J'],
  ['H','I'], ['I','J'],
  ['H','K'], ['I','L'], ['J','M'],
  ['K','L'], ['L','M']
];

const SVG_NS = 'http://www.w3.org/2000/svg';
const NODE_RADIUS = 16;

let _onNodeClick = null; // callback injected by app.js

/**
 * Public API: initialise the board SVG.
 * @param {function} onNodeClick - called with nodeName when a node is clicked
 */
function initBoard(onNodeClick) {
  _onNodeClick = onNodeClick;
  const svg = document.getElementById('game-board');
  svg.innerHTML = '';

  // Draw edges first (below nodes)
  for (const [a, b] of EDGES) {
    const pa = NODE_POSITIONS[a];
    const pb = NODE_POSITIONS[b];
    const line = _svgEl('line', {
      x1: pa.x, y1: pa.y,
      x2: pb.x, y2: pb.y,
      class: 'board-line',
      'data-edge': `${a}-${b}`
    });
    svg.appendChild(line);
  }

  // Draw node circles
  for (const [name, pos] of Object.entries(NODE_POSITIONS)) {
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
 * Re-render the board based on the current gameState.
 * @param {object} gameState
 * @param {string|null} selectedNode
 * @param {Array}  validMoves  — array of {to, isCapture} objects
 */
function renderBoard(gameState, selectedNode, validMoves) {
  if (!gameState) return;
  const { board } = gameState;

  const validTo = {};
  if (validMoves) {
    for (const mv of validMoves) validTo[mv.to] = mv.isCapture;
  }

  const svg = document.getElementById('game-board');

  for (const [name] of Object.entries(NODE_POSITIONS)) {
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
 * Adds a temporary "ghost" circle along the path.
 */
function animateMove(fromNode, toNode, playerNumber, onComplete) {
  const svg = document.getElementById('game-board');
  const pFrom = NODE_POSITIONS[fromNode];
  const pTo   = NODE_POSITIONS[toNode];
  const color = playerNumber === 1 ? '#d45a2a' : '#4a8fc4';

  // Ghost bead
  const ghost = _svgEl('circle', {
    cx: pFrom.x, cy: pFrom.y,
    r: NODE_RADIUS - 2,
    fill: color,
    opacity: 0.85,
    'pointer-events': 'none'
  });
  svg.appendChild(ghost);

  // Animate via WAAPI
  const anim = ghost.animate([
    { cx: pFrom.x, cy: pFrom.y },
    { cx: pTo.x,   cy: pTo.y   }
  ], {
    duration: 260,
    easing: 'cubic-bezier(0.4,0,0.2,1)',
    fill: 'forwards'
  });

  // SVG doesn't animate cx/cy via WAAPI natively in all browsers,
  // so we use a requestAnimationFrame approach instead:
  const startTime = performance.now();
  const dur = 260;

  function step(now) {
    const t = Math.min((now - startTime) / dur, 1);
    const ease = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t; // easeInOut
    ghost.setAttribute('cx', pFrom.x + (pTo.x - pFrom.x) * ease);
    ghost.setAttribute('cy', pFrom.y + (pTo.y - pFrom.y) * ease);
    if (t < 1) requestAnimationFrame(step);
    else {
      ghost.remove();
      anim.cancel();
      if (onComplete) onComplete();
    }
  }
  anim.cancel();
  requestAnimationFrame(step);
}

/**
 * Flash a captured node with a burst effect.
 */
function animateCapture(capturedNode) {
  const svg = document.getElementById('game-board');
  const pos = NODE_POSITIONS[capturedNode];

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
    burst.setAttribute('r', NODE_RADIUS + t * 18);
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
window.Board = { initBoard, renderBoard, animateMove, animateCapture, celebrateWinner };
