import { useState } from "react";
import {
  ArrowLeft,
  Code2,
  ExternalLink,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Settings,
  SquareTerminal,
  Type,
  WrapText,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  type EditorPreferences,
  useEditorPreferences,
} from "./editorSettings";
import "./EditorSettingsPage.css";

interface Props {
  active: boolean;
  onReturn: () => void;
  onNavigateToGlobalSettings?: () => void;
}

type SettingsCategory = "all" | "editor" | "cursor" | "files" | "terminal";

const CATEGORIES: { id: SettingsCategory; label: string; icon: typeof Type }[] = [
  { id: "all", label: "All Settings", icon: Settings },
  { id: "editor", label: "Text Editor", icon: Type },
  { id: "cursor", label: "Cursor & Editing", icon: Code2 },
  { id: "files", label: "Files & Formatting", icon: WrapText },
  { id: "terminal", label: "Terminal", icon: SquareTerminal },
];

const FONT_PRESETS = [
  { label: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
  { label: "Fira Code", value: "'Fira Code', monospace" },
  { label: "Consolas", value: "Consolas, 'Courier New', monospace" },
  { label: "Monaco / Menlo", value: "Monaco, Menlo, monospace" },
  { label: "Source Code Pro", value: "'Source Code Pro', monospace" },
  { label: "System Monospace", value: "ui-monospace, monospace" },
];

const PREVIEW_CODE_SNIPPET = `// IFROG Code Editor Live Preview
import { useState, useEffect } from "react";

export function useCodeCounter(initial = 0) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    console.log(\`Counter updated: \${count}\`);
  }, [count]);

  return { count, increment: () => setCount(c => c + 1) };
}`;

/** Words each setting is found by; the section headers and the rows both use this list. */
const SEARCHABLE_SETTINGS = {
  fontSize: { category: "editor", terms: ["Font Size", "Controls the font size in pixels.", "text", "zoom", "scale"] },
  fontFamily: { category: "editor", terms: ["Font Family", "Controls the font family.", "font", "typeface", "mono"] },
  lineHeight: { category: "editor", terms: ["Line Height", "Controls the line height multiplier.", "spacing", "vertical"] },
  tabSize: { category: "editor", terms: ["Tab Size", "The number of spaces a tab is equal to.", "indent", "spaces"] },
  wordWrap: { category: "editor", terms: ["Word Wrap", "Controls how lines should wrap.", "break", "soft wrap"] },
  lineNumbers: { category: "editor", terms: ["Line Numbers", "Controls the display of line numbers.", "gutter"] },
  minimap: { category: "editor", terms: ["Minimap", "Controls whether the minimap is shown.", "overview", "scroll"] },
  cursorStyle: { category: "cursor", terms: ["Cursor Style", "Controls the cursor style.", "caret", "pointer", "line", "block"] },
  cursorBlinking: { category: "cursor", terms: ["Cursor Blinking", "Control the cursor animation style.", "blink", "smooth", "animation"] },
  bracketMatching: { category: "cursor", terms: ["Bracket Pair Matching", "Highlights matching brackets when cursor is near.", "parentheses", "curly", "brackets"] },
  autoCloseBrackets: { category: "cursor", terms: ["Auto Closing Brackets", "Automatically insert closing brackets and quotes.", "auto close", "quotes"] },
  formatOnSave: { category: "files", terms: ["Format On Save", "Format a file on save.", "prettier", "lint", "cleanup"] },
  trimTrailingWhitespace: { category: "files", terms: ["Trim Trailing Whitespace", "Remove trailing spaces when saving.", "cleanup", "spaces", "trim"] },
  terminalFontSize: { category: "terminal", terms: ["Terminal Font Size", "Controls font size in pixels for the integrated terminal.", "cli", "console", "shell", "terminal"] },
  terminalScrollback: { category: "terminal", terms: ["Terminal Scrollback", "Maximum number of lines kept in terminal buffer.", "buffer", "history"] },
} satisfies Record<string, { category: Exclude<SettingsCategory, "all">; terms: string[] }>;

type SettingId = keyof typeof SEARCHABLE_SETTINGS;

function matchesSearch(query: string, id: SettingId): boolean {
  return !query || SEARCHABLE_SETTINGS[id].terms.some(term => term.toLowerCase().includes(query));
}

export function EditorSettingsPage({ active: _active, onReturn, onNavigateToGlobalSettings }: Props) {
  const { preferences, updatePreference, resetPreferences } = useEditorPreferences();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("all");

  const handleReset = () => {
    resetPreferences();
    toast.success("Editor settings reset to defaults");
  };

  const q = searchQuery.toLowerCase().trim();

  const shows = (id: SettingId) => matchesSearch(q, id);
  const showSection = (category: Exclude<SettingsCategory, "all">) =>
    (activeCategory === "all" || activeCategory === category)
    && (Object.keys(SEARCHABLE_SETTINGS) as SettingId[]).some(id => SEARCHABLE_SETTINGS[id].category === category && shows(id));
  const showEditorSection = showSection("editor");
  const showCursorSection = showSection("cursor");
  const showFilesSection = showSection("files");
  const showTerminalSection = showSection("terminal");

  const hasAnyResults = showEditorSection || showCursorSection || showFilesSection || showTerminalSection;

  return (
    <div className="editor-settings-page" role="region" aria-label="Editor Settings">
      <header className="editor-git-header">
        <div className="editor-git-tab">
          <Settings size={15} />
          <span>Editor Settings</span>
        </div>
        <div className="editor-git-header-actions">
          <button
            type="button"
            onClick={handleReset}
            title="Reset all editor preferences to defaults"
            aria-label="Reset preferences"
          >
            <RotateCcw size={14} />
            <span>Reset Defaults</span>
          </button>

          {onNavigateToGlobalSettings && (
            <button
              type="button"
              onClick={onNavigateToGlobalSettings}
              title="Open global IFROG app settings (AI keys, Git config, App scale)"
              aria-label="Global IFROG Settings"
            >
              <ExternalLink size={14} />
              <span>Global IFROG Settings</span>
            </button>
          )}

          <button
            type="button"
            onClick={onReturn}
            aria-label="Back to code"
            title="Return to code editor"
          >
            <ArrowLeft size={14} />
            <span>Back to code</span>
          </button>
        </div>
      </header>

      <div className="editor-settings-body">
        {/* Search Toolbar */}
        <div className="editor-settings-toolbar">
          <div className="editor-settings-search-box">
            <Search size={15} className="editor-settings-search-icon" />
            <input
              type="text"
              className="editor-settings-search-input"
              placeholder="Search editor settings (e.g. font, wrap, tabs, cursor, terminal)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search Settings"
            />
            {searchQuery && (
              <button
                type="button"
                className="editor-settings-clear-btn"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="editor-settings-categories" role="tablist" aria-label="Settings categories">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`editor-settings-cat-btn ${isSelected ? "is-selected" : ""}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <Icon size={14} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Main Content + Live Preview */}
        <div className="editor-settings-layout">
          <div className="editor-settings-content">
            {!hasAnyResults && (
              <div className="editor-settings-empty">
                <Search size={32} />
                <p>No editor settings found matching &ldquo;{searchQuery}&rdquo;</p>
                <button
                  type="button"
                  className="editor-settings-btn-secondary"
                  onClick={() => setSearchQuery("")}
                >
                  Clear search
                </button>
              </div>
            )}

            {/* TEXT EDITOR SETTINGS */}
            {showEditorSection && (
              <section className="editor-settings-section" aria-labelledby="section-editor">
                <h3 id="section-editor" className="editor-settings-section-title">
                  <Type size={16} />
                  <span>Text Editor</span>
                </h3>

                {shows("fontSize") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <label htmlFor="pref-font-size" className="editor-settings-label">
                        Editor: Font Size
                      </label>
                      <p className="editor-settings-desc">
                        Controls the font size in pixels for the code editor surface.
                      </p>
                    </div>
                    <div className="editor-settings-control editor-settings-stepper">
                      <button
                        type="button"
                        aria-label="Decrease font size"
                        disabled={preferences.fontSize <= 10}
                        onClick={() => updatePreference("fontSize", Math.max(10, preferences.fontSize - 1))}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        id="pref-font-size"
                        type="number"
                        min={10}
                        max={32}
                        value={preferences.fontSize}
                        onChange={e => {
                          const val = Number.parseInt(e.target.value, 10);
                          if (!Number.isNaN(val) && val >= 10 && val <= 32) {
                            updatePreference("fontSize", val);
                          }
                        }}
                      />
                      <span>px</span>
                      <button
                        type="button"
                        aria-label="Increase font size"
                        disabled={preferences.fontSize >= 32}
                        onClick={() => updatePreference("fontSize", Math.min(32, preferences.fontSize + 1))}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {shows("fontFamily") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <label htmlFor="pref-font-family" className="editor-settings-label">
                        Editor: Font Family
                      </label>
                      <p className="editor-settings-desc">
                        Controls the monospace font used for rendering code.
                      </p>
                    </div>
                    <div className="editor-settings-control">
                      <select
                        id="pref-font-family"
                        className="editor-settings-select"
                        value={
                          FONT_PRESETS.some(p => p.value === preferences.fontFamily)
                            ? preferences.fontFamily
                            : "custom"
                        }
                        onChange={e => {
                          if (e.target.value !== "custom") {
                            updatePreference("fontFamily", e.target.value);
                          }
                        }}
                      >
                        {FONT_PRESETS.map(p => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                        <option value="custom">Custom Font...</option>
                      </select>
                      <input
                        type="text"
                        className="editor-settings-input mt-2"
                        placeholder="e.g. 'Fira Code', Menlo, monospace"
                        value={preferences.fontFamily}
                        onChange={e => updatePreference("fontFamily", e.target.value)}
                        aria-label="Custom Font Family"
                      />
                    </div>
                  </div>
                )}

                {shows("lineHeight") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <label htmlFor="pref-line-height" className="editor-settings-label">
                        Editor: Line Height
                      </label>
                      <p className="editor-settings-desc">
                        Controls the vertical spacing multiplier between lines of code (1.2 to 2.4).
                      </p>
                    </div>
                    <div className="editor-settings-control editor-settings-slider-wrap">
                      <input
                        id="pref-line-height"
                        type="range"
                        min={1.2}
                        max={2.4}
                        step={0.05}
                        value={preferences.lineHeight}
                        onChange={e => updatePreference("lineHeight", Number.parseFloat(e.target.value))}
                      />
                      <span className="editor-settings-val-badge">
                        {preferences.lineHeight.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {shows("tabSize") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <span id="pref-tab-size-label" className="editor-settings-label">
                        Editor: Tab Size
                      </span>
                      <p className="editor-settings-desc">
                        The number of spaces equivalent to one indentation tab.
                      </p>
                    </div>
                    <div
                      className="editor-settings-control editor-settings-segmented"
                      role="radiogroup"
                      aria-labelledby="pref-tab-size-label"
                    >
                      {[2, 4, 8].map(size => (
                        <button
                          key={size}
                          type="button"
                          role="radio"
                          aria-checked={preferences.tabSize === size}
                          className={`editor-settings-segment-btn ${preferences.tabSize === size ? "is-active" : ""}`}
                          onClick={() => updatePreference("tabSize", size as 2 | 4 | 8)}
                        >
                          {size} spaces
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {shows("wordWrap") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <span id="pref-word-wrap-label" className="editor-settings-label">
                        Editor: Word Wrap
                      </span>
                      <p className="editor-settings-desc">
                        Wrap long lines to fit the editor window without horizontal scrolling.
                      </p>
                    </div>
                    <div className="editor-settings-control">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={preferences.wordWrap}
                        aria-labelledby="pref-word-wrap-label"
                        className={`editor-settings-switch ${preferences.wordWrap ? "is-on" : ""}`}
                        onClick={() => updatePreference("wordWrap", !preferences.wordWrap)}
                      >
                        <span className="editor-settings-switch-thumb" />
                      </button>
                    </div>
                  </div>
                )}

                {shows("lineNumbers") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <span id="pref-line-numbers-label" className="editor-settings-label">
                        Editor: Line Numbers
                      </span>
                      <p className="editor-settings-desc">
                        Show or hide line number indicators in the editor gutter.
                      </p>
                    </div>
                    <div className="editor-settings-control">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={preferences.lineNumbers}
                        aria-labelledby="pref-line-numbers-label"
                        className={`editor-settings-switch ${preferences.lineNumbers ? "is-on" : ""}`}
                        onClick={() => updatePreference("lineNumbers", !preferences.lineNumbers)}
                      >
                        <span className="editor-settings-switch-thumb" />
                      </button>
                    </div>
                  </div>
                )}

                {shows("minimap") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <span id="pref-minimap-label" className="editor-settings-label">
                        Editor: Minimap
                      </span>
                      <p className="editor-settings-desc">
                        Show a high-level visual code minimap preview on the right side of the editor.
                      </p>
                    </div>
                    <div className="editor-settings-control">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={preferences.minimap}
                        aria-labelledby="pref-minimap-label"
                        className={`editor-settings-switch ${preferences.minimap ? "is-on" : ""}`}
                        onClick={() => updatePreference("minimap", !preferences.minimap)}
                      >
                        <span className="editor-settings-switch-thumb" />
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* CURSOR & EDITING SETTINGS */}
            {showCursorSection && (
              <section className="editor-settings-section" aria-labelledby="section-cursor">
                <h3 id="section-cursor" className="editor-settings-section-title">
                  <Code2 size={16} />
                  <span>Cursor & Editing</span>
                </h3>

                {shows("cursorStyle") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <span id="pref-cursor-style-label" className="editor-settings-label">
                        Cursor: Style
                      </span>
                      <p className="editor-settings-desc">
                        Select the appearance of the text insertion cursor.
                      </p>
                    </div>
                    <div
                      className="editor-settings-control editor-settings-segmented"
                      role="radiogroup"
                      aria-labelledby="pref-cursor-style-label"
                    >
                      {[
                        { id: "line", label: "Line (|)" },
                        { id: "block", label: "Block (█)" },
                        { id: "underline", label: "Underline (_)" },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={preferences.cursorStyle === opt.id}
                          className={`editor-settings-segment-btn ${preferences.cursorStyle === opt.id ? "is-active" : ""}`}
                          onClick={() => updatePreference("cursorStyle", opt.id as EditorPreferences["cursorStyle"])}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {shows("cursorBlinking") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <span id="pref-cursor-blink-label" className="editor-settings-label">
                        Cursor: Blinking Animation
                      </span>
                      <p className="editor-settings-desc">
                        Animation behavior of the cursor when idle in the editor.
                      </p>
                    </div>
                    <div
                      className="editor-settings-control editor-settings-segmented"
                      role="radiogroup"
                      aria-labelledby="pref-cursor-blink-label"
                    >
                      {[
                        { id: "smooth", label: "Smooth" },
                        { id: "blink", label: "Blink" },
                        { id: "solid", label: "Solid" },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={preferences.cursorBlink === opt.id}
                          className={`editor-settings-segment-btn ${preferences.cursorBlink === opt.id ? "is-active" : ""}`}
                          onClick={() => updatePreference("cursorBlink", opt.id as EditorPreferences["cursorBlink"])}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {shows("bracketMatching") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <span id="pref-bracket-match-label" className="editor-settings-label">
                        Editor: Bracket Pair Matching
                      </span>
                      <p className="editor-settings-desc">
                        Highlight matching opening and closing brackets when the cursor is positioned near them.
                      </p>
                    </div>
                    <div className="editor-settings-control">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={preferences.bracketMatching}
                        aria-labelledby="pref-bracket-match-label"
                        className={`editor-settings-switch ${preferences.bracketMatching ? "is-on" : ""}`}
                        onClick={() => updatePreference("bracketMatching", !preferences.bracketMatching)}
                      >
                        <span className="editor-settings-switch-thumb" />
                      </button>
                    </div>
                  </div>
                )}

                {shows("autoCloseBrackets") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <span id="pref-auto-close-label" className="editor-settings-label">
                        Editor: Auto Closing Brackets & Quotes
                      </span>
                      <p className="editor-settings-desc">
                        Automatically insert matching closing quotes and bracket pairs when typing opening characters.
                      </p>
                    </div>
                    <div className="editor-settings-control">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={preferences.autoCloseBrackets}
                        aria-labelledby="pref-auto-close-label"
                        className={`editor-settings-switch ${preferences.autoCloseBrackets ? "is-on" : ""}`}
                        onClick={() => updatePreference("autoCloseBrackets", !preferences.autoCloseBrackets)}
                      >
                        <span className="editor-settings-switch-thumb" />
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* FILES & FORMATTING SETTINGS */}
            {showFilesSection && (
              <section className="editor-settings-section" aria-labelledby="section-files">
                <h3 id="section-files" className="editor-settings-section-title">
                  <WrapText size={16} />
                  <span>Files & Formatting</span>
                </h3>

                {shows("formatOnSave") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <span id="pref-format-save-label" className="editor-settings-label">
                        Editor: Format on Save
                      </span>
                      <p className="editor-settings-desc">
                        Automatically format code documents using configured formatters whenever saved.
                      </p>
                    </div>
                    <div className="editor-settings-control">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={preferences.formatOnSave}
                        aria-labelledby="pref-format-save-label"
                        className={`editor-settings-switch ${preferences.formatOnSave ? "is-on" : ""}`}
                        onClick={() => updatePreference("formatOnSave", !preferences.formatOnSave)}
                      >
                        <span className="editor-settings-switch-thumb" />
                      </button>
                    </div>
                  </div>
                )}

                {shows("trimTrailingWhitespace") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <span id="pref-trim-whitespace-label" className="editor-settings-label">
                        Files: Trim Trailing Whitespace
                      </span>
                      <p className="editor-settings-desc">
                        Remove unnecessary trailing whitespace at the ends of lines when saving files.
                      </p>
                    </div>
                    <div className="editor-settings-control">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={preferences.trimTrailingWhitespace}
                        aria-labelledby="pref-trim-whitespace-label"
                        className={`editor-settings-switch ${preferences.trimTrailingWhitespace ? "is-on" : ""}`}
                        onClick={() => updatePreference("trimTrailingWhitespace", !preferences.trimTrailingWhitespace)}
                      >
                        <span className="editor-settings-switch-thumb" />
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* TERMINAL SETTINGS */}
            {showTerminalSection && (
              <section className="editor-settings-section" aria-labelledby="section-terminal">
                <h3 id="section-terminal" className="editor-settings-section-title">
                  <SquareTerminal size={16} />
                  <span>Integrated Terminal</span>
                </h3>

                {shows("terminalFontSize") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <label htmlFor="pref-term-font-size" className="editor-settings-label">
                        Terminal: Font Size
                      </label>
                      <p className="editor-settings-desc">
                        Controls the font size in pixels for the integrated terminal drawer.
                      </p>
                    </div>
                    <div className="editor-settings-control editor-settings-stepper">
                      <button
                        type="button"
                        aria-label="Decrease terminal font size"
                        disabled={preferences.terminalFontSize <= 10}
                        onClick={() => updatePreference("terminalFontSize", Math.max(10, preferences.terminalFontSize - 1))}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        id="pref-term-font-size"
                        type="number"
                        min={10}
                        max={26}
                        value={preferences.terminalFontSize}
                        onChange={e => {
                          const val = Number.parseInt(e.target.value, 10);
                          if (!Number.isNaN(val) && val >= 10 && val <= 26) {
                            updatePreference("terminalFontSize", val);
                          }
                        }}
                      />
                      <span>px</span>
                      <button
                        type="button"
                        aria-label="Increase terminal font size"
                        disabled={preferences.terminalFontSize >= 26}
                        onClick={() => updatePreference("terminalFontSize", Math.min(26, preferences.terminalFontSize + 1))}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {shows("terminalScrollback") && (
                  <div className="editor-settings-row">
                    <div className="editor-settings-meta">
                      <label htmlFor="pref-term-scrollback" className="editor-settings-label">
                        Terminal: Scrollback Lines
                      </label>
                      <p className="editor-settings-desc">
                        The maximum number of previous command output lines retained in memory.
                      </p>
                    </div>
                    <div className="editor-settings-control">
                      <input
                        id="pref-term-scrollback"
                        type="number"
                        className="editor-settings-input"
                        style={{ width: "130px" }}
                        min={1000}
                        max={50000}
                        step={1000}
                        value={preferences.terminalScrollback}
                        onChange={e => {
                          const val = Number.parseInt(e.target.value, 10);
                          if (!Number.isNaN(val) && val >= 1000 && val <= 100000) {
                            updatePreference("terminalScrollback", val);
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Note about Global IFROG settings */}
            <div className="editor-settings-footer-card">
              <div className="editor-settings-footer-text">
                <strong>Need global IFROG settings?</strong>
                <p>
                  AI API keys, LLM providers, Git identity, and application scale are managed in
                  the Global IFROG Settings page.
                </p>
              </div>
              {onNavigateToGlobalSettings && (
                <button
                  type="button"
                  className="editor-settings-btn-primary"
                  onClick={onNavigateToGlobalSettings}
                >
                  <ExternalLink size={14} />
                  <span>Open Global IFROG Settings</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Code Preview Sidebar */}
          <aside className="editor-settings-preview-aside" aria-label="Live Code Preview">
            <div className="editor-settings-preview-card">
              <div className="editor-settings-preview-header">
                <span className="editor-settings-preview-title">Live Preview</span>
                <span className="editor-settings-preview-badge">TypeScript</span>
              </div>

              <div
                className="editor-settings-preview-surface"
                style={{
                  fontFamily: preferences.fontFamily,
                  fontSize: `${preferences.fontSize}px`,
                  lineHeight: preferences.lineHeight,
                  tabSize: preferences.tabSize,
                  whiteSpace: preferences.wordWrap ? "pre-wrap" : "pre",
                  wordBreak: preferences.wordWrap ? "break-word" : "normal",
                }}
              >
                {PREVIEW_CODE_SNIPPET.split("\n").map((line, idx) => (
                  <div key={idx} className="editor-settings-preview-line">
                    {preferences.lineNumbers && (
                      <span className="editor-settings-preview-linenum" aria-hidden="true">
                        {idx + 1}
                      </span>
                    )}
                    <span className="editor-settings-preview-code">
                      {line}
                      {idx === 4 && (
                        <span
                          className={`editor-settings-preview-cursor cursor-${preferences.cursorStyle} blink-${preferences.cursorBlink}`}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="editor-settings-preview-footer">
                <span>Tab: {preferences.tabSize} spaces</span>
                <span>Wrap: {preferences.wordWrap ? "On" : "Off"}</span>
                <span>Size: {preferences.fontSize}px</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
