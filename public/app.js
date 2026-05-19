import { Terminal } from "/vendor/@xterm/xterm/lib/xterm.mjs";
import { FitAddon } from "/vendor/@xterm/addon-fit/lib/addon-fit.mjs";

const storageKey = "termpad-profiles";

const defaultProfiles = [
  {
    id: crypto.randomUUID(),
    name: "Project warmup",
    cwd: "",
    stopOnError: true,
    theme: "ocean",
    font: "jetbrains",
    logFormat: false,
    logPattern: "[%d{HH:mm:ss}] [%-5level] %msg",
    commands: ["pwd", "git status --short", "npm test"]
  },
  {
    id: crypto.randomUUID(),
    name: "System check",
    cwd: "",
    stopOnError: false,
    theme: "dracula",
    font: "jetbrains",
    logFormat: false,
    logPattern: "[%d{HH:mm:ss}] [%-5level] %msg",
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

const THEMES = {
  ocean: {
    label: "Ocean",
    bg: "#0b0d10",
    accent: "#35d0a6",
    theme: {
      background: "#0b0d10", foreground: "#d8ffe9", cursor: "#35d0a6",
      selectionBackground: "#24443c",
      black: "#101217", red: "#ff6961", green: "#35d0a6", yellow: "#f8c75c",
      blue: "#6aa7ff", magenta: "#d28cff", cyan: "#64d7e2", white: "#f4f5f7",
      brightBlack: "#626b7a", brightRed: "#ff9a94", brightGreen: "#67e6c4",
      brightYellow: "#ffe08a", brightBlue: "#9bc3ff", brightMagenta: "#e2b3ff",
      brightCyan: "#9eeef5", brightWhite: "#ffffff"
    }
  },
  dracula: {
    label: "Dracula",
    bg: "#282a36",
    accent: "#ff79c6",
    theme: {
      background: "#282a36", foreground: "#f8f8f2", cursor: "#ff79c6",
      selectionBackground: "#44475a",
      black: "#21222c", red: "#ff5555", green: "#50fa7b", yellow: "#f1fa8c",
      blue: "#bd93f9", magenta: "#ff79c6", cyan: "#8be9fd", white: "#f8f8f2",
      brightBlack: "#6272a4", brightRed: "#ff6e6e", brightGreen: "#69ff94",
      brightYellow: "#ffffa5", brightBlue: "#d6acff", brightMagenta: "#ff92df",
      brightCyan: "#a4ffff", brightWhite: "#ffffff"
    }
  },
  nord: {
    label: "Nord",
    bg: "#2e3440",
    accent: "#88c0d0",
    theme: {
      background: "#2e3440", foreground: "#d8dee9", cursor: "#88c0d0",
      selectionBackground: "#4c566a",
      black: "#3b4252", red: "#bf616a", green: "#a3be8c", yellow: "#ebcb8b",
      blue: "#81a1c1", magenta: "#b48ead", cyan: "#88c0d0", white: "#e5e9f0",
      brightBlack: "#4c566a", brightRed: "#bf616a", brightGreen: "#a3be8c",
      brightYellow: "#ebcb8b", brightBlue: "#81a1c1", brightMagenta: "#b48ead",
      brightCyan: "#8fbcbb", brightWhite: "#eceff4"
    }
  },
  solarized: {
    label: "Solarized",
    bg: "#002b36",
    accent: "#268bd2",
    theme: {
      background: "#002b36", foreground: "#839496", cursor: "#268bd2",
      selectionBackground: "#073642",
      black: "#073642", red: "#dc322f", green: "#859900", yellow: "#b58900",
      blue: "#268bd2", magenta: "#d33682", cyan: "#2aa198", white: "#eee8d5",
      brightBlack: "#586e75", brightRed: "#cb4b16", brightGreen: "#586e75",
      brightYellow: "#657b83", brightBlue: "#839496", brightMagenta: "#6c71c4",
      brightCyan: "#93a1a1", brightWhite: "#fdf6e3"
    }
  }
};

const FONTS = {
  jetbrains:  { label: "JetBrains Mono",  value: '"JetBrains Mono", monospace' },
  fira:       { label: "Fira Code",        value: '"Fira Code", monospace' },
  sourceCode: { label: "Source Code Pro",  value: '"Source Code Pro", monospace' },
  ubuntu:     { label: "Ubuntu Mono",      value: '"Ubuntu Mono", monospace' }
};

const terminalTheme = THEMES.ocean.theme;

const state = {
  ...loadSavedData(),
  activeProfileId: null,
  activeGroupId: null,
  activeEditor: "profile",
  tabs: [],
  activeTabId: null,
  splitPanes: [],
  focusedPaneId: null,
  mainLeafEl: null
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
  themeSwatches: document.querySelector("#themeSwatches"),
  fontSelect: document.querySelector("#fontSelect"),
  logFormatInput: document.querySelector("#logFormatInput"),
  logPatternInput: document.querySelector("#logPatternInput"),
  logPatternRow: document.querySelector("#logPatternRow"),
  commandList: document.querySelector("#commandList"),
  groupNameInput: document.querySelector("#groupNameInput"),
  groupMemberList: document.querySelector("#groupMemberList"),
  groupAddRow: document.querySelector("#groupAddRow"),
  terminalTabs: document.querySelector("#terminalTabs"),
  terminalOutput: document.querySelector("#terminalOutput"),
  terminalOutputWrapper: document.querySelector("#terminalOutputWrapper"),

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
  clearTerminalButton: document.querySelector("#clearTerminalButton"),
  splitRightButton: document.querySelector("#splitRightButton"),
  splitDownButton: document.querySelector("#splitDownButton"),
  terminalContextMenu: document.querySelector("#terminalContextMenu"),
  variableModal: document.querySelector("#variableModal"),
  variableForm: document.querySelector("#variableForm"),
  variableInputs: document.querySelector("#variableInputs"),
  variableCancelButton: document.querySelector("#variableCancelButton")
};

let fitFrame = 0;
let lastFitSize = "";

const resizeObserver = new ResizeObserver(() => scheduleFitActiveTerminal());
resizeObserver.observe(elements.terminalOutputWrapper);
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

function getPaneById(id) {
  return state.splitPanes.find(p => p.id === id);
}

function focusedTab() {
  if (state.focusedPaneId !== null) {
    return getPaneById(state.focusedPaneId) ?? activeTab();
  }
  return activeTab();
}

function setFocusedPane(id) {
  state.focusedPaneId = id;
  const hasSplits = state.splitPanes.length > 0;
  elements.terminalOutput.classList.toggle("is-focused", id === null && hasSplits);
  state.splitPanes.forEach(pane => {
    pane.leafEl.classList.toggle("is-focused", pane.id === id);
  });
  const ft = focusedTab();
  elements.terminalStatus.textContent = ft?.status || "Ready";
  elements.cancelSessionButton.disabled = !ft?.profileSessionRunning;
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
  const checkedTheme = elements.themeSwatches.querySelector("input:checked");
  return {
    id: state.activeProfileId,
    name: elements.profileNameInput.value.trim() || "Untitled profile",
    cwd: elements.cwdInput.value.trim(),
    stopOnError: elements.stopOnErrorInput.checked,
    theme: checkedTheme?.value ?? "ocean",
    font: elements.fontSelect.value || "jetbrains",
    logFormat: elements.logFormatInput.checked,
    logPattern: elements.logPatternInput.value.trim() || "[%d{HH:mm:ss}] [%-5level] %msg",
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

function renderThemeSwatches(selected) {
  elements.themeSwatches.innerHTML = "";
  Object.entries(THEMES).forEach(([key, t]) => {
    const label = document.createElement("label");
    label.className = `theme-swatch${key === selected ? " selected" : ""}`;
    label.title = t.label;
    label.style.setProperty("--swatch-bg", t.bg);
    label.style.setProperty("--swatch-accent", t.accent);
    label.innerHTML = `<input type="radio" name="theme-pick" value="${key}" ${key === selected ? "checked" : ""}>
      <span class="swatch-dot"></span>
      <span class="swatch-name">${t.label}</span>`;
    label.querySelector("input").addEventListener("change", () => {
      elements.themeSwatches.querySelectorAll(".theme-swatch").forEach(el => el.classList.remove("selected"));
      label.classList.add("selected");
      saveActiveProfileDebounced();
    });
    elements.themeSwatches.append(label);
  });
}

function applyProfileAppearance(tab, profile) {
  const t = THEMES[profile.theme] ?? THEMES.ocean;
  const f = FONTS[profile.font] ?? FONTS.jetbrains;
  tab.terminal.options.theme = t.theme;
  tab.terminal.options.fontFamily = f.value;
  tab.fitAddon.fit();
  tab.terminal.refresh(0, tab.terminal.rows - 1);
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
  renderThemeSwatches(profile.theme ?? "ocean");
  elements.fontSelect.value = profile.font ?? "jetbrains";
  elements.logFormatInput.checked = !!profile.logFormat;
  elements.logPatternInput.value = profile.logPattern ?? "[%d{HH:mm:ss}] [%-5level] %msg";
  elements.logPatternRow.hidden = !profile.logFormat;
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

  const ft = focusedTab();
  elements.terminalStatus.textContent = ft?.status || "Ready";
  elements.cancelSessionButton.disabled = !ft?.profileSessionRunning;
  scheduleFitActiveTerminal();
}

function setActiveTab(id) {
  state.activeTabId = id;
  if (state.splitPanes.length > 0) setFocusedPane(null);
  renderTabs();
  activeTab()?.terminal.focus();
}

function attachCopyHandler(terminal) {
  terminal.attachCustomKeyEventHandler((e) => {
    if (e.type === "keydown" && e.ctrlKey && e.shiftKey && e.key === "C") {
      const sel = terminal.getSelection();
      if (sel) navigator.clipboard.writeText(sel);
      return false;
    }
    return true;
  });
}

function createTerminalTab({ title = "Terminal", startShell = true } = {}) {
  const id = crypto.randomUUID();
  const container = document.createElement("div");
  container.className = "terminal-instance";
  elements.terminalOutput.append(container);

  const terminal = new Terminal({
    cursorBlink: true,
    convertEol: true,
    copyOnSelect: true,
    fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
    fontSize: 14,
    lineHeight: 1.1,
    theme: terminalTheme
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(container);
  attachCopyHandler(terminal);

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
    profileSessionRunning: false,
  };

  terminal.onData((data) => {
    if (state.splitPanes.length > 0) setFocusedPane(null);
    sendTerminalInput(tab, data);
  });
  state.tabs.push(tab);
  state.activeTabId = id;
  renderTabs();

  if (startShell) {
    startInteractiveShell(tab);
  }

  terminal.focus();
  return tab;
}

function createSplitPane() {
  const leafEl = document.createElement("div");
  leafEl.className = "split-leaf";

  const containerEl = document.createElement("div");
  containerEl.className = "terminal-instance active";
  leafEl.append(containerEl);

  const terminal = new Terminal({
    cursorBlink: true,
    convertEol: true,
    copyOnSelect: true,
    fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
    fontSize: 14,
    lineHeight: 1.1,
    theme: terminalTheme
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(containerEl);
  attachCopyHandler(terminal);

  const pane = {
    id: crypto.randomUUID(),
    title: "Split",
    status: "Ready",
    leafEl,
    containerEl,
    terminal,
    fitAddon,
    shellId: null,
    shellEventSource: null,
    activeSessionId: null,
    eventSource: null,
    profileSessionRunning: false
  };

  terminal.onData(data => {
    setFocusedPane(pane.id);
    sendTerminalInput(pane, data);
  });

  leafEl.addEventListener("click", () => {
    setFocusedPane(pane.id);
    terminal.focus();
  });

  leafEl.addEventListener("contextmenu", e => showContextMenu(e, pane.id));

  return pane;
}

function initResizer(resizerEl) {
  let dragging = false;
  let startPos, startSizeA, startSizeB, siblingA, siblingB, isRow;

  resizerEl.addEventListener("mousedown", e => {
    const container = resizerEl.parentElement;
    isRow = container.classList.contains("split-right");
    siblingA = resizerEl.previousElementSibling;
    siblingB = resizerEl.nextElementSibling;
    const rectA = siblingA.getBoundingClientRect();
    const rectB = siblingB.getBoundingClientRect();
    startPos = isRow ? e.clientX : e.clientY;
    startSizeA = isRow ? rectA.width : rectA.height;
    startSizeB = isRow ? rectB.width : rectB.height;
    dragging = true;
    resizerEl.classList.add("is-dragging");
    document.body.style.cursor = isRow ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    elements.terminalOutputWrapper.style.pointerEvents = "none";
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    const delta = (isRow ? e.clientX : e.clientY) - startPos;
    const newA = Math.max(50, startSizeA + delta);
    const newB = Math.max(50, startSizeA + startSizeB - newA);
    siblingA.style.flex = newA;
    siblingB.style.flex = newB;
    scheduleFitActiveTerminal();
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    resizerEl.classList.remove("is-dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    elements.terminalOutputWrapper.style.pointerEvents = "";
  });
}

function splitAt(targetId, direction) {
  if (state.splitPanes.length >= 7) return;

  let targetLeafEl;
  if (targetId === null) {
    if (!state.mainLeafEl) {
      state.mainLeafEl = document.createElement("div");
      state.mainLeafEl.className = "split-leaf";
      elements.terminalOutputWrapper.insertBefore(state.mainLeafEl, elements.terminalOutput);
      state.mainLeafEl.append(elements.terminalOutput);
    }
    targetLeafEl = state.mainLeafEl;
  } else {
    const p = getPaneById(targetId);
    if (!p) return;
    targetLeafEl = p.leafEl;
  }

  const containerEl = document.createElement("div");
  containerEl.className = `split-container split-${direction}`;

  const parent = targetLeafEl.parentElement;
  parent.insertBefore(containerEl, targetLeafEl);
  containerEl.append(targetLeafEl);
  targetLeafEl.style.flex = "1";

  const resizerEl = document.createElement("div");
  resizerEl.className = "split-resizer";
  containerEl.append(resizerEl);
  initResizer(resizerEl);

  const pane = createSplitPane();
  pane.leafEl.style.flex = "1";
  containerEl.append(pane.leafEl);
  state.splitPanes.push(pane);

  requestAnimationFrame(() => {
    pane.fitAddon.fit();
    startInteractiveShell(pane);
    pane.terminal.focus();
    setFocusedPane(pane.id);
  });
}

function closePane(paneId) {
  const pane = getPaneById(paneId);
  if (!pane) return;

  if (pane.shellId) fetch(`/api/shells/${pane.shellId}/close`, { method: "POST" }).catch(() => {});
  pane.shellEventSource?.close();
  pane.terminal.dispose();

  const leafEl = pane.leafEl;
  const containerEl = leafEl.parentElement;
  const children = [...containerEl.children];
  const resizerEl = children.find(c => c.classList.contains("split-resizer"));
  const sibling = children.find(c => c !== leafEl && c !== resizerEl);

  const grandparent = containerEl.parentElement;
  grandparent.insertBefore(sibling, containerEl);
  containerEl.remove();
  sibling.style.flex = "";

  state.splitPanes = state.splitPanes.filter(p => p.id !== paneId);

  if (state.splitPanes.length === 0 && state.mainLeafEl) {
    const leafParent = state.mainLeafEl.parentElement;
    leafParent.insertBefore(elements.terminalOutput, state.mainLeafEl);
    state.mainLeafEl.remove();
    state.mainLeafEl = null;
    elements.terminalOutput.classList.remove("is-focused");
  }

  if (state.focusedPaneId === paneId) {
    const remaining = state.splitPanes;
    if (remaining.length > 0) {
      setFocusedPane(remaining[remaining.length - 1].id);
      remaining[remaining.length - 1].terminal.focus();
    } else {
      setFocusedPane(null);
      activeTab()?.terminal.focus();
    }
  } else {
    setFocusedPane(state.focusedPaneId);
  }

  scheduleFitActiveTerminal();
}

// ── Context menu ──────────────────────────────────────────────────────────────

let contextMenuPaneId = undefined;

function showContextMenu(e, paneId) {
  e.preventDefault();
  contextMenuPaneId = paneId;
  const menu = elements.terminalContextMenu;
  const atMax = state.splitPanes.length >= 7;
  menu.querySelector("[data-action=split-right]").disabled = atMax;
  menu.querySelector("[data-action=split-down]").disabled = atMax;
  menu.querySelector("[data-action=close]").hidden = paneId === null;
  let x = e.clientX;
  let y = e.clientY;
  if (x + 160 > window.innerWidth) x = window.innerWidth - 168;
  if (y + 150 > window.innerHeight) y = window.innerHeight - 158;
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.hidden = false;
}

function hideContextMenu() {
  elements.terminalContextMenu.hidden = true;
  contextMenuPaneId = undefined;
}

elements.terminalContextMenu.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  const id = contextMenuPaneId;
  hideContextMenu();
  if (action === "clear") {
    const tab = id === null ? activeTab() : getPaneById(id);
    tab?.terminal.clear();
    tab?.terminal.focus();
  } else if (action === "split-right") {
    splitAt(id, "right");
  } else if (action === "split-down") {
    splitAt(id, "down");
  } else if (action === "close" && id !== null) {
    closePane(id);
  }
});

document.addEventListener("click", (e) => {
  if (!elements.terminalContextMenu.hidden && !elements.terminalContextMenu.contains(e.target)) {
    hideContextMenu();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideContextMenu();
});

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
    if (tab) {
      const nextFitSize = `${tab.container.clientWidth}x${tab.container.clientHeight}`;
      if (nextFitSize !== lastFitSize) {
        lastFitSize = nextFitSize;
        tab.fitAddon.fit();
        resizePty(tab);
      }
    }

    state.splitPanes.forEach(pane => {
      pane.fitAddon.fit();
      resizePty(pane);
    });
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
  const ft = focusedTab();
  if (ft && tab.id === ft.id) {
    elements.terminalStatus.textContent = status;
    elements.cancelSessionButton.disabled = !tab.profileSessionRunning;
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

// ── Profile variables ─────────────────────────────────────────────────────────

const VAR_RE = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

function extractVariables(commands) {
  const seen = new Set();
  const vars = [];
  for (const cmd of commands) {
    for (const match of cmd.matchAll(VAR_RE)) {
      if (!seen.has(match[1])) {
        seen.add(match[1]);
        vars.push(match[1]);
      }
    }
  }
  return vars;
}

function substituteVariables(commands, values) {
  return commands.map((cmd) =>
    cmd.replace(VAR_RE, (_, name) => values[name] ?? `{{${name}}}`)
  );
}

function showVariableModal(vars, profileName = null) {
  return new Promise((resolve) => {
    elements.variableModal.querySelector("h3").textContent =
      profileName ? `Variables — ${profileName}` : "Profile variables";

    elements.variableInputs.innerHTML = "";
    for (const name of vars) {
      const label = document.createElement("label");
      const nameSpan = document.createElement("span");
      nameSpan.textContent = name;
      const input = document.createElement("input");
      input.name = name;
      input.autocomplete = "off";
      label.append(nameSpan, input);
      elements.variableInputs.append(label);
    }

    elements.variableModal.showModal();
    elements.variableInputs.querySelector("input")?.focus();

    let resolved = false;

    function done(values) {
      if (resolved) return;
      resolved = true;
      if (elements.variableModal.open) elements.variableModal.close();
      resolve(values);
    }

    elements.variableForm.addEventListener("submit", function onSubmit(e) {
      e.preventDefault();
      elements.variableForm.removeEventListener("submit", onSubmit);
      const values = {};
      for (const name of vars) {
        values[name] = elements.variableForm.elements[name]?.value ?? "";
      }
      done(values);
    }, { once: true });

    elements.variableCancelButton.addEventListener("click", () => done(null), { once: true });
    elements.variableModal.addEventListener("close", () => done(null), { once: true });
  });
}

function handleTerminalSessionEvent(tab, event) {
  if (event.type === "command:start") {
    tab.terminal.write(`\r\n\x1b[2m$ ${event.command}\x1b[0m\r\n`);
    updateTabStatus(tab, `Running command ${event.index + 1}`);
  }
  if (event.type === "output") {
    tab.terminal.write(event.text);
  }
  if (event.type === "command:end" && event.exitCode !== 0) {
    tab.terminal.write(`\x1b[31m[exit ${event.exitCode}]\x1b[0m\r\n`);
  }
  if (event.type === "session" && ["completed", "cancelled", "stopped"].includes(event.status)) {
    tab.terminal.write(`\r\n\x1b[2m[session ${event.status}]\x1b[0m\r\n`);
    tab.profileSessionRunning = false;
    tab.eventSource?.close();
    tab.eventSource = null;
    renderTabs();
    startInteractiveShell(tab);
    tab.terminal.focus();
  }
}

async function launchWithSession(profile, tab, commands) {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      commands,
      profileName: profile.name,
      cwd: profile.cwd,
      stopOnError: profile.stopOnError,
      logFormat: profile.logFormat,
      logPattern: profile.logPattern,
      cols: tab.terminal.cols,
      rows: tab.terminal.rows
    })
  });
  if (!res.ok) return;
  const { id } = await res.json();
  tab.activeSessionId = id;
  tab.profileSessionRunning = true;

  const es = new EventSource(`/api/sessions/${id}/events`);
  tab.eventSource = es;
  es.onmessage = (e) => { try { handleTerminalSessionEvent(tab, JSON.parse(e.data)); } catch {} };

  updateTabStatus(tab, "Starting...");
  renderTabs();
}

// ── Launch ────────────────────────────────────────────────────────────────────

async function launchProfileInTab(profile, tab = activeTab(), resolvedCommands = null) {
  if (!profile || !tab) return;

  let commands = resolvedCommands;

  if (!commands) {
    const vars = extractVariables(profile.commands);
    if (vars.length > 0) {
      const values = await showVariableModal(vars, profile.name);
      if (values === null) return;
      commands = substituteVariables(profile.commands, values);
    } else {
      commands = profile.commands;
    }
  }

  tab.title = profile.name;
  applyProfileAppearance(tab, profile);
  renderTabs();

  if (profile.logFormat) {
    tab.terminal.clear();
    tab.terminal.write(`\x1b[2m$ launch profile "${profile.name}"\x1b[0m\r\n\r\n`);
    await launchWithSession(profile, tab, commands);
    return;
  }

  tab.terminal.clear();
  tab.terminal.write(`$ launch profile "${profile.name}"\r\n\r\n`);
  updateTabStatus(tab, "Starting...");
  renderTabs();

  await startInteractiveShell(tab, { cwd: profile.cwd });
  if (!tab.shellId) return;

  const input = commands.join("\n") + "\n";
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

async function launchGroup(group) {
  const profiles = profilesForGroup(group);

  // Resolve variables for each profile upfront before opening any tabs
  const resolvedCommandsList = [];
  for (const profile of profiles) {
    const vars = extractVariables(profile.commands);
    if (vars.length > 0) {
      const values = await showVariableModal(vars, profile.name);
      if (values === null) return;
      resolvedCommandsList.push(substituteVariables(profile.commands, values));
    } else {
      resolvedCommandsList.push(profile.commands);
    }
  }

  let firstTabId = null;

  profiles.forEach((profile, index) => {
    const tab = createTerminalTab({ title: profile.name, startShell: false });
    if (index === 0) firstTabId = tab.id;
    const resolved = resolvedCommandsList[index];
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tab.fitAddon.fit();
        launchProfileInTab(profile, tab, resolved);
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

// ── Event listeners ───────────────────────────────────────────────────────────

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
elements.fontSelect.addEventListener("change", saveActiveProfile);
elements.logFormatInput.addEventListener("change", () => {
  elements.logPatternRow.hidden = !elements.logFormatInput.checked;
  saveActiveProfile();
});
elements.logPatternInput.addEventListener("input", saveActiveProfileDebounced);
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
  const tab = focusedTab();
  tab?.terminal.clear();
  tab?.terminal.focus();
});

elements.cancelSessionButton.addEventListener("click", async () => {
  const tab = focusedTab();
  if (!tab?.activeSessionId) return;
  await fetch(`/api/sessions/${tab.activeSessionId}/cancel`, { method: "POST" });
});

elements.restartShellButton.addEventListener("click", () => {
  const tab = focusedTab();
  if (!tab) return;
  startInteractiveShell(tab, { clear: true });
  tab.terminal.focus();
});

elements.terminalOutput.addEventListener("click", () => {
  if (state.splitPanes.length > 0) setFocusedPane(null);
  activeTab()?.terminal.focus();
});

elements.terminalOutput.addEventListener("contextmenu", (e) => showContextMenu(e, null));

elements.splitRightButton.addEventListener("click", () => splitAt(state.focusedPaneId, "right"));
elements.splitDownButton.addEventListener("click", () => splitAt(state.focusedPaneId, "down"));


// ── Boot ──────────────────────────────────────────────────────────────────────

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
