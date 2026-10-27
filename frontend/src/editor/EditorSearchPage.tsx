import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CaseSensitive, ChevronDown, ChevronRight, FileCode2, LoaderCircle, TextSearch, TriangleAlert } from "lucide-react";
import type { RepositoryInfo, SearchMatch, SearchResults } from "../types/domain";
import { editorApi } from "../api/editorApi";
import "./EditorSearchPage.css";

interface Props {
  active: boolean;
  repository: RepositoryInfo | null;
  onReturn: () => void;
  onOpenMatch: (path: string, line: number) => void;
}

function fileName(path: string) { return path.split("/").pop() ?? path; }
function directory(path: string) { return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ""; }

function Highlighted({ text, query, caseSensitive }: { text: string; query: string; caseSensitive: boolean }) {
  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const index = needle ? haystack.indexOf(needle) : -1;
  if (index === -1) return <code>{text}</code>;
  return <code>{text.slice(0, index)}<mark>{text.slice(index, index + needle.length)}</mark>{text.slice(index + needle.length)}</code>;
}

export function EditorSearchPage({ active, repository, onReturn, onOpenMatch }: Props) {
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();

  useEffect(() => { if (active) inputRef.current?.focus(); }, [active]);

  useEffect(() => {
    if (!repository || !trimmed) { setResults(null); setLoading(false); setError(null); return; }
    let current = true;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      editorApi.search(repository.id, trimmed, { caseSensitive })
        .then(data => { if (current) { setResults(data); setCollapsed({}); setLoading(false); } })
        .catch(reason => { if (current) { setError(reason instanceof Error ? reason.message : "Search failed."); setLoading(false); } });
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [repository, trimmed, caseSensitive]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const byPath = new Map<string, SearchMatch[]>();
    for (const match of results?.matches ?? []) {
      if (!byPath.has(match.path)) { byPath.set(match.path, []); order.push(match.path); }
      byPath.get(match.path)!.push(match);
    }
    return order.map(path => ({ path, matches: byPath.get(path)! }));
  }, [results]);

  const total = results?.matches.length ?? 0;
  const summary = results
    ? `${total.toLocaleString()} ${total === 1 ? "result" : "results"} in ${groups.length.toLocaleString()} ${groups.length === 1 ? "file" : "files"}`
    : "";

  return (
    <section className="editor-search" aria-label="Search in files">
      <header className="editor-git-header">
        <div className="editor-git-tab"><TextSearch size={15} /><span>Search</span></div>
        <div className="editor-git-header-actions"><button type="button" onClick={onReturn}><ArrowLeft size={14} /><span>Back to code</span></button></div>
      </header>
      <div className="editor-search-body">
        <div className="editor-search-box">
          <input
            ref={inputRef}
            type="search"
            aria-label="Search in files"
            placeholder={repository ? `Search text in ${repository.name}` : "Open a project to search its files"}
            value={query}
            disabled={!repository}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setQuery(""); } }}
          />
          <button type="button" className="editor-search-toggle" aria-label="Match case" aria-pressed={caseSensitive} title="Match case" onClick={() => setCaseSensitive(value => !value)}><CaseSensitive size={16} /></button>
        </div>
        <div className="editor-search-summary" aria-live="polite">
          {loading ? <><LoaderCircle size={13} className="editor-git-spin" />Searching…</> : error ? null : results ? <>{summary}{results.truncated && <span className="editor-search-truncated"> · showing the first matches, refine the search for more</span>}</> : trimmed ? null : "Type to search every text file in the project. Dependency and build folders are skipped."}
        </div>
        {error && <div className="editor-git-error" role="alert"><TriangleAlert size={15} /><span>{error}</span></div>}
        <div className="editor-search-results">
          {results && total === 0 && !loading && <p className="editor-search-empty">No results for “{results.query}”.</p>}
          {groups.map(({ path, matches }) => (
            <div key={path} className="editor-search-file">
              <button type="button" className="editor-search-file-heading" aria-expanded={!collapsed[path]} onClick={() => setCollapsed(value => ({ ...value, [path]: !value[path] }))}>
                {collapsed[path] ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                <FileCode2 size={14} />
                <span className="editor-search-file-name">{fileName(path)}</span>
                <small>{directory(path)}</small>
                <span className="editor-git-count">{matches.length}</span>
              </button>
              {!collapsed[path] && matches.map(match => (
                <button type="button" key={`${match.line}:${match.column}`} className="editor-search-match" aria-label={`${path} line ${match.line}`} onClick={() => onOpenMatch(path, match.line)}>
                  <span className="editor-search-line">{match.line}</span>
                  <Highlighted text={match.text.trim()} query={trimmed} caseSensitive={caseSensitive} />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
