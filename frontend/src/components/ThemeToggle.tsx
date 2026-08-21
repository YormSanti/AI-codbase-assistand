import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("devpilot_theme");
    if (saved === "light" || saved === "dark") return saved;
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)")?.matches
      ? "light"
      : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("devpilot_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-label="Toggle visual theme"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "7px 14px",
        borderRadius: "99px",
        border: `1.5px solid ${isDark ? "rgba(139,92,246,0.45)" : "rgba(234,179,8,0.45)"}`,
        background: isDark
          ? "rgba(139,92,246,0.12)"
          : "rgba(234,179,8,0.12)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        backdropFilter: "blur(8px)",
        outline: "none",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = isDark ? "rgba(139,92,246,0.22)" : "rgba(234,179,8,0.22)";
        el.style.boxShadow = isDark
          ? "0 0 16px rgba(139,92,246,0.3)"
          : "0 0 16px rgba(234,179,8,0.3)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = isDark ? "rgba(139,92,246,0.12)" : "rgba(234,179,8,0.12)";
        el.style.boxShadow = "none";
      }}
    >
      {/* Animated icon */}
      <span style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "18px",
        height: "18px",
        color: isDark ? "#a78bfa" : "#ca8a04",
        transition: "transform 0.3s ease",
      }}>
        {isDark
          ? <Sun style={{ width: "16px", height: "16px" }} />
          : <Moon style={{ width: "16px", height: "16px" }} />
        }
      </span>

      {/* Label */}
      <span style={{
        fontSize: "12px",
        fontWeight: "700",
        letterSpacing: "0.3px",
        color: isDark ? "#c4b5fd" : "#a16207",
        fontFamily: "var(--font-body)",
        userSelect: "none",
      }}>
        {isDark ? "Light" : "Dark"}
      </span>

      {/* Mode indicator dot */}
      <span style={{
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: isDark ? "#a78bfa" : "#ca8a04",
        boxShadow: isDark ? "0 0 6px #a78bfa" : "0 0 6px #ca8a04",
        flexShrink: 0,
      }} />
    </button>
  );
}
