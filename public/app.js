import { Terminal } from "/vendor/@xterm/xterm/lib/xterm.mjs";
import { FitAddon } from "/vendor/@xterm/addon-fit/lib/addon-fit.mjs";

const storageKey = "termpad-profiles";

const defaultProfiles = [
  {
    id: crypto.randomUUID(),
    name: "Project warmup",
    cwd: "",
    stopOnError: true,
    commands: ["pwd", "git status --short", "npm test"]
  },
  {
    id: crypto.randomUUID(),
    name: "System check",
    cwd: "",
    stopOnError: false,
    commands: ["date", "node --version", "npm --version"]
  }
];

const defaultGroups = [
  {
    id: crypto.randomUUID(),
    name: "Daily startup",
    profileIds: defaultProfiles.map((profile) => profile.id)
  }
];

const terminalTheme = {
  background: "#0b0d10",
  foreground: "#d8ffe9",
  cursor: "#35d0a6",
  selectionBackground: "#24443c",
  black: "#101217",
  red: "#ff6961",
  green: "#35d0a6",
  yellow: "#f8c75c",
  blue: "#6aa7ff",
  magenta: "#d28cff",
  cyan: "#64d7e2",
  white: "#f4f5f7",
  brightBlack: "#626b7a",
  brightRed: "#ff9a94",
  brightGreen: "#67e6c4",
  brightYellow: "#ffe08a",
  brightBlue: "#9bc3ff",
  brightMagenta: "#e2b3ff",
  brightCyan: "#9eeef5",
  brightWhite: "#ffffff"
};

const state = {
  ...loadSavedData(),
  activeProfileId: null,
  activeGroupId: null,
  activeEditor: "profile",
  tabs: [],
  activeTabId: null
};

const elements = {
  profileList: document.querySelector("#profileList"),
  groupList: document.querySelector("#groupList"),
  activeEditorType: document.querySelector("#activeEditorType"),
  activeProfileName: document.querySelector("#activeProfileName"),
  profileFields: document.querySelector("#profileFields"),
  groupFields: document.querySelector("#groupFields"),
  profileNameInput: document.querySelector("#profileNameInput"),
  cwdInput: document.querySelector("#cwdInput"),
  stopOnErrorInput: document.querySelector("#stopOnErrorInput"),
  commandList: document.querySelector("#commandList"),
  groupNameInput: document.querySelector("#groupNameInput"),
  groupMemberList: document.querySelector("#groupMemberList"),
  groupAddRow: document.querySelector("#groupAddRow"),
  terminalTabs: document.querySelector("#terminalTabs"),
  terminalOutput: document.querySelector("#terminalOutput"),
  terminalStatus: document.querySelector("#terminalStatus"),
  newTerminalTabButton: document.querySelector("#newTerminalTabButton"),
  newProfileButton: document.querySelector("#newProfileButton"),
  newGroupButton: document.querySelector("#newGroupButton"),
  saveProfileButton: document.querySelector("#saveProfileButton"),
  launchProfileButton: document.querySelector("#launchProfileButton"),
  addCommandButton: document.querySelector("#addCommandButton"),
  duplicateProfileButton: document.querySelector("#duplicateProfileButton"),
  deleteProfileButton: document.querySelector("#deleteProfileButton"),
  deleteGroupButton: document.querySelector("#deleteGroupButton"),
  cancelSessionButton: document.querySelector("#cancelSessionButton"),
  restartShellButton: document.querySelector("#restartShellButton"),
  clearTerminalButton: document.querySelector("#clearTerminalButton")
};

let fitFrame = 0;
let lastFitSize = "";

const resizeObserver = new ResizeObserver(() => scheduleFitActiveTerminal());
resizeObserver.observe(elements.terminalOutput);
window.addEventListener("resize", scheduleFitActiveTerminal);

