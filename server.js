import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import pty from "node-pty";

let ROOT = process.cwd();
let PUBLIC_DIR = join(ROOT, "public");
let MODULES_DIR = join(ROOT, "node_modules");
const sessions = new Map();
const shellSessions = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function safePublicPath(urlPath) {
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const normalized = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const fullPath = resolve(PUBLIC_DIR, `.${normalized}`);
  if (!fullPath.startsWith(PUBLIC_DIR)) return null;
  return fullPath;
}

function safeModulePath(urlPath) {
  const normalized = normalize(urlPath.replace(/^\/vendor\//, "")).replace(/^(\.\.[/\\])+/, "");
  const fullPath = resolve(MODULES_DIR, normalized);
  if (!fullPath.startsWith(MODULES_DIR)) return null;
  return fullPath;
}

function emit(session, event) {
  session.events.push(event);
  session.emitter.emit("event", event);
}

function resolveWorkingDirectory(cwd) {
  const home = process.env.HOME || ROOT;
  if (!cwd || typeof cwd !== "string") return home;
  const candidate = resolve(cwd.replace(/^~/, home));
  return existsSync(candidate) ? candidate : home;
}

function parsePtySize(payload) {
  return {
    cols: Math.max(20, Math.min(300, Number(payload.cols) || 100)),
    rows: Math.max(5, Math.min(120, Number(payload.rows) || 30))
  };
}

function streamSessionEvents(req, res, session) {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no"
  });

  const write = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  session.events.forEach(write);
  const onEvent = (event) => write(event);
  session.emitter.on("event", onEvent);
  const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    session.emitter.off("event", onEvent);
  });
}

async function runSession(session) {
  emit(session, {
    type: "session",
    status: "started",
    profileName: session.profileName,
    cwd: session.cwd
  });

  // Use a unique sentinel so we can track per-command events from a single shell process.
  // Running all commands in one process is required for cd/export/etc. to carry over between commands.
  const sentinel = randomUUID().replace(/-/g, "");
  const sentinelStartRe = new RegExp(`^${sentinel}:S:(\\d+)\\r?$`);
  const sentinelEndRe = new RegExp(`^${sentinel}:E:(\\d+):(\\d+)\\r?$`);

  const scriptLines = [];
  for (let i = 0; i < session.commands.length; i++) {
    scriptLines.push(`printf '%s\\n' "${sentinel}:S:${i}"`);
    scriptLines.push(session.commands[i]);
    scriptLines.push(`__tp_ec__=$?`);
    scriptLines.push(`printf '%s\\n' "${sentinel}:E:${i}:$__tp_ec__"`);
    if (session.stopOnError) {
      scriptLines.push(`[ $__tp_ec__ -eq 0 ] || exit $__tp_ec__`);
    }
  }

  const tmpDir = mkdtempSync("/tmp/termpad-session-");
  const scriptFile = join(tmpDir, "run.sh");
  writeFileSync(scriptFile, scriptLines.join("\n") + "\n");

  const child = pty.spawn(process.env.SHELL || "/bin/bash", ["-l", scriptFile], {
    name: "xterm-256color",
    cols: session.cols,
    rows: session.rows,
    cwd: session.cwd,
    env: {
      ...process.env,
      TERM: "xterm-256color"
    }
  });

  session.child = child;

  let lineBuffer = "";

  child.onData((chunk) => {
    lineBuffer += chunk;
    const parts = lineBuffer.split("\n");
    lineBuffer = parts.pop();

    for (const line of parts) {
      const startMatch = line.match(sentinelStartRe);
      if (startMatch) {
        const index = parseInt(startMatch[1], 10);
        emit(session, { type: "command:start", index, command: session.commands[index] });
        continue;
      }

      const endMatch = line.match(sentinelEndRe);
      if (endMatch) {
        const index = parseInt(endMatch[1], 10);
        const exitCode = parseInt(endMatch[2], 10);
        emit(session, { type: "command:end", index, command: session.commands[index], exitCode });
        continue;
      }

      emit(session, { type: "output", stream: "stdout", text: line + "\n" });
    }
  });

  const exitCode = await new Promise((resolveExit) => {
    child.onExit(({ exitCode: code, signal }) => resolveExit(signal || code || 0));
  });

  if (lineBuffer) {
    emit(session, { type: "output", stream: "stdout", text: lineBuffer });
  }

  try { rmSync(tmpDir, { recursive: true }); } catch {}

  session.child = null;

  if (session.cancelled) {
    emit(session, { type: "session", status: "cancelled" });
  } else if (exitCode !== 0 && session.stopOnError) {
    emit(session, { type: "session", status: "stopped", reason: "non-zero exit", exitCode });
  } else {
    emit(session, { type: "session", status: "completed" });
  }
  session.done = true;
}

function createShellSession(cwd, size = {}) {
  const id = randomUUID();
  const { cols, rows } = parsePtySize(size);
  const shell = pty.spawn(process.env.SHELL || "/bin/bash", [], {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      TERM: "xterm-256color"
    }
  });

  const session = {
    id,
    cwd,
    shell,
    events: [],
    emitter: new EventEmitter(),
    closed: false
  };

  shellSessions.set(id, session);
  emit(session, { type: "shell", status: "started", cwd });

  shell.onData((chunk) => {
    emit(session, { type: "output", stream: "stdout", text: chunk });
  });

  shell.onExit(({ exitCode, signal }) => {
    session.closed = true;
    emit(session, {
      type: "shell",
      status: "closed",
      exitCode: signal || exitCode || 0
    });
  });

  return session;
}

