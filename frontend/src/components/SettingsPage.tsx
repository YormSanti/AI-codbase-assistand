import React, { useState } from 'react';
import { Settings, Layout, Code2, Bot, GitBranch, Bell, Info, Check } from 'lucide-react';

type Section = 'Appearance' | 'Editor' | 'AI Agent' | 'Git' | 'Notifications' | 'About';

export function SettingsPage() {
  const [selectedSection, setSelectedSection] = useState<Section>('Appearance');
  const [theme, setTheme] = useState('Dark');
  const [fontSize, setFontSize] = useState(14);
  const [sidebarPos, setSidebarPos] = useState('Left');
  const [accent, setAccent] = useState('#a78bfa');
  const [tabSize, setTabSize] = useState(2);
  const [wordWrap, setWordWrap] = useState(true);
  const [lineNumbers, setLineNumbers] = useState(true);
  const [minimap, setMinimap] = useState(true);
  const [aiModel, setAiModel] = useState('GPT-4 Turbo');
  const [tokenBudget, setTokenBudget] = useState(4000);
  const [autoRun, setAutoRun] = useState(false);
  const [stream, setStream] = useState(true);
  const [temperature, setTemperature] = useState(0.7);

  const cardStyle: React.CSSProperties = {
    borderRadius: '20px',
    background: 'rgba(18,18,24,0.9)',
    border: '1.5px solid rgba(255,255,255,0.08)',
    padding: '28px',
    boxShadow: '0 8px 32px -8px rgba(0,0,0,0.4)',
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '24px'
  };

  const renderAppearance = () => (
    <div style={cardStyle}>
      <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 24px 0' }}>Appearance</h3>
      
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Theme</label>
        <div style={{ display: 'flex', gap: '16px' }}>
          {['Dark', 'Light', 'System'].map(t => (
            <div key={t} onClick={() => setTheme(t)} style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${theme === t ? '#a78bfa' : 'transparent'}`, boxShadow: theme === t ? '0 0 12px rgba(167,139,250,0.3)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>{t}</span>
              {theme === t && <Check size={16} color="#a78bfa" />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Font Size: {fontSize}px</label>
        <input type="range" min="12" max="20" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#a78bfa' }} />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Sidebar Position</label>
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
          {['Left', 'Right'].map(p => (
            <button key={p} onClick={() => setSidebarPos(p)} style={{ padding: '8px 24px', borderRadius: '6px', border: 'none', background: sidebarPos === p ? '#a78bfa' : 'transparent', color: sidebarPos === p ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: 500 }}>{p}</button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Accent Color</label>
        <div style={{ display: 'flex', gap: '12px' }}>
          {['#a78bfa', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#ef4444'].map(c => (
            <div key={c} onClick={() => setAccent(c)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: c, cursor: 'pointer', border: accent === c ? '2px solid #fff' : '2px solid transparent', outline: accent === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }} />
          ))}
        </div>
      </div>
    </div>
  );

  const renderAIAgent = () => (
    <div style={cardStyle}>
      <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 24px 0' }}>AI Agent</h3>
      
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Default Model</label>
        <select value={aiModel} onChange={e => setAiModel(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', fontSize: '14px', outline: 'none' }}>
          <option value="GPT-4 Turbo">GPT-4 Turbo</option>
          <option value="Claude 3 Opus">Claude 3 Opus</option>
          <option value="Gemini 1.5 Pro">Gemini 1.5 Pro</option>
        </select>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Max Token Budget: {tokenBudget}</label>
        <input type="range" min="1000" max="8000" step="500" value={tokenBudget} onChange={e => setTokenBudget(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#a78bfa' }} />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Temperature: {temperature}</label>
        <input type="range" min="0" max="1" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#a78bfa' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[
          { label: 'Auto-run generated commands', value: autoRun, setter: setAutoRun },
          { label: 'Stream output', value: stream, setter: setStream }
        ].map((toggle, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{toggle.label}</span>
            <div onClick={() => toggle.setter(!toggle.value)} style={{ width: '44px', height: '24px', borderRadius: '12px', background: toggle.value ? '#a78bfa' : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: '0.2s' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: toggle.value ? '23px' : '3px', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderEditor = () => (
    <div style={cardStyle}>
      <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 24px 0' }}>Editor Settings</h3>
      
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Tab Size</label>
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
          {[2, 4, 8].map(s => (
            <button key={s} onClick={() => setTabSize(s)} style={{ padding: '8px 24px', borderRadius: '6px', border: 'none', background: tabSize === s ? '#a78bfa' : 'transparent', color: tabSize === s ? '#fff' : '#94a3b8', cursor: 'pointer', fontWeight: 500 }}>{s}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[
          { label: 'Word Wrap', value: wordWrap, setter: setWordWrap },
          { label: 'Line Numbers', value: lineNumbers, setter: setLineNumbers },
          { label: 'Minimap', value: minimap, setter: setMinimap }
        ].map((toggle, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{toggle.label}</span>
            <div onClick={() => toggle.setter(!toggle.value)} style={{ width: '44px', height: '24px', borderRadius: '12px', background: toggle.value ? '#a78bfa' : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: '0.2s' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: toggle.value ? '23px' : '3px', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderGit = () => (
    <div style={cardStyle}>
      <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 24px 0' }}>Git & Version Control</h3>
      
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Auto-fetch Interval</label>
        <select style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', fontSize: '14px', outline: 'none' }}>
          <option>Never</option>
          <option>Every 5 minutes</option>
          <option>Every 10 minutes</option>
          <option>Every 30 minutes</option>
        </select>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Default Branch</label>
        <input type="text" defaultValue="main" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', fontSize: '14px', outline: 'none' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '14px', fontWeight: 500 }}>Sign Commits (GPG)</span>
        <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer' }}>
          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: '3px' }} />
        </div>
      </div>
    </div>
  );

  const renderAbout = () => (
    <div style={{ ...cardStyle, background: 'linear-gradient(135deg, rgba(167,139,250,0.1) 0%, rgba(18,18,24,0.9) 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#a78bfa', padding: '12px', borderRadius: '12px' }}>
          <Bot size={32} color="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>DevPilot AI</h2>
          <div style={{ color: '#94a3b8', fontSize: '14px' }}>Version 1.0.0-beta</div>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
          <span style={{ color: '#94a3b8' }}>React</span>
          <span style={{ fontWeight: 500 }}>18.2.0</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
          <span style={{ color: '#94a3b8' }}>Vite</span>
          <span style={{ fontWeight: 500 }}>4.4.5</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
          <span style={{ color: '#94a3b8' }}>Node</span>
          <span style={{ fontWeight: 500 }}>v18.17.0</span>
        </div>
      </div>

      <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
        Crafted with ♥ by the AI Agents Team.
      </div>
    </div>
  );

  const sections: { id: Section; icon: React.ReactNode }[] = [
    { id: 'Appearance', icon: <Layout size={18} /> },
    { id: 'Editor', icon: <Code2 size={18} /> },
    { id: 'AI Agent', icon: <Bot size={18} /> },
    { id: 'Git', icon: <GitBranch size={18} /> },
    { id: 'Notifications', icon: <Bell size={18} /> },
    { id: 'About', icon: <Info size={18} /> },
  ];

  return (
    <div style={{ display: 'flex', height: '100%', color: '#f8fafc', padding: '32px' }}>
      {/* Sidebar Nav */}
      <div style={{ width: '220px', flexShrink: 0, marginRight: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ background: 'rgba(167,139,250,0.15)', padding: '12px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px' }}>
            <Settings size={28} color="#a78bfa" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Settings</h1>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sections.map(sec => (
            <button
              key={sec.id}
              onClick={() => setSelectedSection(sec.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px',
                border: 'none', background: selectedSection === sec.id ? 'rgba(167,139,250,0.15)' : 'transparent',
                color: selectedSection === sec.id ? '#a78bfa' : '#94a3b8',
                fontWeight: selectedSection === sec.id ? 600 : 500,
                cursor: 'pointer', transition: '0.2s', textAlign: 'left',
                boxShadow: selectedSection === sec.id ? 'inset 3px 0 0 #a78bfa' : 'none'
              }}
            >
              {sec.icon}
              {sec.id}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '16px' }}>
        {selectedSection === 'Appearance' && renderAppearance()}
        {selectedSection === 'AI Agent' && renderAIAgent()}
        {selectedSection === 'Editor' && renderEditor()}
        {selectedSection === 'Git' && renderGit()}
        {selectedSection === 'About' && renderAbout()}
        {selectedSection === 'Notifications' && (
          <div style={cardStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 24px 0' }}>Notifications</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Notification settings coming soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}
