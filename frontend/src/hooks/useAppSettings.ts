import { useSyncExternalStore } from "react";

export const SETTINGS_KEY = "devpilot_settings";
const SETTINGS_EVENT = "devpilot-settings-changed";
export const ACCENT_COLORS = [
  { name: "Violet", value: "#a78bfa", lightValue: "#7c3aed" },
  { name: "Blue", value: "#3b82f6", lightValue: "#2563eb" },
  { name: "Emerald", value: "#10b981", lightValue: "#047857" },
  { name: "Amber", value: "#f59e0b", lightValue: "#b45309" },
  { name: "Pink", value: "#ec4899", lightValue: "#be185d" },
  { name: "Red", value: "#ef4444", lightValue: "#b91c1c" },
] as const;

export interface AppSettings {
  theme: "dark" | "light" | "system";
  fontSize: number;
  sidebarPosition: "left" | "right";
  accentColor: string;
  tabSize: 2 | 4 | 8;
  wordWrap: boolean;
  lineNumbers: boolean;
  defaultProvider: "codex" | "gemini";
  streamOutput: boolean;
  gitRefreshInterval: 0 | 15 | 30 | 60;
  checkUpdatesOnStartup: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system", fontSize: 16, sidebarPosition: "left", accentColor: "#a78bfa",
  tabSize: 2, wordWrap: false, lineNumbers: true,
  defaultProvider: "gemini", streamOutput: true, gitRefreshInterval: 15,
  checkUpdatesOnStartup: true,
};

let cachedSignature: string | undefined;
let cachedSettings = DEFAULT_SETTINGS;

function getSnapshot(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  let raw: string | null;
  let legacyTheme: string | null;
  try {
    raw = localStorage.getItem(SETTINGS_KEY);
    legacyTheme = localStorage.getItem("devpilot_theme");
  } catch { return DEFAULT_SETTINGS; }
  const signature = JSON.stringify([raw, legacyTheme]);
  if (signature === cachedSignature) return cachedSettings;
  cachedSignature = signature;
  let saved: Partial<AppSettings> = {};
  try {
    const parsed: unknown = JSON.parse(raw ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) saved = parsed;
  } catch { /* Invalid stored preferences fall back to defaults. */ }
  const theme = legacyTheme ?? saved.theme;
  cachedSettings = {
    theme: theme === "light" || theme === "dark" || theme === "system" ? theme : DEFAULT_SETTINGS.theme,
    fontSize: typeof saved.fontSize === "number" && Number.isInteger(saved.fontSize) && saved.fontSize >= 12 && saved.fontSize <= 20 ? saved.fontSize : DEFAULT_SETTINGS.fontSize,
    sidebarPosition: saved.sidebarPosition === "right" ? "right" : "left",
    accentColor: ACCENT_COLORS.some(color => color.value === saved.accentColor) ? saved.accentColor! : DEFAULT_SETTINGS.accentColor,
    tabSize: saved.tabSize === 4 || saved.tabSize === 8 ? saved.tabSize : 2,
    wordWrap: typeof saved.wordWrap === "boolean" ? saved.wordWrap : DEFAULT_SETTINGS.wordWrap,
    lineNumbers: typeof saved.lineNumbers === "boolean" ? saved.lineNumbers : DEFAULT_SETTINGS.lineNumbers,
    defaultProvider: saved.defaultProvider === "codex" ? "codex" : "gemini",
    streamOutput: typeof saved.streamOutput === "boolean" ? saved.streamOutput : DEFAULT_SETTINGS.streamOutput,
    gitRefreshInterval: saved.gitRefreshInterval === 0 || saved.gitRefreshInterval === 30 || saved.gitRefreshInterval === 60 ? saved.gitRefreshInterval : 15,
    checkUpdatesOnStartup: typeof saved.checkUpdatesOnStartup === "boolean" ? saved.checkUpdatesOnStartup : DEFAULT_SETTINGS.checkUpdatesOnStartup,
  };
  return cachedSettings;
}

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SETTINGS_KEY || event.key === "devpilot_theme") callback();
  };
  window.addEventListener(SETTINGS_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SETTINGS_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function updateSettings(patch: Partial<AppSettings>) {
  const next = { ...getSnapshot(), ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  localStorage.setItem("devpilot_theme", next.theme);
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export function resetSettings() {
  updateSettings(DEFAULT_SETTINGS);
}

export function useAppSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_SETTINGS);
  return { settings, updateSettings, resetSettings };
}