function normalizeSavedData(saved) {
  const profiles = Array.isArray(saved)
    ? saved
    : Array.isArray(saved?.profiles)
      ? saved.profiles
      : defaultProfiles;

  const normalizedProfiles = profiles.length ? profiles : defaultProfiles;
  const savedGroups = Array.isArray(saved?.groups) ? saved.groups : null;
  const fallbackGroups =
    normalizedProfiles === defaultProfiles
      ? defaultGroups
      : [
          {
            id: crypto.randomUUID(),
            name: "Daily startup",
            profileIds: normalizedProfiles.map((profile) => profile.id)
          }
        ];
  const profileIds = new Set(normalizedProfiles.map((profile) => profile.id));
  const groups = (savedGroups || fallbackGroups)
    .map((group) => ({
      id: group.id || crypto.randomUUID(),
      name: group.name || "Untitled group",
      profileIds: Array.isArray(group.profileIds)
        ? group.profileIds.filter((id) => profileIds.has(id))
        : []
    }))
    .filter((group) => group.name || group.profileIds.length);

  return {
    profiles: normalizedProfiles,
    groups
  };
}

function loadSavedData() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    return normalizeSavedData(stored);
  } catch {
    return normalizeSavedData(null);
  }
}

async function initProfiles() {
  if (window.electronAPI) {
    try {
      const stored = await window.electronAPI.readProfiles();
      const saved = normalizeSavedData(stored);
      state.profiles = saved.profiles;
      state.groups = saved.groups;
    } catch {}
  }
}

function persistProfiles() {
  const saved = {
    profiles: state.profiles,
    groups: state.groups
  };
  localStorage.setItem(storageKey, JSON.stringify(saved));
  window.electronAPI?.writeProfiles(saved).catch(() => {});
}

function activeProfile() {
  return state.profiles.find((profile) => profile.id === state.activeProfileId);
}

function activeGroup() {
  return state.groups.find((group) => group.id === state.activeGroupId);
}

function activeTab() {
  return state.tabs.find((tab) => tab.id === state.activeTabId);
}

function setActiveProfile(id) {
  saveCurrentEditor({ rerender: false });
  state.activeProfileId = id;
  state.activeEditor = "profile";
  renderEditor();
}

function setActiveGroup(id) {
  saveCurrentEditor({ rerender: false });
  state.activeGroupId = id;
  state.activeEditor = "group";
  renderEditor();
}

function profileFromForm() {
  return {
    id: state.activeProfileId,
    name: elements.profileNameInput.value.trim() || "Untitled profile",
    cwd: elements.cwdInput.value.trim(),
    stopOnError: elements.stopOnErrorInput.checked,
    commands: [...document.querySelectorAll("[data-command-input]")]
      .map((input) => input.value.trim())
      .filter(Boolean)
  };
}

function saveActiveProfile({ rerender = true } = {}) {
  if (!activeProfile()) return;
  const nextProfile = profileFromForm();
  if (rerender && !nextProfile.commands.length) {
    nextProfile.commands = ["echo Add a command to this profile"];
  }

  state.profiles = state.profiles.map((profile) =>
    profile.id === nextProfile.id ? nextProfile : profile
  );
  persistProfiles();

  if (rerender) {
    renderEditor();
  } else {
    elements.activeProfileName.textContent = nextProfile.name;
    renderProfileList();
  }
}

function groupFromForm() {
  return {
    id: state.activeGroupId,
    name: elements.groupNameInput.value.trim() || "Untitled group",
    profileIds: activeGroup()?.profileIds ?? []
  };
}

function saveActiveGroup({ rerender = true } = {}) {
  if (!activeGroup()) return;
  const nextGroup = groupFromForm();
  state.groups = state.groups.map((group) =>
    group.id === nextGroup.id ? nextGroup : group
  );
  persistProfiles();

  if (rerender) {
    renderEditor();
  } else {
    elements.activeProfileName.textContent = nextGroup.name;
    renderGroupList();
  }
}

function saveCurrentEditor(options) {
  if (state.activeEditor === "group") {
    saveActiveGroup(options);
  } else {
    saveActiveProfile(options);
  }
}

function renderProfileList() {
  elements.profileList.innerHTML = "";

  state.profiles.forEach((profile) => {
    const button = document.createElement("button");
    button.className = `profile-card${
      state.activeEditor === "profile" && profile.id === state.activeProfileId ? " active" : ""
    }`;
    button.type = "button";
    button.innerHTML = `
      <strong></strong>
      <span></span>
    `;
    button.querySelector("strong").textContent = profile.name;
    button.querySelector("span").textContent = `${profile.commands.length} command${
      profile.commands.length === 1 ? "" : "s"
    }`;
    button.addEventListener("click", () => setActiveProfile(profile.id));
    elements.profileList.append(button);
  });
}

