# 🎮 Bead Battle

A real-time 2-player strategy board game built with Node.js, Express, and Socket.io.

## Folder Structure

```
bead-battle/
├── server/
│   ├── index.js          # Express + Socket.io server
│   ├── gameLogic.js      # Board state, move validation, win detection
│   └── roomManager.js    # Room creation, joining, reconnect handling
├── public/
│   ├── index.html        # Single-page app shell
│   ├── css/
│   │   └── style.css     # All styles (dark ceremonial theme)
│   └── js/
│       ├── app.js        # Client controller & socket events
│       ├── board.js      # SVG board renderer & animations
│       └── sounds.js     # Web Audio API procedural SFX
├── package.json
├── Procfile              # For Render / Koyeb deployment
└── .gitignore
```

## How to Run Locally

### Prerequisites
- Node.js >= 16

### Steps

```bash
# 1. Clone or download this project
cd bead-battle

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# Or for development with auto-restart:
npm run dev
```

Open **http://localhost:3000** in two browser tabs (or two devices on the same network).

---

## How to Play

1. Player 1 clicks **Create Room** → gets a 4-letter code
2. Player 2 enters the code and clicks **Join**
3. Game starts automatically

**Board:** 13 nodes in an hourglass shape (A–M)  
**Goal:** Eliminate all opponent beads, or leave them with no moves

**Movement:**
- Click your bead to select it (valid moves highlight in green)
- Click a highlighted node to move

**Capture:**
- Yellow highlights = capture moves (jump over opponent bead to remove it)
- Captures are optional but powerful

**Win:** Opponent has 0 beads left, or cannot move

---

## Deploy to Render

1. Push code to GitHub
2. Go to https://render.com → **New Web Service**
3. Connect your repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node server/index.js`
   - **Environment:** Node
5. Deploy — Render assigns a public URL

## Deploy to Koyeb

1. Push code to GitHub
2. Go to https://app.koyeb.com → **Create App**
3. Connect repo, set:
   - **Run command:** `node server/index.js`
   - **Port:** `3000`
4. Deploy

> **Note:** Socket.io requires sticky sessions / WebSocket support. Both Render and Koyeb support WebSockets by default on their free tiers.

---

## Game Rules Summary

| Rule | Detail |
|------|--------|
| Players | 2 |
| Beads each | 6 |
| Starting positions | P1: A B C D E F — P2: H I J K L M |
| Turn order | Player 1 goes first |
| Move | One bead to adjacent empty node |
| Capture | Jump over opponent bead (straight line, landing must be empty) |
| Win | Opponent has 0 beads OR no legal moves |

---

## Technical Notes

- **No database** — all state in memory (rooms reset on server restart)
- **Reconnect** — if a player disconnects mid-game, their slot is held for them to rejoin with the same code
- **Sounds** — procedurally generated via Web Audio API, no asset files needed
- **Animations** — pure SVG + requestAnimationFrame, no external animation libraries
