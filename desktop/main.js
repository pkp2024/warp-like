import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startServer } from "../server.js";

const require = createRequire(import.meta.url);
const { app, BrowserWindow, shell, ipcMain } = require("electron");

let appServer;
let serverUrl;

function profilesPath() {
  return join(app.getPath("userData"), "profiles.json");
}

ipcMain.handle("profiles:read", () => {
  try {
    return JSON.parse(readFileSync(profilesPath(), "utf8"));
  } catch {
    return null;
  }
});

ipcMain.handle("profiles:write", (_event, profiles) => {
  writeFileSync(profilesPath(), JSON.stringify(profiles));
  return true;
});

function createWindow(path = "/") {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: "Termpad",
    backgroundColor: "#101114",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(app.getAppPath(), "desktop", "preload.cjs")
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(serverUrl)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 1280,
          height: 820,
          minWidth: 980,
          minHeight: 680,
          title: "Termpad",
          backgroundColor: "#101114",
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: join(app.getAppPath(), "desktop", "preload.cjs")
          }
        }
      };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });

  window.loadURL(`${serverUrl}${path}`);
  return window;
}

app.whenReady().then(async () => {
  const serverInfo = await startServer({ port: 0, appRoot: app.getAppPath() });
  appServer = serverInfo.server;
  serverUrl = serverInfo.url;
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  appServer?.close();
});