function renderGroupList() {
  elements.groupList.innerHTML = "";

  state.groups.forEach((group) => {
    const button = document.createElement("button");
    button.className = `profile-card group-card${
      state.activeEditor === "group" && group.id === state.activeGroupId ? " active" : ""
    }`;
    button.type = "button";
    button.innerHTML = `
      <strong></strong>
      <span></span>
    `;
    button.querySelector("strong").textContent = group.name;
    button.querySelector("span").textContent = `${group.profileIds.length} profile${
      group.profileIds.length === 1 ? "" : "s"
    }`;
    button.addEventListener("click", () => setActiveGroup(group.id));
    elements.groupList.append(button);
  });
}

function renderCommandInputs(profile) {
  elements.commandList.innerHTML = "";

  profile.commands.forEach((command, index) => {
    const row = document.createElement("div");
    row.className = "command-row";
    row.innerHTML = `
      <div class="command-index">${index + 1}</div>
      <textarea data-command-input spellcheck="false"></textarea>
      <button class="icon-button" type="button" aria-label="Remove command">x</button>
    `;

    const input = row.querySelector("textarea");
    input.value = command;
    input.addEventListener("input", saveActiveProfileDebounced);
    row.querySelector("button").addEventListener("click", () => {
      const current = activeProfile();
      current.commands.splice(index, 1);
      if (!current.commands.length) current.commands.push("");
      persistProfiles();
      renderEditor();
    });

    elements.commandList.append(row);
  });
}

function renderGroupMemberInputs(group) {
  elements.groupMemberList.innerHTML = "";

  const members = profilesForGroup(group);

  if (members.length === 0) {
    const empty = document.createElement("p");
    empty.className = "group-empty";
    empty.textContent = "No profiles added yet.";
    elements.groupMemberList.append(empty);
  } else {
    members.forEach((profile) => {
      const row = document.createElement("div");
      row.className = "group-member-row";
      row.innerHTML = `
        <div class="group-member-info">
          <strong></strong>
          <small></small>
        </div>
        <button class="icon-button" type="button" aria-label="Remove from group">×</button>
      `;
      row.querySelector("strong").textContent = profile.name;
      row.querySelector("small").textContent = profile.cwd || "~/";
      row.querySelector("button").addEventListener("click", () => {
        const g = activeGroup();
        if (!g) return;
        g.profileIds = g.profileIds.filter((id) => id !== profile.id);
        persistProfiles();
        renderEditor();
      });
      elements.groupMemberList.append(row);
    });
  }

  elements.groupAddRow.innerHTML = "";
  const notInGroup = state.profiles.filter((p) => !group.profileIds.includes(p.id));
  if (notInGroup.length > 0) {
    const select = document.createElement("select");
    select.className = "group-profile-select";
    notInGroup.forEach((profile) => {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.name;
      select.append(option);
    });

    const addButton = document.createElement("button");
    addButton.className = "ghost-button";
    addButton.type = "button";
    addButton.textContent = "Add profile";
    addButton.addEventListener("click", () => {
      const g = activeGroup();
      if (!g) return;
      const profileId = select.value;
      if (profileId && !g.profileIds.includes(profileId)) {
        g.profileIds.push(profileId);
        persistProfiles();
        renderEditor();
      }
    });

    elements.groupAddRow.append(select, addButton);
  }
}

function renderEditor() {
  if (!state.profiles.length) state.profiles = defaultProfiles;
  if (!state.activeProfileId) state.activeProfileId = state.profiles[0].id;
  if (!state.activeGroupId && state.groups.length) state.activeGroupId = state.groups[0].id;

  renderProfileList();
  renderGroupList();

  const isGroup = state.activeEditor === "group";
  elements.activeEditorType.textContent = isGroup ? "Group" : "Profile";
  elements.profileFields.style.display = isGroup ? "none" : "contents";
  elements.groupFields.style.display = isGroup ? "contents" : "none";
  elements.addCommandButton.disabled = isGroup;
  elements.duplicateProfileButton.hidden = isGroup;
  elements.deleteProfileButton.hidden = isGroup;
  elements.deleteGroupButton.hidden = !isGroup;
  elements.launchProfileButton.disabled = isGroup && !activeGroup()?.profileIds.length;
  elements.launchProfileButton.lastChild.textContent = isGroup ? " Launch group" : " Launch";

  if (isGroup) {
    const group = activeGroup();
    if (!group) {
      state.activeEditor = "profile";
      renderEditor();
      return;
    }

    elements.activeProfileName.textContent = group.name;
    elements.groupNameInput.value = group.name;
    renderGroupMemberInputs(group);
    return;
  }

  const profile = activeProfile();
  elements.activeProfileName.textContent = profile.name;
  elements.profileNameInput.value = profile.name;
  elements.cwdInput.value = profile.cwd;
  elements.stopOnErrorInput.checked = profile.stopOnError;
  renderCommandInputs(profile);
}

