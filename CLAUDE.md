# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dependencies (Node.js 18+ required)
npm run desktop      # run as Electron app (primary development mode)
npm start            # run server only — no Electron window, browser at http://localhost:4173
npm run dist         # build distributable (AppImage on Linux, DMG on macOS)
npm run dist:dir     # build unpacked distributable (faster, for local testing)
```

There is no test suite and no linter configured. Verify changes by running `npm run desktop` and exercising the feature manually. There is no hot-reload — restart after any backend change.

## Architecture

```
Electron window (desktop/main.js)
  └─ Embedded HTTP server (server.js) — spawned on a random port, localhost only
       ├─ Serves static files from public/ and node_modules via /vendor/
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

**Profile execution:** All commands in a profile run inside a single shell process so `cd`, `export`, and `source` carry across commands. Sentinel UUIDs (`printf` calls wrapping each command) let the server emit `command:start` / `command:end` events without an external parser. The generated script is written to a temp file under `/tmp/termpad-session-*` and cleaned up after the process exits.

**Profile storage:** In Electron, profiles are read/written by `desktop/main.js` via IPC (`profiles:read` / `profiles:write`) to `~/.config/Termpad/profiles.json` (Linux). In browser mode (`npm start`), `public/app.js` falls back to `localStorage`. The frontend normalizes saved data through `normalizeSavedData()` to handle legacy formats.

**Shell alias injection:** When aliases are present, `createShellSession` in `server.js` writes a temporary init file and passes it differently per shell: `--init-file` for bash, `ZDOTDIR` override for zsh, `-C` flag for fish.

**Update mechanism:** In packaged builds, `desktop/main.js` checks GitHub Releases on startup and uses `electron-updater` for AppImage installs (FUSE path). It broadcasts `update:available` / `update:downloaded` IPC events to all windows.

## Key Conventions

- **ES modules throughout** — `"type": "module"` in `package.json`. The only CommonJS file is `desktop/preload.cjs` (required by Electron's sandbox/preload contract).
- **No frameworks** — `server.js` is a plain `node:http` `createServer`. `public/app.js` is vanilla JS with no build step; it loads directly in the browser.
- **`node-pty` is a native module** — it must remain in `asarUnpack` in `package.json`; removing it breaks packaged builds.
- **Server is localhost-only** (`127.0.0.1`). It has no authentication. Do not change the bind address without adding auth first.
- **IPC surface** — `desktop/preload.cjs` exposes the full `electronAPI` bridge. Any new IPC channel must be registered in both `preload.cjs` (via `contextBridge`) and `desktop/main.js` (via `ipcMain.handle`/`ipcMain.on`).
- **`node-pty` spawns real shell processes** on the host. Any change to API request handling is a security-sensitive change.
