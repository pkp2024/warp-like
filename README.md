# Termpad

A lightweight desktop terminal launcher. Define named profiles — each a list of shell commands with a working directory — and launch them with one click. All commands run in a real PTY inside a built-in xterm terminal.

---

## How it works

**Profiles** are saved collections of shell commands that run top-to-bottom in a single shell session. Because commands share a process, things like `cd`, `export`, and `source` carry across commands naturally.

**Groups** let you bundle multiple profiles together so they all launch at once, each in its own terminal tab.

**The terminal panel** is a full xterm.js terminal wired to a real PTY — you get color, cursor movement, and interactive programs (vim, htop, etc.) just as you would in a normal terminal.

### Under the hood

```
Electron window
  └─ Embedded HTTP server (server.js)
       ├─ Serves the UI (public/)
       └─ REST + SSE API
            ├─ POST /api/sessions   → spawns a pty running your commands
            ├─ GET  /api/sessions/:id/events  → streams output line-by-line
            ├─ POST /api/shells     → opens a persistent interactive shell
            └─ POST /api/shells/:id/input     → sends keystrokes to the shell
```

Profiles are stored in your OS user-data directory (`~/.config/Termpad/profiles.json` on Linux) so they survive updates.

---

## Install

### Linux

```bash
curl -fsSL https://raw.githubusercontent.com/pkp2024/warp-like/main/install.sh | bash
```

- Downloads the latest AppImage, installs it to `~/.local/bin/`
- Creates a `.desktop` entry so it appears in your app launcher automatically

Open it from your app menu by searching **Termpad**, or from the terminal:

```bash
termpad
```

> If `~/.local/bin` is not on your `PATH`, add this to `~/.bashrc` or `~/.zshrc`:
> ```bash
> export PATH="$HOME/.local/bin:$PATH"
> ```

### macOS

```bash
curl -fsSL https://raw.githubusercontent.com/pkp2024/warp-like/main/install.sh | bash
```

- Downloads the latest `.dmg` and copies `Termpad.app` to `/Applications/`

Open it from Launchpad or run:

```bash
open "/Applications/Termpad.app"
```

### Windows

Run this in PowerShell (no admin required):

```powershell
irm https://raw.githubusercontent.com/pkp2024/warp-like/main/install.ps1 | iex
```

- Downloads and runs the NSIS installer silently
- Find it in the Start menu by searching **Termpad**

---

## Build from source

**Prerequisites:** Node.js 18+, npm

```bash
git clone https://github.com/pkp2024/warp-like.git
cd warp-like
npm install

# Run in Electron
npm run desktop

# Build a distributable
npm run dist
```

---

## Usage

1. Click **New profile** in the sidebar
2. Give it a name and an optional working directory
3. Add your commands (one per line, run top-to-bottom)
4. Toggle **Stop on first error** if you want the run to abort on a non-zero exit
5. Click **Launch** — output streams into the terminal panel on the right
6. Use **New group** to bundle profiles and launch them all at once in separate tabs