function renderTabs() {
  elements.terminalTabs.innerHTML = "";

  state.tabs.forEach((tab) => {
    tab.container.classList.toggle("active", tab.id === state.activeTabId);
    const button = document.createElement("button");
    button.className = `terminal-tab${tab.id === state.activeTabId ? " active" : ""}`;
    button.type = "button";
    button.role = "tab";
    button.innerHTML = "<span></span>";
    button.querySelector("span").textContent = tab.title;
    button.addEventListener("click", () => setActiveTab(tab.id));
    elements.terminalTabs.append(button);
  });

  const tab = activeTab();
  elements.terminalStatus.textContent = tab?.status || "Ready";
  elements.cancelSessionButton.disabled = !tab?.profileSessionRunning;
  scheduleFitActiveTerminal();
}

function setActiveTab(id) {
  state.activeTabId = id;
  renderTabs();
  activeTab()?.terminal.focus();
}

function createTerminalTab({ title = "Terminal", startShell = true } = {}) {
  const id = crypto.randomUUID();
  const container = document.createElement("div");
  container.className = "terminal-instance";
  elements.terminalOutput.append(container);

  const terminal = new Terminal({
    cursorBlink: true,
    convertEol: true,
    fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
    fontSize: 14,
    theme: terminalTheme
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(container);

  const tab = {
    id,
    title,
    status: "Ready",
    container,
    terminal,
    fitAddon,
    shellId: null,
    shellEventSource: null,
    activeSessionId: null,
    eventSource: null,
    profileSessionRunning: false
  };

  terminal.onData((data) => sendTerminalInput(tab, data));
  state.tabs.push(tab);
  state.activeTabId = id;
  renderTabs();

  if (startShell) {
    startInteractiveShell(tab);
  }

  terminal.focus();
  return tab;
}

let saveTimer;
function saveActiveProfileDebounced() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveActiveProfile({ rerender: false }), 350);
}

function saveActiveGroupDebounced() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveActiveGroup({ rerender: false }), 350);
}

function scheduleFitActiveTerminal() {
  if (fitFrame) return;
  fitFrame = requestAnimationFrame(() => {
    fitFrame = 0;
    const tab = activeTab();
    if (!tab) return;

    const nextFitSize = `${tab.container.clientWidth}x${tab.container.clientHeight}`;
    if (nextFitSize === lastFitSize) return;
    lastFitSize = nextFitSize;
    tab.fitAddon.fit();
    resizePty(tab);
  });
}

async function resizePty(tab) {
  const payload = { cols: tab.terminal.cols, rows: tab.terminal.rows };
  const target = tab.profileSessionRunning && tab.activeSessionId
    ? `/api/sessions/${tab.activeSessionId}/resize`
    : tab.shellId
      ? `/api/shells/${tab.shellId}/resize`
      : null;

  if (!target || !payload.cols || !payload.rows) return;

  await fetch(target, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

async function startInteractiveShell(tab = activeTab(), { clear = false, cwd = null } = {}) {
  if (!tab) return;

  if (tab.shellId) {
    await fetch(`/api/shells/${tab.shellId}/close`, { method: "POST" }).catch(() => {});
  }
  tab.shellEventSource?.close();
  tab.shellId = null;

  if (clear) {
    tab.terminal.clear();
  }

  const profile = activeProfile();
  const response = await fetch("/api/shells", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      cwd: cwd ?? profile?.cwd ?? "",
      cols: tab.terminal.cols,
      rows: tab.terminal.rows
    })
  });

  if (!response.ok) {
    const error = await response.json();
    tab.terminal.write(`${error.error || "Unable to start shell"}\r\n`);
    updateTabStatus(tab, "Shell failed");
    return;
  }

  const shell = await response.json();
  tab.shellId = shell.id;
  updateTabStatus(tab, `Bash ready: ${shell.cwd}`);

  tab.shellEventSource = new EventSource(`/api/shells/${shell.id}/events`);
  tab.shellEventSource.onmessage = (message) => handleShellEvent(tab, JSON.parse(message.data));
  tab.shellEventSource.onerror = () => {
    updateTabStatus(tab, "Shell connection closed");
    tab.shellEventSource?.close();
  };
}

