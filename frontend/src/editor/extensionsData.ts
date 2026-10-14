export interface ExtensionItem {
  id: string;
  name: string;
  publisher: string;
  description: string;
  version: string;
  downloads: number;
  rating: number;
  category: "languages" | "formatters" | "themes" | "tools";
  downloadUrl: string;
  iconUrl?: string;
  verified?: boolean;
}

export interface InstalledExtension {
  id: string;
  name: string;
  publisher: string;
  version: string;
  description: string;
  installedAt: string;
  enabled: boolean;
  category?: string;
  downloadUrl?: string;
  iconUrl?: string;
}

export const CURATED_EXTENSIONS: ExtensionItem[] = [
  {
    id: "ms-python.python",
    name: "Python",
    publisher: "ms-python",
    description: "Rich support for the Python language including IntelliSense, linting, debugging, code navigation, and syntax highlighting.",
    version: "2026.4.0",
    downloads: 125400000,
    rating: 4.8,
    category: "languages",
    downloadUrl: "https://open-vsx.org/api/ms-python/python/2026.4.0/file/ms-python.python-2026.4.0.vsix",
    verified: true,
  },
  {
    id: "esbenp.prettier-vscode",
    name: "Prettier - Code Formatter",
    publisher: "esbenp",
    description: "An opinionated code formatter supporting JavaScript, TypeScript, CSS, HTML, JSON, Markdown, and more.",
    version: "12.4.0",
    downloads: 9477000,
    rating: 4.7,
    category: "formatters",
    downloadUrl: "https://open-vsx.org/api/esbenp/prettier-vscode/12.4.0/file/esbenp.prettier-vscode-12.4.0.vsix",
    iconUrl: "https://open-vsx.org/api/esbenp/prettier-vscode/12.4.0/file/icon.png",
    verified: true,
  },
  {
    id: "dbaeumer.vscode-eslint",
    name: "ESLint",
    publisher: "dbaeumer",
    description: "Integrates ESLint JavaScript and TypeScript into the editor. Automatically detects syntax issues and styling errors.",
    version: "3.0.34",
    downloads: 8520000,
    rating: 4.6,
    category: "formatters",
    downloadUrl: "https://open-vsx.org/api/dbaeumer/vscode-eslint/3.0.34/file/dbaeumer.vscode-eslint-3.0.34.vsix",
    iconUrl: "https://open-vsx.org/api/dbaeumer/vscode-eslint/3.0.34/file/icon.png",
    verified: true,
  },
  {
    id: "eamodio.gitlens",
    name: "GitLens — Git supercharged",
    publisher: "gitkraken",
    description: "Supercharge Git within the editor — visualize code authorship with Git blame annotations, commit graph, and history.",
    version: "2026.10.13",
    downloads: 7800000,
    rating: 4.9,
    category: "tools",
    downloadUrl: "https://open-vsx.org/api/eamodio/gitlens/2026.10.131647/file/eamodio.gitlens-2026.10.131647.vsix",
    verified: true,
  },
  {
    id: "bradlc.vscode-tailwindcss",
    name: "Tailwind CSS IntelliSense",
    publisher: "bradlc",
    description: "Intelligent Tailwind CSS tooling for the editor, including autocomplete, syntax highlighting, and hover previews.",
    version: "0.14.3",
    downloads: 6300000,
    rating: 4.8,
    category: "languages",
    downloadUrl: "https://open-vsx.org/api/bradlc/vscode-tailwindcss/0.14.3/file/bradlc.vscode-tailwindcss-0.14.3.vsix",
    verified: true,
  },
  {
    id: "rust-lang.rust-analyzer",
    name: "Rust Analyzer",
    publisher: "rust-lang",
    description: "Modular compiler and deep code intelligence frontend for the Rust programming language.",
    version: "0.4.2100",
    downloads: 5100000,
    rating: 4.9,
    category: "languages",
    downloadUrl: "https://open-vsx.org/api/rust-lang/rust-analyzer/0.4.2100/file/rust-lang.rust-analyzer-0.4.2100.vsix",
    verified: true,
  },
  {
    id: "dracula-theme.theme-dracula",
    name: "Dracula Official",
    publisher: "dracula-theme",
    description: "Official Dracula Theme. A dark theme for 325+ apps, designed for optimal contrast and readability.",
    version: "2.25.1",
    downloads: 5800000,
    rating: 4.9,
    category: "themes",
    downloadUrl: "https://open-vsx.org/api/dracula-theme/theme-dracula/2.25.1/file/dracula-theme.theme-dracula-2.25.1.vsix",
    verified: true,
  },
  {
    id: "zhuangtongfa.material-theme",
    name: "One Dark Pro",
    publisher: "zhuangtongfa",
    description: "Atom's iconic One Dark theme, one of the most popular themes for modern code editors.",
    version: "3.18.2",
    downloads: 6900000,
    rating: 4.8,
    category: "themes",
    downloadUrl: "https://open-vsx.org/api/zhuangtongfa/material-theme/3.18.2/file/zhuangtongfa.material-theme-3.18.2.vsix",
    verified: true,
  },
  {
    id: "ms-azuretools.vscode-docker",
    name: "Docker",
    publisher: "ms-azuretools",
    description: "Makes it easy to create, manage, and debug containerized applications with Docker inside the editor.",
    version: "1.29.1",
    downloads: 4500000,
    rating: 4.7,
    category: "tools",
    downloadUrl: "https://open-vsx.org/api/ms-azuretools/vscode-docker/1.29.1/file/ms-azuretools.vscode-docker-1.29.1.vsix",
    verified: true,
  },
  {
    id: "golang.go",
    name: "Go",
    publisher: "golang",
    description: "Rich Go language support for editing, navigation, testing, IntelliSense, and debugging.",
    version: "0.42.0",
    downloads: 4100000,
    rating: 4.7,
    category: "languages",
    downloadUrl: "https://open-vsx.org/api/golang/go/0.42.0/file/golang.go-0.42.0.vsix",
    verified: true,
  },
  {
    id: "yzhang.markdown-all-in-one",
    name: "Markdown All in One",
    publisher: "yzhang",
    description: "All you need to write Markdown: keyboard shortcuts, table of contents, auto preview, and formatting.",
    version: "3.6.2",
    downloads: 3800000,
    rating: 4.8,
    category: "formatters",
    downloadUrl: "https://open-vsx.org/api/yzhang/markdown-all-in-one/3.6.2/file/yzhang.markdown-all-in-one-3.6.2.vsix",
    verified: true,
  },
  {
    id: "ms-vscode.cpptools",
    name: "C/C++",
    publisher: "ms-vscode",
    description: "C/C++ IntelliSense, debugging, and code browsing powered by the C/C++ language server.",
    version: "1.22.0",
    downloads: 8900000,
    rating: 4.6,
    category: "languages",
    downloadUrl: "https://open-vsx.org/api/ms-vscode/cpptools/1.22.0/file/ms-vscode.cpptools-1.22.0.vsix",
    verified: true,
  },
];

export function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

export function downloadExtensionVsix(downloadUrl: string, fileName: string) {
  const safeName = fileName.endsWith(".vsix") ? fileName : `${fileName}.vsix`;
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = safeName;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
