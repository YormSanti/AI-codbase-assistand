import type { ReactNode } from 'react';
import DownloadButton from '@/components/DownloadButton';

const FEATURES: { title: string; text: string; tone: string; icon: ReactNode }[] = [
  {
    title: 'Source Control',
    text: 'Review split or unified diffs, stage, commit, discard, switch branches, and fetch, pull, or push, plus commit details and per-file history.',
    tone: 'bg-emerald-500/10 text-emerald-400',
    icon: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="8" r="3" /><path d="M6 9v6" /><path d="M18 11a6 6 0 0 1-6 6H9" /></>,
  },
  {
    title: 'AI that knows your repo',
    text: 'Chat with Codex or Gemini about the open project, get AI reviews of a diff or of everything staged, and draft commit messages in your project\'s style.',
    tone: 'bg-purple-500/10 text-purple-400',
    icon: <><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z" /></>,
  },
  {
    title: 'Code Health',
    text: 'Find possible hardcoded secrets, risky calls like eval or shell=True, TODO and FIXME comments, and large files, then jump straight to the line.',
    tone: 'bg-rose-500/10 text-rose-400',
    icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
  },
  {
    title: 'Fast code editor',
    text: 'Tabs, search across files, Go to File, Go to Symbol across the whole project, find and replace, and a minimap, all indexed with Tree-sitter.',
    tone: 'bg-blue-500/10 text-blue-400',
    icon: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
  },
  {
    title: 'Integrated terminal',
    text: 'Split-pane shells that start in your project folder and keep running while you switch views or projects.',
    tone: 'bg-amber-500/10 text-amber-400',
    icon: <><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></>,
  },
  {
    title: 'Desktop or browser',
    text: 'A light Tauri desktop app for Linux, or the same interface in your browser against the local backend. Press Ctrl+K to jump anywhere.',
    tone: 'bg-cyan-500/10 text-cyan-400',
    icon: <><rect x="2" y="4" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="18" x2="12" y2="21" /></>,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0e] text-white" style={{
      backgroundImage: `
        radial-gradient(circle at 15% 50%, rgba(52, 211, 153, 0.08) 0%, transparent 25%),
        radial-gradient(circle at 85% 30%, rgba(139, 92, 246, 0.08) 0%, transparent 25%)
      `
    }}>
      {/* Navbar */}
      <nav className="w-full px-8 py-6 flex justify-between items-center max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="IFROG Logo" className="w-10 h-10 rounded-lg" />
          <span className="text-xl font-bold tracking-tight">IFROG</span>
        </div>
        <div>
          <a href="https://github.com/YormSanti/AI-codbase-assistand" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 font-medium">
            GitHub
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-grow flex flex-col items-center justify-center px-6 text-center max-w-4xl mx-auto -mt-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium mb-8 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          New: Source Control, AI commit messages, and Code Health
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
          Meet your new <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-200">AI Coding Assistant</span>
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl leading-relaxed">
          IFROG is a fast, local-first workspace for your Git repositories: a code editor, Source Control, an integrated terminal, code health checks, and an AI assistant that reviews diffs and writes commit messages.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <DownloadButton />
          
          <a href="https://github.com/YormSanti/AI-codbase-assistand" 
             target="_blank"
             className="flex items-center justify-center gap-3 px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold rounded-xl transition-all transform hover:-translate-y-1 backdrop-blur-md">
            View Source
          </a>
        </div>
        <p className="mt-4 text-sm text-gray-500">Available as .deb and AppImage</p>
      </main>

      {/* Features */}
      <section className="w-full max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-3">Everything for your repository in one window</h2>
        <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12">Edit, review, commit, and ask AI about your code without switching tools.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(feature => (
            <div key={feature.title} className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-md">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${feature.tone}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true">
                  {feature.icon}
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full text-center py-8 text-gray-600 text-sm border-t border-white/5 mt-auto">
        &copy; 2026 IFROG. Open source under the MIT License.
      </footer>
    </div>
  );
}
