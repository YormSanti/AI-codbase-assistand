import { useEffect, useState } from "react";
import { useAppSettings } from "../hooks/useAppSettings";

export interface EditorPreferences {
  fontSize: number;
  fontFamily: string;
  tabSize: 2 | 4 | 8;
  wordWrap: boolean;
  lineNumbers: boolean;
  minimap: boolean;
  lineHeight: number;
  bracketMatching: boolean;
  autoCloseBrackets: boolean;
  cursorStyle: "line" | "block" | "underline";
  cursorBlink: "blink" | "smooth" | "solid";
  formatOnSave: boolean;
  trimTrailingWhitespace: boolean;
  terminalFontSize: number;
  terminalScrollback: number;
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
  tabSize: 2,
  wordWrap: false,
  lineNumbers: true,
  minimap: true,
  lineHeight: 1.65,
  bracketMatching: true,
  autoCloseBrackets: true,
  cursorStyle: "line",
  cursorBlink: "smooth",
  formatOnSave: false,
  trimTrailingWhitespace: true,
  terminalFontSize: 13,
  terminalScrollback: 10000,
};

const STORAGE_KEY = "ifrog_editor_preferences";

export function loadEditorPreferences(): EditorPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EDITOR_PREFERENCES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_EDITOR_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_EDITOR_PREFERENCES;
  }
}

export function saveEditorPreferences(prefs: EditorPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore quota errors
  }
}

export function useEditorPreferences() {
  const { settings, updateSettings } = useAppSettings();
  const [preferences, setPreferences] = useState<EditorPreferences>(() => {
    const loaded = loadEditorPreferences();
    return {
      ...loaded,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap,
      lineNumbers: settings.lineNumbers,
    };
  });

  const updatePreference = <K extends keyof EditorPreferences>(key: K, value: EditorPreferences[K]) => {
    setPreferences(prev => {
      const next = { ...prev, [key]: value };
      saveEditorPreferences(next);
      return next;
    });

    // Synchronize common settings with global app settings
    if (key === "tabSize" && (value === 2 || value === 4 || value === 8)) {
      updateSettings({ tabSize: value });
    } else if (key === "wordWrap" && typeof value === "boolean") {
      updateSettings({ wordWrap: value });
    } else if (key === "lineNumbers" && typeof value === "boolean") {
      updateSettings({ lineNumbers: value });
    }
  };

  const resetPreferences = () => {
    setPreferences(DEFAULT_EDITOR_PREFERENCES);
    saveEditorPreferences(DEFAULT_EDITOR_PREFERENCES);
    updateSettings({
      tabSize: DEFAULT_EDITOR_PREFERENCES.tabSize,
      wordWrap: DEFAULT_EDITOR_PREFERENCES.wordWrap,
      lineNumbers: DEFAULT_EDITOR_PREFERENCES.lineNumbers,
    });
  };

  // Sync when global settings change
  useEffect(() => {
    setPreferences(prev => ({
      ...prev,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap,
      lineNumbers: settings.lineNumbers,
    }));
  }, [settings.tabSize, settings.wordWrap, settings.lineNumbers]);

  return { preferences, updatePreference, resetPreferences };
}
