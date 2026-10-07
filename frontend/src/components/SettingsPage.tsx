import { useState, version as reactVersion } from "react";
import type { ReactNode } from "react";
import { AlertCircle, Bell, Bot, Check, Code2, GitBranch, Info, Layout, Monitor, Moon, RotateCcw, Settings, Sun } from "lucide-react";
import desktopConfig from "../../src-tauri/tauri.conf.json";
import { ACCENT_COLORS } from "../hooks/useAppSettings";
import type { AppSettings } from "../hooks/useAppSettings";
import { useAppearance } from "../hooks/useAppearance";
import { Button } from "./ui/button";

const sections = [
  { id: "Appearance", icon: Layout, description: "Make the workspace feel like yours." },
  { id: "Editor", icon: Code2, description: "Choose how source code appears in the file preview." },
  { id: "AI Agent", icon: Bot, description: "Set defaults for new AI conversations." },
  { id: "Git", icon: GitBranch, description: "Keep the Git changes page up to date." },
  { id: "Notifications", icon: Bell, description: "Manage desktop update prompts." },
  { id: "About", icon: Info, description: "Application information." },
] as const;
type Section = typeof sections[number]["id"];
const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({ id, label, description, children }: { id: string; label: string; description: string; children: ReactNode }) {
  return <div className="space-y-3">
    <div><label htmlFor={id} className="text-sm font-medium">{label}</label><p id={`${id}-description`} className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>
    {children}
  </div>;
}

function Toggle({ id, label, description, checked, onChange }: { id: string; label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-6">
    <div><span id={`${id}-label`} className="text-sm font-medium">{label}</span><p id={`${id}-description`} className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>
    <button id={id} type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${checked ? "border-primary bg-primary" : "border-input bg-muted"}`}>
      <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-background shadow-sm transition-transform ${checked ? "left-0.5 translate-x-5" : "left-0.5"}`} />
    </button>
  </div>;
}

