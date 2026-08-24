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
          <a href="https://github.com/YormSanti/AI-codbase-assistand/releases/latest" 
             className="flex items-center justify-center gap-3 px-8 py-4 bg-emerald-400 hover:bg-emerald-300 text-black font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:shadow-[0_0_30px_rgba(52,211,153,0.5)] transform hover:-translate-y-1">
            <svg viewBox="0 0 448 512" fill="currentColor" className="w-5 h-5">
              <path d="M220.8 123.3c1 .5 1.8 1.7 3 1.7 1.1 0 2.8-.4 2.9-1.5.2-1.4-1.9-2.3-3.2-2.9-1.7-.7-3.9-1-5.5-.1-.4.2-.8.7-.6 1.1.3 1.3 2.3 1.1 3.4 1.7zm-21.9 1.7c1.2 0 2-1.2 3-1.7 1.1-.6 3.1-.4 3.5-1.7.2-.4-.2-.9-.6-1.1-1.6-.9-3.8-.6-5.5.1-1.3.6-3.4 1.5-3.2 2.9.1 1 1.8 1.5 2.8 1.5zM440 254.3c-2.8-66-53.2-127.6-118-144.4-6.3-1.6-13-2.7-19.6-3.8l.2-.9c1.9-9.2-2.3-18.7-10.7-22.9-10.5-5.3-23.7-.8-28.7 9.8-1.7 3.5-2 7.4-1.4 11l-.8.1c-11.7-1.3-23.6-2.1-35.6-2.1-12 0-24 .8-35.6 2.1l-.8-.1c.6-3.6.3-7.5-1.4-11-5-10.6-18.1-15.1-28.7-9.8-8.4 4.2-12.6 13.7-10.7 22.9l.2.9c-6.6 1-13.3 2.1-19.6 3.8C65.5 126.7 12 188.4 9.2 254.3c-3 70.3 33.6 148.6 96.6 182.2 6.5 3.5 14 5.3 21.6 5.3h193.3c7.5 0 15-1.8 21.6-5.3 63-33.6 99.6-111.9 96.6-182.2zm-282.8 61.1c-4.4 3.7-10.6 4.3-16 1.7-7-3.3-8.8-11.8-4.2-17.6 4.6-5.8 12.8-7.5 19.3-3.9 6.2 3.5 7.6 11.5 3.3 16.5 0 0-1.2 1.9-2.4 3.3zm67.1 27.6c-20 6.1-42.3 6.1-62.3 0-5.8-1.8-11.7-6.9-9-13.1 2.3-5.3 10-5.4 14.8-4.3 16.9 4 34.9 4 51.8 0 4.8-1.1 12.5-1 14.8 4.3 2.7 6.2-3.1 11.3-9 13.1zm41.6-27.6c-1.2-1.4-2.4-3.3-2.4-3.3-4.3-5-2.9-13 3.3-16.5 6.5-3.6 14.7-1.9 19.3 3.9 4.6 5.8 2.8 14.3-4.2 17.6-5.4 2.6-11.6 2-16-1.7z"/>
            </svg>
            Download for Linux
          </a>
          
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
