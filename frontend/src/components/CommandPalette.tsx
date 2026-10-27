import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Dialog } from "radix-ui";
import { CornerDownLeft, Search } from "lucide-react";

export interface PaletteCommand {
  id: string;
  label: string;
  group: string;
  run: () => void;
  hint?: string;
  keywords?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  disabled?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
  placeholder?: string;
}

function matches(command: PaletteCommand, query: string): boolean {
  if (!query) return true;
  const haystack = `${command.label} ${command.group} ${command.hint ?? ""} ${command.keywords ?? ""}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every(term => haystack.includes(term));
}

/** Keyboard-first launcher for navigation, projects, and actions (Ctrl/Cmd+K). */
export function CommandPalette({ open, onOpenChange, commands, placeholder = "Type a command or project name…" }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const visible = useMemo(() => commands.filter(command => !command.disabled && matches(command, query)), [commands, query]);

  useEffect(() => {
    if (open) { setQuery(""); setIndex(0); }
  }, [open]);

  useEffect(() => { setIndex(0); }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [index]);

  const run = (command: PaletteCommand | undefined) => {
    if (!command) return;
    onOpenChange(false);
    command.run();
  };

  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, { command: PaletteCommand; position: number }[]>();
    visible.forEach((command, position) => {
      if (!byGroup.has(command.group)) { byGroup.set(command.group, []); order.push(command.group); }
      byGroup.get(command.group)!.push({ command, position });
    });
    return order.map(group => ({ group, items: byGroup.get(group)! }));
  }, [visible]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed left-1/2 top-[14vh] z-[61] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none"
          onKeyDown={event => {
            if (event.key === "ArrowDown") { event.preventDefault(); setIndex(value => Math.min(value + 1, Math.max(visible.length - 1, 0))); }
            else if (event.key === "ArrowUp") { event.preventDefault(); setIndex(value => Math.max(value - 1, 0)); }
            else if (event.key === "Enter") { event.preventDefault(); run(visible[index]); }
          }}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">Search commands and projects. Use the arrow keys and Enter to run one.</Dialog.Description>
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search size={16} className="text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={placeholder}
              aria-label="Command palette"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-palette-options"
              aria-activedescendant={visible[index] ? `command-${visible[index].id}` : undefined}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
          </div>
          <ul ref={listRef} id="command-palette-options" role="listbox" aria-label="Commands" className="max-h-[50vh] overflow-y-auto p-2">
            {visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matching commands.</li>}
            {groups.map(({ group, items }) => (
              <li key={group} role="presentation">
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</div>
                <ul role="group" aria-label={group}>
                  {items.map(({ command, position }) => {
                    const Icon = command.icon;
                    const selected = position === index;
                    return (
                      <li
                        key={command.id}
                        id={`command-${command.id}`}
                        role="option"
                        aria-selected={selected}
                        data-index={position}
                        onMouseEnter={() => setIndex(position)}
                        onClick={() => run(command)}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${selected ? "bg-accent text-accent-foreground" : ""}`}
                      >
                        {Icon && <Icon size={15} className="shrink-0 text-muted-foreground" />}
                        <span className="min-w-0 flex-1 truncate">{command.label}</span>
                        {command.hint && <span className="max-w-[45%] truncate text-xs text-muted-foreground" title={command.hint}>{command.hint}</span>}
                        {selected && <CornerDownLeft size={13} className="shrink-0 text-muted-foreground" />}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
