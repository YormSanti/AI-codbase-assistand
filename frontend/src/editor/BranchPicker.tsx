import { useEffect, useMemo, useState } from "react";
import { Popover } from "radix-ui";
import { Check, ChevronDown, GitBranch, GitBranchPlus, LoaderCircle } from "lucide-react";
import { gitApi } from "../api/gitApi";
import type { BranchInfo } from "../types/git";
import { formatRelativeTime } from "../lib/time";

interface Props {
  repositoryId: number;
  /** Label for the trigger: the current branch, "Detached HEAD", and so on. */
  label: string;
  current: string | null;
  disabled?: boolean;
  /** Each returns true when the switch or creation succeeded; the picker then closes. */
  onSwitch: (name: string) => Promise<boolean>;
  onCreate: (name: string) => Promise<boolean>;
}

const VALID_NAME = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/** Popover listing local branches with a filter that doubles as the name for a new branch. */
export function BranchPicker({ repositoryId, label, current, disabled = false, onSwitch, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [branches, setBranches] = useState<BranchInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    let current = true;
    setBranches(null);
    setError(null);
    setQuery("");
    setIndex(0);
    gitApi.listBranches(repositoryId)
      .then(list => { if (current) setBranches(list.branches); })
      .catch(reason => { if (current) setError(reason instanceof Error ? reason.message : "Could not list branches."); });
    return () => { current = false; };
  }, [open, repositoryId]);

  const trimmed = query.trim();
  const matches = useMemo(() => (branches ?? []).filter(branch => branch.name.toLowerCase().includes(trimmed.toLowerCase())), [branches, trimmed]);
  const canCreate = Boolean(trimmed) && VALID_NAME.test(trimmed) && !trimmed.includes("..") && !trimmed.endsWith(".lock") && !trimmed.endsWith("/")
    && !(branches ?? []).some(branch => branch.name === trimmed);
  const options = [...matches.map(branch => ({ kind: "switch" as const, name: branch.name })), ...(canCreate ? [{ kind: "create" as const, name: trimmed }] : [])];

  const run = async (option: { kind: "switch" | "create"; name: string } | undefined) => {
    if (!option || working) return;
    if (option.kind === "switch" && option.name === current) { setOpen(false); return; }
    setWorking(true);
    const ok = await (option.kind === "switch" ? onSwitch(option.name) : onCreate(option.name));
    setWorking(false);
    if (ok) setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="editor-git-branch-trigger" aria-label={`Switch branch (current: ${label})`} title="Switch or create a branch" disabled={disabled}>
          <span>{label}</span><ChevronDown size={12} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="editor-git-branch-popover" align="start" sideOffset={6} onKeyDown={event => {
          if (event.key === "ArrowDown") { event.preventDefault(); setIndex(value => Math.min(value + 1, Math.max(options.length - 1, 0))); }
          else if (event.key === "ArrowUp") { event.preventDefault(); setIndex(value => Math.max(value - 1, 0)); }
          else if (event.key === "Enter") { event.preventDefault(); void run(options[index]); }
        }}>
          <input autoFocus value={query} onChange={event => { setQuery(event.target.value); setIndex(0); }} placeholder="Filter, or name a new branch" aria-label="Filter or create branch" disabled={working} />
          {error && <p role="alert" className="editor-git-branch-error">{error}</p>}
          {!branches && !error ? <p className="editor-git-branch-note"><LoaderCircle size={13} className="editor-git-spin" />Loading branches…</p> : (
            <ul role="listbox" aria-label="Branches">
              {options.map((option, position) => {
                const branch = option.kind === "switch" ? matches.find(item => item.name === option.name) : undefined;
                return (
                  <li key={`${option.kind}:${option.name}`} role="option" aria-selected={position === index} className={position === index ? "is-selected" : undefined}
                    onMouseEnter={() => setIndex(position)} onClick={() => void run(option)}>
                    {option.kind === "create" ? <GitBranchPlus size={14} /> : option.name === current ? <Check size={14} /> : <GitBranch size={14} />}
                    <span className="editor-git-branch-name">{option.kind === "create" ? `Create branch “${option.name}” from here` : option.name}</span>
                    {branch && <small title={branch.subject}>{branch.committed_at ? formatRelativeTime(branch.committed_at) : ""}{branch.upstream ? ` · ${branch.upstream}` : ""}</small>}
                  </li>
                );
              })}
              {!options.length && <li className="editor-git-branch-note">{trimmed ? "No branch matches. Names may use letters, digits, ., _, -, and /." : "No branches yet."}</li>}
            </ul>
          )}
          {working && <p className="editor-git-branch-note"><LoaderCircle size={13} className="editor-git-spin" />Working…</p>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
