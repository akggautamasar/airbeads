```js
// ============================================================
// board.js — SVG board renderer & interaction layer (FINAL)
// ============================================================

const BASE_POSITIONS = {
  A: { x: 30,  y: 30  },
  B: { x: 170, y: 30  },
  C: { x: 310, y: 30  },
  D: { x: 90,  y: 140 },
  E: { x: 170, y: 140 },
  F: { x: 250, y: 140 },
  G: { x: 170, y: 220 },
  H: { x: 90,  y: 300 },
  I: { x: 170, y: 300 },
  J: { x: 250, y: 300 },
  K: { x: 30,  y: 410 },
  L: { x: 170, y: 410 },
  M: { x: 310, y: 410 }
};

const EDGES = [
  ['A','B'], ['B','C'],
  ['A','D'], ['C','F'],
  ['D','E'], ['E','F'],
  ['D','G'], ['E','G'], ['F','G'],
  ['G','H'], ['G','I'], ['G','J'],
  ['H','I'], ['I','J'],
  ['H','K'], ['J','M'],
  ['K','L'], ['L','M'],
  ['I','L']
];

let _boardRotated = false;

function getNodePositions() {
  if (!_boardRotated) return BASE_POSITIONS;

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

function rotateBoard() {
  _boardRotated = !_boardRotated;
  return _boardRotated;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const NODE_RADIUS = 17;

let _onNodeClick = null;
let _lastGameState = null;
let _lastSelected = null;
let _lastValidMoves = [];

function initBoard(onNodeClick) {
  _onNodeClick = onNodeClick;
  _drawBoard();
}

function _drawBoard() {
  const svg = document.getElementById('game-board');
  svg.innerHTML = '';

  const NP = getNodePositions();

  for (const [a, b] of EDGES) {
    const pa = NP[a];
    const pb = NP[b];

    const line = _svgEl('line', {
      x1: pa.x, y1: pa.y,
      x2: pb.x, y2: pb.y,
      class: 'board-line'
    });

    svg.appendChild(line);
  }

  for (const [name, pos] of Object.entries(NP)) {
    const circle = _svgEl('circle', {
      cx: pos.x,
      cy: pos.y,
      r: NODE_RADIUS,
      class: 'node-circle',
      'data-node': name
    });

    circle.addEventListener('click', () => {
      if (_onNodeClick) _onNodeClick(name);
    });

    svg.appendChild(circle);
  }
}

function flipBoard() {
  rotateBoard();
  _drawBoard();

  if (_lastGameState) {
    renderBoard(_lastGameState, _lastSelected, _lastValidMoves);
  }
}

function renderBoard(gameState, selectedNode, validMoves) {
  if (!gameState) return;

  _lastGameState = gameState;
  _lastSelected = selectedNode;
  _lastValidMoves = validMoves || [];

  const { board } = gameState;

  const validTo = {};
  for (const mv of validMoves || []) {
    validTo[mv.to] = mv.isCapture;
  }

  const svg = document.getElementById('game-board');

  for (const name of Object.keys(BASE_POSITIONS)) {
    const circle = svg.querySelector(`[data-node="${name}"]`);
    if (!circle) continue;

    // RESET
    circle.setAttribute('class', 'node-circle');
    circle.setAttribute('r', NODE_RADIUS);
    circle.style.filter = '';

    // PLAYER COLORS
    const owner = board[name];
    if (owner === 1) circle.classList.add('p1-bead');
    else if (owner === 2) circle.classList.add('p2-bead');

    // SELECTED NODE
    if (name === selectedNode) {
      circle.classList.add('selected');
      circle.style.filter = 'drop-shadow(0 0 12px yellow)';
      circle.setAttribute('r', NODE_RADIUS + 2);
    }

    // VALID MOVES
    if (name in validTo) {
      if (validTo[name]) {
        // 🔥 CAPTURE MOVE (HIGH PRIORITY)
        circle.classList.add('capture-move');
        circle.style.filter = 'drop-shadow(0 0 12px red)';
        circle.setAttribute('r', NODE_RADIUS + 3);
      } else {
        circle.classList.add('valid-move');
      }
    }
  }
}

function animateMove(fromNode, toNode, playerNumber, onComplete) {
  const svg = document.getElementById('game-board');
  const NP = getNodePositions();

  const pFrom = NP[fromNode];
  const pTo = NP[toNode];

  const color = playerNumber === 1 ? '#d45a2a' : '#4a8fc4';

  const ghost = _svgEl('circle', {
    cx: pFrom.x,
    cy: pFrom.y,
    r: NODE_RADIUS - 2,
    fill: color,
    opacity: 0.85
  });

  svg.appendChild(ghost);

  const start = performance.now();
  const duration = 280;

  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;

    ghost.setAttribute('cx', pFrom.x + (pTo.x - pFrom.x) * ease);
    ghost.setAttribute('cy', pFrom.y + (pTo.y - pFrom.y) * ease);

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      ghost.remove();
      if (onComplete) onComplete();
    }
  }

  requestAnimationFrame(step);
}

function animateCapture(node) {
  const svg = document.getElementById('game-board');
  const NP = getNodePositions();
  const pos = NP[node];

  const burst = _svgEl('circle', {
    cx: pos.x,
    cy: pos.y,
    r: NODE_RADIUS,
    fill: '#ff4444',
    opacity: 1
  });

  svg.appendChild(burst);

  const start = performance.now();
  const duration = 350;

  function step(now) {
    const t = Math.min((now - start) / duration, 1);

    burst.setAttribute('r', NODE_RADIUS + t * 20);
    burst.setAttribute('opacity', 1 - t);

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      burst.remove();
    }
  }

  requestAnimationFrame(step);
}

function celebrateWinner(board, winner) {
  const svg = document.getElementById('game-board');

  for (const [name, owner] of Object.entries(board)) {
    if (owner !== winner) continue;

    const circle = svg.querySelector(`[data-node="${name}"]`);
    if (!circle) continue;

    circle.style.filter = 'drop-shadow(0 0 14px gold)';

    circle.animate([
      { r: NODE_RADIUS, opacity: 1 },
      { r: NODE_RADIUS + 4, opacity: 0.8 },
      { r: NODE_RADIUS, opacity: 1 }
    ], {
      duration: 900,
      iterations: Infinity
    });
  }
}

function _svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

window.Board = {
  initBoard,
  renderBoard,
  animateMove,
  animateCapture,
  celebrateWinner,
  flipBoard
};
```
