import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Blocks, Check, Download, ExternalLink, FileCode2, LoaderCircle, Palette, Search, ShieldCheck, Sparkles, Star, Trash2, Upload, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { CURATED_EXTENSIONS, downloadExtensionVsix, formatDownloads, type ExtensionItem, type InstalledExtension } from "./extensionsData";
import "./EditorExtensionsPage.css";

interface Props {
  active: boolean;
  onReturn: () => void;
}

type FilterCategory = "all" | "installed" | "popular" | "languages" | "formatters" | "themes" | "tools";

const STORAGE_KEY = "ifrog_installed_extensions";

function getStoredInstalled(): Record<string, InstalledExtension> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveStoredInstalled(installed: Record<string, InstalledExtension>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(installed));
  } catch {
    // Ignore storage quota errors
  }
}

export function EditorExtensionsPage({ active, onReturn }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>("all");
  const [installedMap, setInstalledMap] = useState<Record<string, InstalledExtension>>(getStoredInstalled);
  const [remoteResults, setRemoteResults] = useState<ExtensionItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState<ExtensionItem | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync installed from localStorage when view becomes active
  useEffect(() => {
    if (active) {
      setInstalledMap(getStoredInstalled());
    }
  }, [active]);

  // Live Open-VSX search with debounce
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setRemoteResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`https://open-vsx.org/api/-/search?query=${encodeURIComponent(trimmed)}&size=30`);
        if (!res.ok) throw new Error("Search request failed");
        const data = await res.json();
        const extensions: ExtensionItem[] = (data.extensions || []).map((item: any) => ({
          id: `${item.namespace}.${item.name}`,
          name: item.displayName || item.name,
          publisher: item.namespace,
          description: item.description || "No description provided.",
          version: item.version || "1.0.0",
          downloads: item.downloadCount || 0,
          rating: item.averageRating || 5,
          category: item.categories?.includes("Themes") ? "themes" : item.categories?.includes("Programming Languages") ? "languages" : item.categories?.includes("Linters") ? "formatters" : "tools",
          downloadUrl: item.files?.download || `https://open-vsx.org/api/${item.namespace}/${item.name}/${item.version}/file/${item.namespace}.${item.name}-${item.version}.vsix`,
          iconUrl: item.files?.icon,
          verified: Boolean(item.verified),
        }));
        setRemoteResults(extensions);
      } catch {
        // Fallback to local filtering if network is unreachable
        const fallback = CURATED_EXTENSIONS.filter(
          ext => ext.name.toLowerCase().includes(trimmed.toLowerCase()) ||
            ext.description.toLowerCase().includes(trimmed.toLowerCase()) ||
            ext.publisher.toLowerCase().includes(trimmed.toLowerCase())
        );
        setRemoteResults(fallback);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const displayedExtensions = useMemo(() => {
    let list: ExtensionItem[] = remoteResults !== null ? remoteResults : CURATED_EXTENSIONS;

    if (selectedCategory === "installed") {
      const installedIds = Object.keys(installedMap);
      return list.filter(item => installedIds.includes(item.id)).concat(
        // Also show installed extensions not in curated/search results
        Object.values(installedMap)
          .filter(inst => !list.some(item => item.id === inst.id))
          .map(inst => ({
            id: inst.id,
            name: inst.name,
            publisher: inst.publisher,
            description: inst.description,
            version: inst.version,
            downloads: 0,
            rating: 5,
            category: (inst.category as any) || "tools",
            downloadUrl: inst.downloadUrl || "",
            iconUrl: inst.iconUrl,
            verified: true,
          }))
      );
    }

    if (selectedCategory === "popular") {
      return [...list].sort((a, b) => b.downloads - a.downloads);
    }

    if (selectedCategory !== "all") {
      return list.filter(item => item.category === selectedCategory);
    }

    return list;
  }, [remoteResults, selectedCategory, installedMap]);

  const handleInstall = (ext: ExtensionItem) => {
    const next = {
      ...installedMap,
      [ext.id]: {
        id: ext.id,
        name: ext.name,
        publisher: ext.publisher,
        version: ext.version,
        description: ext.description,
        installedAt: new Date().toISOString(),
        enabled: true,
        category: ext.category,
        downloadUrl: ext.downloadUrl,
        iconUrl: ext.iconUrl,
      },
    };
    setInstalledMap(next);
    saveStoredInstalled(next);
    toast.success(`Installed ${ext.name}`);
  };

  const handleUninstall = (extId: string, extName: string) => {
    const next = { ...installedMap };
    delete next[extId];
    setInstalledMap(next);
    saveStoredInstalled(next);
    toast.info(`Uninstalled ${extName}`);
  };

  const handleDownload = (ext: ExtensionItem) => {
    if (!ext.downloadUrl) {
      toast.error("Download URL is not available for this extension");
      return;
    }
    setDownloadingId(ext.id);
    const fileName = `${ext.publisher}.${ext.name.replace(/\s+/g, "_")}-${ext.version}.vsix`;
    try {
      downloadExtensionVsix(ext.downloadUrl, fileName);
      toast.success(`Downloaded ${ext.name} package (.vsix)`);
    } catch {
      toast.error(`Failed to initiate download for ${ext.name}`);
    } finally {
      setTimeout(() => setDownloadingId(null), 1000);
    }
  };

  const handleInstallVsix = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const baseName = file.name.replace(/\.vsix$/i, "");
    const extId = `local.${baseName.toLowerCase().replace(/[^a-z0-9.-]/g, "-")}`;
    const next = {
      ...installedMap,
      [extId]: {
        id: extId,
        name: file.name.replace(/\.vsix$/i, ""),
        publisher: "Local VSIX",
        version: "1.0.0",
        description: `Locally installed extension package (${(file.size / 1024).toFixed(0)} KB)`,
        installedAt: new Date().toISOString(),
        enabled: true,
        category: "tools",
      },
    };
    setInstalledMap(next);
    saveStoredInstalled(next);
    toast.success(`Installed local extension: ${file.name}`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const installedCount = Object.keys(installedMap).length;

  const categoryIcon = (category: string) => {
    switch (category) {
      case "languages": return <FileCode2 size={16} />;
      case "formatters": return <Sparkles size={16} />;
      case "themes": return <Palette size={16} />;
      default: return <Wrench size={16} />;
    }
  };

  return (
    <div className="editor-extensions-page" role="region" aria-label="Editor Extensions">
      <header className="editor-git-header">
        <div className="editor-git-tab">
          <Blocks size={15} />
          <span>Extensions</span>
        </div>
        <div className="editor-git-header-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".vsix"
            style={{ display: "none" }}
            onChange={handleInstallVsix}
            aria-label="Upload VSIX file"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Install extension package from local VSIX file"
            aria-label="Install from VSIX"
          >
            <Upload size={14} />
            <span>Install from VSIX…</span>
          </button>
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

      <div className="editor-extensions-body">
        {/* Search & Filter Toolbar */}
        <div className="editor-extensions-toolbar">
          <div className="editor-extensions-search-box">
            <Search size={15} className="editor-extensions-search-icon" />
            <input
              type="text"
              className="editor-extensions-search-input"
              placeholder="Search Extensions in Marketplace (e.g. Python, Prettier, Themes)…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search Extensions"
            />
            {isSearching && <LoaderCircle size={14} className="editor-extensions-spinner" />}
            {searchQuery && !isSearching && (
              <button
                type="button"
                className="editor-extensions-clear-btn"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="editor-extensions-categories" role="tablist" aria-label="Extension categories">
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === "all"}
              className={`editor-ext-chip ${selectedCategory === "all" ? "is-active" : ""}`}
              onClick={() => setSelectedCategory("all")}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === "installed"}
              className={`editor-ext-chip ${selectedCategory === "installed" ? "is-active" : ""}`}
              onClick={() => setSelectedCategory("installed")}
            >
              Installed ({installedCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === "popular"}
              className={`editor-ext-chip ${selectedCategory === "popular" ? "is-active" : ""}`}
              onClick={() => setSelectedCategory("popular")}
            >
              Popular
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === "languages"}
              className={`editor-ext-chip ${selectedCategory === "languages" ? "is-active" : ""}`}
              onClick={() => setSelectedCategory("languages")}
            >
              Languages
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === "formatters"}
              className={`editor-ext-chip ${selectedCategory === "formatters" ? "is-active" : ""}`}
              onClick={() => setSelectedCategory("formatters")}
            >
              Formatters & Linters
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === "themes"}
              className={`editor-ext-chip ${selectedCategory === "themes" ? "is-active" : ""}`}
              onClick={() => setSelectedCategory("themes")}
            >
              Themes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === "tools"}
              className={`editor-ext-chip ${selectedCategory === "tools" ? "is-active" : ""}`}
              onClick={() => setSelectedCategory("tools")}
            >
              Tools
            </button>
          </div>
        </div>

        {/* Extensions List */}
        <div className="editor-extensions-content">
          <div className="editor-extensions-grid">
            {displayedExtensions.map(ext => {
              const isInstalled = Boolean(installedMap[ext.id]);
              const isDownloading = downloadingId === ext.id;

              return (
                <article
                  key={ext.id}
                  className={`editor-extension-card ${isInstalled ? "is-installed" : ""}`}
                  tabIndex={0}
                  onClick={() => setSelectedExtension(ext)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setSelectedExtension(ext); }}
                  aria-label={`${ext.name} by ${ext.publisher}`}
                >
                  <div className="editor-extension-icon-wrap">
                    {ext.iconUrl ? (
                      <img
                        src={ext.iconUrl}
                        alt=""
                        className="editor-extension-icon"
                        onError={e => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                          (e.currentTarget.nextElementSibling as HTMLElement)?.removeAttribute("style");
                        }}
                      />
                    ) : null}
                    <div
                      className="editor-extension-icon-fallback"
                      style={ext.iconUrl ? { display: "none" } : undefined}
                    >
                      {categoryIcon(ext.category)}
                    </div>
                  </div>

                  <div className="editor-extension-details">
                    <div className="editor-extension-header">
                      <h3 className="editor-extension-name">{ext.name}</h3>
                      <span className="editor-extension-version">v{ext.version}</span>
                    </div>

                    <div className="editor-extension-meta">
                      <span className="editor-extension-publisher">
                        {ext.publisher}
                        {ext.verified && <span title="Verified Publisher"><ShieldCheck size={12} className="editor-extension-verified" /></span>}
                      </span>
                      {ext.downloads > 0 && (
                        <span className="editor-extension-stat" title={`${ext.downloads.toLocaleString()} downloads`}>
                          <Download size={11} /> {formatDownloads(ext.downloads)}
                        </span>
                      )}
                      {ext.rating > 0 && (
                        <span className="editor-extension-stat" title={`${ext.rating} out of 5 stars`}>
                          <Star size={11} className="is-star" /> {ext.rating.toFixed(1)}
                        </span>
                      )}
                    </div>

                    <p className="editor-extension-desc">{ext.description}</p>

                    <div className="editor-extension-actions" onClick={e => e.stopPropagation()}>
                      {isInstalled ? (
                        <>
                          <span className="editor-extension-badge-installed">
                            <Check size={13} /> Installed
                          </span>
                          <button
                            type="button"
                            className="editor-ext-btn editor-ext-btn-danger"
                            onClick={() => handleUninstall(ext.id, ext.name)}
                            aria-label={`Uninstall ${ext.name}`}
                          >
                            <Trash2 size={13} />
                            <span>Uninstall</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="editor-ext-btn editor-ext-btn-primary"
                          onClick={() => handleInstall(ext)}
                          aria-label={`Install ${ext.name}`}
                        >
                          <Check size={13} />
                          <span>Install</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="editor-ext-btn editor-ext-btn-secondary"
                        onClick={() => handleDownload(ext)}
                        disabled={isDownloading}
                        title={`Download ${ext.name} .vsix package`}
                        aria-label={`Download ${ext.name}`}
                      >
                        {isDownloading ? <LoaderCircle size={13} className="editor-extensions-spinner" /> : <Download size={13} />}
                        <span>Download (.vsix)</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {displayedExtensions.length === 0 && (
              <div className="editor-extensions-empty">
                <Blocks size={40} className="editor-extensions-empty-icon" />
                <h3>No extensions found</h3>
                <p>
                  {searchQuery
                    ? `No matching extensions found for "${searchQuery}".`
                    : "No installed extensions found in this view."}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    className="editor-ext-btn editor-ext-btn-secondary"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear Search
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Extension Details Modal */}
      {selectedExtension && (
        <div
          className="editor-extension-modal-overlay"
          onClick={() => setSelectedExtension(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Extension Details"
        >
          <div className="editor-extension-modal" onClick={e => e.stopPropagation()}>
            <div className="editor-extension-modal-header">
              <div className="editor-extension-modal-title">
                <h2>{selectedExtension.name}</h2>
                <span className="editor-extension-modal-publisher">
                  by {selectedExtension.publisher} {selectedExtension.verified && "(Verified)"}
                </span>
              </div>
              <button
                type="button"
                className="editor-extension-modal-close"
                onClick={() => setSelectedExtension(null)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div className="editor-extension-modal-body">
              <p className="editor-extension-modal-desc">{selectedExtension.description}</p>

              <dl className="editor-extension-modal-meta">
                <div>
                  <dt>Identifier</dt>
                  <dd><code>{selectedExtension.id}</code></dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>v{selectedExtension.version}</dd>
                </div>
                <div>
                  <dt>Downloads</dt>
                  <dd>{selectedExtension.downloads ? selectedExtension.downloads.toLocaleString() : "N/A"}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd style={{ textTransform: "capitalize" }}>{selectedExtension.category}</dd>
                </div>
              </dl>

              <div className="editor-extension-modal-actions">
                {installedMap[selectedExtension.id] ? (
                  <button
                    type="button"
                    className="editor-ext-btn editor-ext-btn-danger"
                    onClick={() => {
                      handleUninstall(selectedExtension.id, selectedExtension.name);
                    }}
                  >
                    <Trash2 size={14} /> Uninstall Extension
                  </button>
                ) : (
                  <button
                    type="button"
                    className="editor-ext-btn editor-ext-btn-primary"
                    onClick={() => {
                      handleInstall(selectedExtension);
                    }}
                  >
                    <Check size={14} /> Install Extension
                  </button>
                )}

                <button
                  type="button"
                  className="editor-ext-btn editor-ext-btn-secondary"
                  onClick={() => handleDownload(selectedExtension)}
                >
                  <Download size={14} /> Download Package (.vsix)
                </button>

                {selectedExtension.downloadUrl && (
                  <a
                    href={`https://open-vsx.org/extension/${selectedExtension.publisher}/${selectedExtension.id.split(".")[1] || selectedExtension.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="editor-ext-btn editor-ext-btn-secondary"
                    style={{ textDecoration: "none" }}
                  >
                    <ExternalLink size={14} /> Open VSX Registry
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
