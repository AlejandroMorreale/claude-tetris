# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris clone in vanilla JS + Canvas 2D. Three files: `index.html`, `style.css`, `game.js` (single global-scope script, no modules). No build, no package.json, no tests, no linter. This repo is a subfolder of a larger practice-projects directory; the parent `CLAUDE.md` has the cross-project overview.

Run: open `index.html` in a browser, or `python -m http.server 8000` / `npx serve .` from this directory. Verify changes by playing in the browser.

User-facing text and README are in Spanish; keep new user-facing text Spanish. Code identifiers are English.

## Architecture (`game.js`)

- State lives in module-level `let` globals declared on one line (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`). `init()` resets all of them, so new state must be reset there too.
- Board is a `ROWS x COLS` matrix; cell is `0` or a color/piece index 1-7 that indexes both `COLORS` and `PIECES` (index 0 is `null` in both). Pieces are square matrices whose cell values are their own index.
- Flow: `init` -> `spawn` -> `loop(ts)`. Landing goes through `lockPiece` = `merge` + `clearLines` + `spawn`. A spawn that collides immediately calls `endGame`. Hard drop, soft drop (when blocked) and gravity all end in `lockPiece`.
- `clearLines` is the only place that updates `level` and `dropInterval` (`max(100, 1000 - (level-1)*90)`); `init` sets `dropInterval = 1000` separately.
- `tryRotate` tries kicks `[0, -1, 1, -2, 2]` columns only (no vertical kicks, no SRS tables).
- Rendering: `draw()` runs every frame from `loop`; `drawNext()` runs only from `spawn`. `drawBlock(context, x, y, colorIndex, size, alpha)` is shared by both canvases (the ghost piece uses `alpha = 0.2`).
- Pause and game over share one overlay (`#overlay`) and one button (`#restart-btn`, wired to `init`), so "Reiniciar" also works while paused. `togglePause` cancels/restarts the rAF loop and resets `lastTime` to avoid a large `dt`.
- Input is a single `keydown` listener; `ArrowUp` and `KeyX` both rotate. Only `Space` calls `preventDefault`.

## Gotchas

- Changing `COLS`, `ROWS` or `BLOCK` requires updating `width`/`height` of `<canvas id="board">` in `index.html` (`COLS*BLOCK` x `ROWS*BLOCK`, currently 300x600). `next-canvas` is 120x120 and `drawNext` assumes a 4x4 cell area at 30px.
- `README.md` is a detailed description but may drift from the code; its project tree says `03-tetris/` while the folder is `03-claude-tetris`. Trust `game.js`.
- Piece selection is uniform random (`randomPiece`), not a 7-bag.
