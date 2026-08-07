import { useState } from "react";
import type { FormEvent } from "react";
import { Folder, X, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

const SUGGESTED_PATHS = [
  { name: "frontend", path: "/home/ksk/AI-Git-assistand/frontend" },
  { name: "AI-Git-assistand", path: "/home/ksk/AI-Git-assistand" },
];

export function RepositoryPicker({
  onOpen,
  isLoading,
}: {
  onOpen: (path: string) => void;
  isLoading: boolean;
}) {
  const [path, setPath] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = path.trim();
    if (trimmed) {
      onOpen(trimmed);
    }
  }

  function handleSelectSuggested(suggestedPath: string) {
    setPath(suggestedPath);
    onOpen(suggestedPath);
  }

  return (
    <div className="picker-container">
      <form className="repository-picker" onSubmit={handleSubmit}>
        <div className="input-wrapper">
          <Folder className="folder-icon" />
          <Input
            placeholder="/absolute/path/to/repository"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            aria-label="Repository path"
            autoComplete="off"
            spellCheck="false"
          />
          {path && (
            <button
              type="button"
              className="clear-btn"
              onClick={() => setPath("")}
              title="Clear input"
              aria-label="Clear path"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button
          type="submit"
          disabled={isLoading || path.trim().length === 0}
          className="submit-btn"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Opening...</span>
            </>
          ) : (
            <>
              <span>Open repository</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <div className="picker-presets pt-1">
        <span className="preset-label flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-400" />
          <span>Quick Suggestions:</span>
        </span>
        <div className="preset-chips">
          {SUGGESTED_PATHS.map((item) => (
            <button
              key={item.path}
              type="button"
              className="preset-chip flex items-center gap-1.5 hover:border-primary/50 hover:bg-primary/10 transition-all"
              onClick={() => handleSelectSuggested(item.path)}
              disabled={isLoading}
            >
              <Folder className="h-3 w-3 text-blue-400" />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
