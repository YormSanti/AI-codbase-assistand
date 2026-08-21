import { useState } from "react";
import type { FormEvent } from "react";
import { Folder, X, ArrowRight, Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

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

  async function handleBrowse() {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      setPath(selected);
      onOpen(selected);
    }
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

      {"__TAURI_INTERNALS__" in window && (
        <button
          type="button"
          className="preset-chip flex items-center gap-1.5 hover:border-primary/50 hover:bg-primary/10 transition-all"
          onClick={handleBrowse}
          disabled={isLoading}
        >
          <Folder className="h-3.5 w-3.5 text-blue-400" />
          <span>Browse folders</span>
        </button>
      )}
    </div>
  );
}
