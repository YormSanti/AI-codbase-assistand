import DownloadButton from '@/components/DownloadButton';
import Image from 'next/image';

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
          Version 1.0 is now available
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
          Meet your new <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-200">AI Coding Assistant</span>
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl leading-relaxed">
          IFROG is an ultra-fast, offline-first desktop application that brings intelligent repository analysis, interactive terminal tabs, and AI assistance directly to your workflow.
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
      <section className="w-full max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-md">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 text-blue-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
          </div>
          <h3 className="text-lg font-bold mb-2">Integrated Terminal</h3>
          <p className="text-gray-400 text-sm">Powerful split-pane terminal built in, managing multiple sessions effortlessly.</p>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-md">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
              <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
              <rect x="9" y="9" width="6" height="6"></rect>
              <line x1="9" y1="1" x2="9" y2="4"></line>
              <line x1="15" y1="1" x2="15" y2="4"></line>
              <line x1="9" y1="20" x2="9" y2="23"></line>
              <line x1="15" y1="20" x2="15" y2="23"></line>
              <line x1="20" y1="9" x2="23" y2="9"></line>
              <line x1="20" y1="14" x2="23" y2="14"></line>
              <line x1="1" y1="9" x2="4" y2="9"></line>
              <line x1="1" y1="14" x2="4" y2="14"></line>
            </svg>
          </div>
          <h3 className="text-lg font-bold mb-2">Local AI Pipeline</h3>
          <p className="text-gray-400 text-sm">Powered by a bundled local Python backend using Tree-sitter for robust code parsing.</p>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-md">
          <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4 text-purple-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <h3 className="text-lg font-bold mb-2">Blazing Fast</h3>
          <p className="text-gray-400 text-sm">Built with Rust and Tauri v2 for extremely low memory usage and instant startup times.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full text-center py-8 text-gray-600 text-sm border-t border-white/5 mt-auto">
        &copy; 2026 IFROG. Open source under the MIT License.
      </footer>
    </div>
  );
}
