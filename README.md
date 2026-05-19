# Termpad

A lightweight desktop terminal launcher. Define named profiles — each a list of shell commands — and launch them with one click. All commands run in a real PTY inside a built-in xterm terminal.

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
curl -fsSL https://raw.githubusercontent.com/pkp2024/termpad/main/install.sh | bash
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
curl -fsSL https://raw.githubusercontent.com/pkp2024/termpad/main/install.sh | bash
```

- Downloads the latest `.dmg` and copies `Termpad.app` to `/Applications/`

Open it from Launchpad or run:

```bash
open "/Applications/Termpad.app"
```

---

## Build from source

**Prerequisites:** Node.js 18+, npm

```bash
git clone https://github.com/pkp2024/termpad.git
cd termpad
npm install

# Run in Electron
npm run desktop

# Build a distributable
npm run dist
```

---

## Usage

1. Click **New profile** in the sidebar
2. Give it a name and add your commands
3. Toggle **Stop on first error** if you want the run to abort on a non-zero exit
4. Click **Launch** — output streams into the terminal panel on the right
5. Use **New group** to bundle profiles and launch them all at once in separate tabs

You can also launch a profile directly from the terminal:

```bash
termpad "My Profile"
```

Or open a shell in a specific directory:

```bash
termpad --cwd /path/to/project
```

---

## Changelog

### Unreleased

- **YAML theme editor** — toggle between the swatch picker and a YAML editor to fine-tune any theme color; changes apply live to the terminal
- **Custom themes** — save any YAML configuration as a named theme that appears in the swatch picker alongside built-in themes
- **MRU swatch slots** — the 4 visible swatches always show your most recently used themes; a "More ▾" dropdown lists all themes and promotes any selection into the visible slots
- **Script mode** — toggle any profile's commands between the list UI and a free-form script textarea; both modes stay in sync
- **Delete custom themes** — hover a custom theme in the "More ▾" dropdown to reveal a delete button

### v1.12.0

- **Collapsible profile editor sections** — Appearance, Logging, and Commands sections collapse independently to reduce clutter
- **Collapsible sidebar sections** — Profiles and Groups sections collapse independently with scroll overflow when space is tight
- **Profile manager toggle** — close the profile manager panel without closing the app; reopen it with the ☰ button in the terminal toolbar
- **Terminal windows survive manager close** — terminal sessions continue running after the profile manager window is closed
- **CLI profile launch** — pass a profile name as an argument (`termpad "My Profile"`) to launch it directly; falls back to the manager if not found
- **`--cwd` CLI flag** — `termpad --cwd /path` opens an interactive shell in the given directory

### v1.11.0

- **Per-profile appearance** — each profile stores its own theme, font, and log format settings independently
- **Per-pane split direction** — split any terminal pane right or down with dedicated toolbar buttons and a right-click context menu

### v1.10.0

- **Terminal copy** — select text in any pane to copy it to the clipboard
- **Auto-updates** — the app checks for new releases on startup and shows a banner when one is available

### v1.9.0

- **Nautilus integration** — right-click any folder in the file manager to open it in Termpad via an "Open in Termpad" context menu entry

### v1.8.0

- **Split terminal** — divide the terminal panel into multiple panes, each running its own independent shell or profile
- **Profile variables** — use `{{VAR}}` placeholders in commands; a prompt collects values before launch

### v1.7.0 and earlier

- **Cross-platform builds** — Linux AppImage and macOS DMG distributed via GitHub Releases with a GitHub Actions workflow
- **One-line installer** — `curl | bash` install script for Linux and macOS with automatic FUSE handling on Linux
- **Group launch** — bundle multiple profiles into a group; launching opens each in its own tab
- **Renamed to Termpad** — previously called "Warp Profiles"