async function handleApi(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/shells") {
    try {
      const payload = await readJson(req);
      const cwd = resolveWorkingDirectory(payload.cwd);
      const shell = createShellSession(cwd, payload);
      sendJson(res, 201, { id: shell.id, cwd: shell.cwd });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  const shellEventMatch = url.pathname.match(/^\/api\/shells\/([^/]+)\/events$/);
  if (req.method === "GET" && shellEventMatch) {
    const shell = shellSessions.get(shellEventMatch[1]);
    if (!shell) {
      sendJson(res, 404, { error: "Shell not found." });
      return;
    }

    streamSessionEvents(req, res, shell);
    return;
  }

  const shellInputMatch = url.pathname.match(/^\/api\/shells\/([^/]+)\/input$/);
  if (req.method === "POST" && shellInputMatch) {
    const shell = shellSessions.get(shellInputMatch[1]);
    if (!shell || shell.closed) {
      sendJson(res, 404, { error: "Shell is not running." });
      return;
    }

    try {
      const payload = await readJson(req);
      const input = String(payload.input ?? "");
      shell.shell.write(input);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  const shellResizeMatch = url.pathname.match(/^\/api\/shells\/([^/]+)\/resize$/);
  if (req.method === "POST" && shellResizeMatch) {
    const shell = shellSessions.get(shellResizeMatch[1]);
    if (!shell || shell.closed) {
      sendJson(res, 404, { error: "Shell is not running." });
      return;
    }

    const size = parsePtySize(await readJson(req));
    shell.cols = size.cols;
    shell.rows = size.rows;
    shell.shell.resize(size.cols, size.rows);
    sendJson(res, 200, { ok: true });
    return;
  }

  const shellCloseMatch = url.pathname.match(/^\/api\/shells\/([^/]+)\/close$/);
  if (req.method === "POST" && shellCloseMatch) {
    const shell = shellSessions.get(shellCloseMatch[1]);
    if (!shell) {
      sendJson(res, 404, { error: "Shell not found." });
      return;
    }

    shell.shell.kill();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/sessions") {
    try {
      const payload = await readJson(req);
      const commands = Array.isArray(payload.commands)
        ? payload.commands.map((command) => String(command).trim()).filter(Boolean)
        : [];

      if (!commands.length) {
        sendJson(res, 400, { error: "At least one command is required." });
        return;
      }

      const id = randomUUID();
      const { cols, rows } = parsePtySize(payload);
      const session = {
        id,
        profileName: String(payload.profileName || "Untitled profile"),
        commands,
        cwd: resolveWorkingDirectory(payload.cwd),
        cols,
        rows,
        stopOnError: payload.stopOnError !== false,
        events: [],
        emitter: new EventEmitter(),
        child: null,
        cancelled: false,
        done: false
      };

      sessions.set(id, session);
      runSession(session);
      sendJson(res, 201, { id });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  const eventMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/events$/);
  if (req.method === "GET" && eventMatch) {
    const session = sessions.get(eventMatch[1]);
    if (!session) {
      sendJson(res, 404, { error: "Session not found." });
      return;
    }

    streamSessionEvents(req, res, session);
    return;
  }

  const sessionInputMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/input$/);
  if (req.method === "POST" && sessionInputMatch) {
    const session = sessions.get(sessionInputMatch[1]);
    if (!session || session.done || !session.child) {
      sendJson(res, 404, { error: "Session is not accepting input." });
      return;
    }

    try {
      const payload = await readJson(req);
      const input = String(payload.input ?? "");
      session.child.write(input);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  const sessionResizeMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/resize$/);
  if (req.method === "POST" && sessionResizeMatch) {
    const session = sessions.get(sessionResizeMatch[1]);
    if (!session || session.done) {
      sendJson(res, 404, { error: "Session is not running." });
      return;
    }

    const size = parsePtySize(await readJson(req));
    session.cols = size.cols;
    session.rows = size.rows;
    if (session.child) session.child.resize(size.cols, size.rows);
    sendJson(res, 200, { ok: true });
    return;
  }

  const cancelMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/cancel$/);
  if (req.method === "POST" && cancelMatch) {
    const session = sessions.get(cancelMatch[1]);
    if (!session) {
      sendJson(res, 404, { error: "Session not found." });
      return;
    }

    session.cancelled = true;
    if (session.child) session.child.kill();
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "Not found." });
}

export function createAppServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    const filePath = url.pathname.startsWith("/vendor/")
      ? safeModulePath(url.pathname)
      : safePublicPath(url.pathname);
    if (!filePath) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    try {
      const body = await readFile(filePath);
      res.writeHead(200, {
        "content-type": contentTypes[extname(filePath)] || "application/octet-stream"
      });
      res.end(body);
    } catch {
      const body = await readFile(join(PUBLIC_DIR, "index.html"));
      res.writeHead(200, { "content-type": contentTypes[".html"] });
      res.end(body);
    }
  });
}

export function startServer({ port = Number(process.env.PORT || 4173), host = "127.0.0.1", appRoot } = {}) {
  if (appRoot) {
    ROOT = appRoot;
    PUBLIC_DIR = join(ROOT, "public");
    MODULES_DIR = join(ROOT, "node_modules");
  }
  const server = createAppServer();

  return new Promise((resolveStart, rejectStart) => {
    server.once("error", rejectStart);
    server.listen(port, host, () => {
      server.off("error", rejectStart);
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      resolveStart({
        server,
        port: actualPort,
        host,
        url: `http://${host}:${actualPort}`
      });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
    .then(({ url }) => {
      console.log(`Termpad running at ${url}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
