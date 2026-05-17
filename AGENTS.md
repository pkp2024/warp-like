# Termpad — Agent Instructions

## What this project is

Termpad is a desktop terminal launcher built with Electron. Users define named **profiles** (ordered lists of shell commands with a working directory) and launch them with one click. Commands run inside a real PTY via `node-pty`, streamed to an `xterm.js` frontend over SSE.

## Repository layout

```
server.js          Node.js HTTP server — REST + SSE API, PTY management
desktop/
  main.js          Electron main process — creates the BrowserWindow, embeds the server
  preload.cjs      Electron preload script
public/
  index.html       App shell
  app.js           Frontend — all UI logic (profiles, groups, terminal rendering)
  styles.css       Styles
install.sh         Linux/macOS installer (downloads AppImage or DMG)
package.json       npm scripts, electron-builder config
```

## How to run

**Prerequisites:** Node.js 18+, npm

```bash
npm install

# Run as an Electron desktop app
npm run desktop

# Run the server only (no Electron window, browser at http://localhost:4173)
npm start

# Build a distributable (AppImage on Linux, DMG on macOS)
npm run dist
```

There is no test suite yet. Verify changes by running `npm run desktop` and exercising the feature manually.

## Architecture

```
Electron window
  └─ Embedded HTTP server (server.js)
       ├─ Serves static files from public/
       └─ REST + SSE API
            ├─ POST /api/sessions             → spawn a PTY running profile commands
            ├─ GET  /api/sessions/:id/events  → stream output line-by-line (SSE)
            ├─ POST /api/sessions/:id/input   → send keystrokes to running session
            ├─ POST /api/sessions/:id/resize  → resize PTY
            ├─ POST /api/sessions/:id/cancel  → kill running session
            ├─ POST /api/shells               → open a persistent interactive shell
            ├─ GET  /api/shells/:id/events    → stream shell output (SSE)
            ├─ POST /api/shells/:id/input     → send keystrokes to shell
            ├─ POST /api/shells/:id/resize    → resize shell PTY
            └─ POST /api/shells/:id/close     → close shell
```

- All commands in a profile run in **one shell process** so `cd`, `export`, and `source` carry across commands.
- Sentinel UUIDs printed around each command let the server emit `command:start` / `command:end` events without a separate parser.
- Profile data is persisted by the frontend to the OS user-data directory (`~/.config/Termpad/profiles.json` on Linux) via Electron's `userData` path.

## Key conventions

- ES modules throughout (`"type": "module"` in package.json). `desktop/preload.cjs` is the only CommonJS file.
- No framework — `server.js` is a plain Node.js `http.createServer`. Do not introduce Express or similar unless asked.
- No build step for the frontend — `public/app.js` is vanilla JS loaded directly by the browser.
- `node-pty` is a native module; it must be listed under `asarUnpack` in `package.json` for Electron builds to work.
- The server binds to `127.0.0.1` only. Do not change this without adding authentication first.

## Things to know before making changes

- `node-pty` spawns real shell processes on the host machine. Any change to the API surface is a security-sensitive change.
- The server has no authentication. It is intentionally localhost-only for this reason.
- There is no hot-reload. After backend changes, restart with `npm run desktop` or `npm start`.
- Profiles live in the frontend's localStorage / Electron userData, not in the server.
