import { useEffect, useState } from "react";
import { ACCENT_COLORS, useAppSettings } from "./useAppSettings";

export function useAppearance() {
  const preferences = useAppSettings();
  const { settings } = preferences;
  const [systemIsLight, setSystemIsLight] = useState(() => window.matchMedia?.("(prefers-color-scheme: light)")?.matches ?? false);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!media) return;
    const sync = () => setSystemIsLight(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  const resolvedTheme = settings.theme === "system" ? (systemIsLight ? "light" : "dark") : settings.theme;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.fontSize = `${settings.fontSize}px`;
    const accent = resolvedTheme === "light"
      ? ACCENT_COLORS.find(color => color.value === settings.accentColor)?.lightValue ?? settings.accentColor
      : settings.accentColor;
    for (const property of ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring"]) {
      root.style.setProperty(property, accent);
    }
    const accentForeground = resolvedTheme === "light" ? "#ffffff" : "#09090b";
    root.style.setProperty("--primary-foreground", accentForeground);
    root.style.setProperty("--sidebar-primary-foreground", accentForeground);
  }, [resolvedTheme, settings.fontSize, settings.accentColor]);

  return { ...preferences, resolvedTheme };
}