function handleShellEvent(tab, event) {
  if (event.type === "output") {
    tab.terminal.write(event.text);
  }

  if (event.type === "shell" && event.status === "closed") {
    tab.terminal.write(`\r\n[bash exited ${event.exitCode}]\r\n`);
    updateTabStatus(tab, "Shell closed");
    tab.shellEventSource?.close();
    tab.shellId = null;
  }
}

async function sendTerminalInput(tab, input) {
  if (!tab.profileSessionRunning && !tab.shellId) {
    await startInteractiveShell(tab);
  }

  const target = tab.profileSessionRunning && tab.activeSessionId
    ? `/api/sessions/${tab.activeSessionId}/input`
    : `/api/shells/${tab.shellId}/input`;

  const response = await fetch(target, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input })
  });

  if (!response.ok) {
    const error = await response.json();
    tab.terminal.write(`\r\n${error.error || "Unable to send input"}\r\n`);
  }
}

function updateTabStatus(tab, status) {
  tab.status = status;
  if (tab.id === state.activeTabId) {
    elements.terminalStatus.textContent = status;
  }
}

function openActiveInNewWindow() {
  saveCurrentEditor();

  if (state.activeEditor === "group") {
    const group = activeGroup();
    if (!group?.profileIds.length) return;
    window.open(`/?launchGroup=${encodeURIComponent(group.id)}`, "_blank");
    return;
  }

  const profile = activeProfile();
  if (profile) {
    window.open(`/?launchProfile=${encodeURIComponent(profile.id)}`, "_blank");
  }
}

async function launchProfileInTab(profile, tab = activeTab()) {
  if (!profile || !tab) return;

  tab.title = profile.name;
  tab.terminal.clear();
  tab.terminal.write(`$ launch profile "${profile.name}"\r\n\r\n`);
  updateTabStatus(tab, "Starting...");
  renderTabs();

  await startInteractiveShell(tab, { cwd: profile.cwd });
  if (!tab.shellId) return;

  const input = profile.commands.join("\n") + "\n";
  await fetch(`/api/shells/${tab.shellId}/input`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input })
  }).catch(() => {});

  tab.terminal.focus();
}

function profilesForGroup(group) {
  const profilesById = new Map(state.profiles.map((profile) => [profile.id, profile]));
  return group.profileIds.map((id) => profilesById.get(id)).filter(Boolean);
}

function launchGroup(group) {
  const profiles = profilesForGroup(group);
  let firstTabId = null;

  profiles.forEach((profile, index) => {
    const tab = createTerminalTab({ title: profile.name, startShell: false });
    if (index === 0) firstTabId = tab.id;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tab.fitAddon.fit();
        launchProfileInTab(profile, tab);
      });
    });
  });

  if (firstTabId) {
    state.activeTabId = firstTabId;
    renderTabs();
  }
}

function handleSessionEvent(tab, event) {
  if (event.type === "session") {
    updateTabStatus(tab, `${event.profileName || "Session"}: ${event.status}`);
    if (["completed", "cancelled", "stopped"].includes(event.status)) {
      tab.terminal.write(`\r\n[session ${event.status}]\r\n`);
      tab.profileSessionRunning = false;
      tab.eventSource?.close();
      renderTabs();
      startInteractiveShell(tab);
      tab.terminal.focus();
    }
  }

  if (event.type === "command:start") {
    tab.terminal.write(`\r\n$ ${event.command}\r\n`);
    updateTabStatus(tab, `Running command ${event.index + 1}`);
  }

  if (event.type === "output") {
    tab.terminal.write(event.text);
  }

  if (event.type === "command:end") {
    tab.terminal.write(`\r\n[exit ${event.exitCode}]\r\n`);
  }
}

elements.newProfileButton.addEventListener("click", () => {
  const profile = {
    id: crypto.randomUUID(),
    name: "New profile",
    cwd: "",
    stopOnError: true,
    commands: ["echo Hello from a new profile"]
  };
  state.profiles.unshift(profile);
  state.activeProfileId = profile.id;
  state.activeEditor = "profile";
  persistProfiles();
  renderEditor();
});

