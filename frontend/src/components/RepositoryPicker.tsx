import { useState } from "react";
import type { FormEvent } from "react";

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

  return (
    <form className="repository-picker" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="/absolute/path/to/repository"
        value={path}
        onChange={(event) => setPath(event.target.value)}
        aria-label="Repository path"
      />
      <button type="submit" disabled={isLoading || path.trim().length === 0}>
        {isLoading ? "Opening..." : "Open repository"}
      </button>
    </form>
  );
}