export function SettingsPage() {
  const [selectedSection, setSelectedSection] = useState<Section>("Appearance");
  const [saveError, setSaveError] = useState<string | null>(null);
  const { settings, updateSettings, resetSettings } = useAppearance();
  const selected = sections.find(section => section.id === selectedSection)!;
  const save = (patch: Partial<AppSettings>) => {
    try { updateSettings(patch); setSaveError(null); }
    catch { setSaveError("Could not save settings. Check that local storage is available and try again."); }
  };

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-5 text-foreground lg:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><Settings className="h-6 w-6 text-primary" />Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Customize your workspace. Changes save automatically on this device.</p></div>
      <Button variant="outline" onClick={() => {
        try { resetSettings(); setSaveError(null); }
        catch { setSaveError("Could not reset settings. Check that local storage is available and try again."); }
      }}><RotateCcw className="h-4 w-4" />Reset preferences</Button>
    </header>
    {saveError && <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{saveError}</p>}
    <div className="grid min-w-0 gap-6 md:grid-cols-[190px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="grid content-start grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-1">
        {sections.map(({ id, icon: Icon }) => <button key={id} type="button" onClick={() => setSelectedSection(id)} aria-current={selectedSection === id ? "page" : undefined}
          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedSection === id ? "border-primary/25 bg-primary/10 font-medium text-primary" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
          <Icon className="h-4 w-4 shrink-0" />{id}
        </button>)}
      </nav>
      <section aria-labelledby="settings-section-title" className="min-w-0 overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-5 py-4 sm:px-6"><h2 id="settings-section-title" className="text-lg font-semibold">{selected.id}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.description}</p></div>
        <div className="space-y-7 p-5 sm:p-6">
          {selectedSection === "Appearance" && <>
            <fieldset><legend className="mb-3 text-sm font-medium">Theme</legend><div className="grid grid-cols-3 gap-2">
              {([{ value: "dark", label: "Dark", icon: Moon }, { value: "light", label: "Light", icon: Sun }, { value: "system", label: "System", icon: Monitor }] as const).map(({ value, label, icon: Icon }) =>
                <button key={value} type="button" aria-pressed={settings.theme === value} onClick={() => save({ theme: value })}
                  className={`flex flex-col items-center gap-2 rounded-lg border px-2 py-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:justify-center ${settings.theme === value ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}><Icon className="h-4 w-4" />{label}</button>
              )}</div></fieldset>
            <Field id="interface-font-size" label={`Interface font size: ${settings.fontSize}px`} description="Adjusts the scale of the workspace interface.">
              <input id="interface-font-size" type="range" min="12" max="20" step="1" value={settings.fontSize} onChange={event => save({ fontSize: Number(event.target.value) })} aria-describedby="interface-font-size-description" className="w-full accent-primary" />
            </Field>
            <fieldset><legend className="mb-3 text-sm font-medium">Sidebar position</legend><div className="flex gap-2">
              {(["left", "right"] as const).map(position => <Button key={position} variant={settings.sidebarPosition === position ? "default" : "outline"} aria-pressed={settings.sidebarPosition === position} onClick={() => save({ sidebarPosition: position })}>{position === "left" ? "Left" : "Right"}</Button>)}
            </div></fieldset>
            <fieldset><legend className="mb-3 text-sm font-medium">Accent color</legend><div className="flex flex-wrap gap-3">
              {ACCENT_COLORS.map(color => <button key={color.value} type="button" aria-label={`${color.name} accent`} aria-pressed={settings.accentColor === color.value} title={color.name} onClick={() => save({ accentColor: color.value })}
                style={{ backgroundColor: color.value }} className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${settings.accentColor === color.value ? "border-foreground" : "border-transparent"}`}>{settings.accentColor === color.value && <Check className="h-4 w-4" />}</button>)}
            </div></fieldset>
          </>}
          {selectedSection === "Editor" && <>
            <Field id="preview-tab-size" label="Tab size" description="Number of spaces used to display a tab in the source preview.">
              <select id="preview-tab-size" value={settings.tabSize} onChange={event => save({ tabSize: Number(event.target.value) as AppSettings["tabSize"] })} className={inputClass} aria-describedby="preview-tab-size-description"><option value="2">2 spaces</option><option value="4">4 spaces</option><option value="8">8 spaces</option></select>
            </Field>
            <Toggle id="preview-word-wrap" label="Word wrap" description="Wrap long source lines to fit the file preview." checked={settings.wordWrap} onChange={wordWrap => save({ wordWrap })} />
            <Toggle id="preview-line-numbers" label="Line numbers" description="Show line numbers beside source code." checked={settings.lineNumbers} onChange={lineNumbers => save({ lineNumbers })} />
          </>}
          {selectedSection === "AI Agent" && <>
            <Field id="default-ai-provider" label="Default provider" description="New conversations start with this provider. You can change it in the chat composer.">
              <select id="default-ai-provider" value={settings.defaultProvider} onChange={event => save({ defaultProvider: event.target.value as AppSettings["defaultProvider"] })} className={inputClass} aria-describedby="default-ai-provider-description"><option value="gemini">Gemini</option><option value="codex">Codex</option></select>
            </Field>
            <Toggle id="ai-stream-output" label="Stream responses" description="Show desktop AI responses as they arrive. When disabled, display the completed response." checked={settings.streamOutput} onChange={streamOutput => save({ streamOutput })} />
            <p className="rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">Gemini and Codex use their existing sign-in and model settings. Configure models and generation parameters with your provider.</p>
          </>}
          {selectedSection === "Git" && <Field id="git-refresh-interval" label="Status refresh interval" description="Refresh local Git status and the selected diff while the Git page is visible. Automatic mode also refreshes when the window regains focus.">
            <select id="git-refresh-interval" value={settings.gitRefreshInterval} onChange={event => save({ gitRefreshInterval: Number(event.target.value) as AppSettings["gitRefreshInterval"] })} className={inputClass} aria-describedby="git-refresh-interval-description"><option value="0">Manual only</option><option value="15">Every 15 seconds</option><option value="30">Every 30 seconds</option><option value="60">Every minute</option></select>
          </Field>}
          {selectedSection === "Notifications" && <Toggle id="startup-update-check" label="Check for updates on startup" description="The desktop app checks for updates shortly after startup and asks before installing an available update." checked={settings.checkUpdatesOnStartup} onChange={checkUpdatesOnStartup => save({ checkUpdatesOnStartup })} />}
          {selectedSection === "About" && <>
            <div className="flex items-center gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bot className="h-7 w-7" /></div><div><h3 className="font-semibold">{desktopConfig.productName}</h3><p className="text-sm text-muted-foreground">Developer intelligence workspace</p></div></div>
            <dl className="divide-y rounded-lg border text-sm">{[
              ["Application version", desktopConfig.version], ["React version", reactVersion],
              ["Runtime", "__TAURI_INTERNALS__" in window ? "Desktop (Tauri)" : "Web browser"],
              ["AI providers", "Gemini and Codex"],
            ].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 px-4 py-3"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl>
          </>}
        </div>
      </section>
    </div>
  </div>;
}