elements.newGroupButton.addEventListener("click", () => {
  const group = {
    id: crypto.randomUUID(),
    name: "New group",
    profileIds: state.activeProfileId ? [state.activeProfileId] : []
  };
  state.groups.unshift(group);
  state.activeGroupId = group.id;
  state.activeEditor = "group";
  persistProfiles();
  renderEditor();
});

elements.saveProfileButton.addEventListener("click", () => saveCurrentEditor());
elements.profileNameInput.addEventListener("input", saveActiveProfileDebounced);
elements.cwdInput.addEventListener("input", saveActiveProfileDebounced);
elements.stopOnErrorInput.addEventListener("change", saveActiveProfile);
elements.groupNameInput.addEventListener("input", saveActiveGroupDebounced);

elements.addCommandButton.addEventListener("click", () => {
  const profile = activeProfile();
  profile.commands.push("");
  persistProfiles();
  renderEditor();
  const inputs = document.querySelectorAll("[data-command-input]");
  inputs[inputs.length - 1]?.focus();
});

elements.duplicateProfileButton.addEventListener("click", () => {
  saveActiveProfile();
  const profile = activeProfile();
  const duplicate = {
    ...profile,
    id: crypto.randomUUID(),
    name: `${profile.name} copy`,
    commands: [...profile.commands]
  };
  state.profiles.unshift(duplicate);
  state.activeProfileId = duplicate.id;
  state.activeEditor = "profile";
  persistProfiles();
  renderEditor();
});

elements.deleteProfileButton.addEventListener("click", () => {
  if (state.profiles.length === 1) return;
  state.profiles = state.profiles.filter((profile) => profile.id !== state.activeProfileId);
  state.groups = state.groups.map((group) => ({
    ...group,
    profileIds: group.profileIds.filter((id) => id !== state.activeProfileId)
  }));
  state.activeProfileId = state.profiles[0].id;
  persistProfiles();
  renderEditor();
});

elements.deleteGroupButton.addEventListener("click", () => {
  state.groups = state.groups.filter((group) => group.id !== state.activeGroupId);
  state.activeGroupId = state.groups[0]?.id || null;
  state.activeEditor = state.groups.length ? "group" : "profile";
  persistProfiles();
  renderEditor();
});

elements.launchProfileButton.addEventListener("click", openActiveInNewWindow);
elements.newTerminalTabButton.addEventListener("click", () => createTerminalTab());

elements.clearTerminalButton.addEventListener("click", () => {
  const tab = activeTab();
  tab?.terminal.clear();
  tab?.terminal.focus();
});

elements.cancelSessionButton.addEventListener("click", async () => {
  const tab = activeTab();
  if (!tab?.activeSessionId) return;
  await fetch(`/api/sessions/${tab.activeSessionId}/cancel`, { method: "POST" });
});

elements.restartShellButton.addEventListener("click", () => {
  startInteractiveShell(activeTab(), { clear: true });
  activeTab()?.terminal.focus();
});

elements.terminalOutput.addEventListener("click", () => activeTab()?.terminal.focus());

(async () => {
  await initProfiles();

  const params = new URLSearchParams(window.location.search);
  const launchProfileId = params.get("launchProfile");
  const launchGroupId = params.get("launchGroup");

  if (launchGroupId) {
    document.body.classList.add("mode-terminal");
    const group = state.groups.find((item) => item.id === launchGroupId);
    if (group && profilesForGroup(group).length) {
      state.activeGroupId = group.id;
      state.activeEditor = "group";
      renderEditor();
      launchGroup(group);
    } else {
      createTerminalTab();
    }
  } else if (launchProfileId) {
    document.body.classList.add("mode-terminal");
    const profile = state.profiles.find((item) => item.id === launchProfileId);
    if (profile) {
      state.activeProfileId = profile.id;
      state.activeEditor = "profile";
      renderEditor();
      const tab = createTerminalTab({ title: profile.name, startShell: false });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          tab.fitAddon.fit();
          launchProfileInTab(profile, tab);
        });
      });
    } else {
      createTerminalTab();
    }
  } else {
    document.body.classList.add("mode-manager");
    renderEditor();
  }
})();
