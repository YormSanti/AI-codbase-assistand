import React from 'react';
import { GitBranch, FolderGit2, Calendar, FileBox, CheckCircle2, GitCommit, GitPullRequest, ArrowUpCircle, ArrowDownCircle, ExternalLink } from 'lucide-react';
import type { RepositoryInfo } from '../types/domain';

function GitHubMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

interface Props {
  repository: RepositoryInfo | null;
  onNavigate: (tab: string) => void;
}

export const GitPage: React.FC<Props> = ({
  repository,
  onNavigate,
}) => {
  const cardStyle = {
    borderRadius: '20px',
    backgroundColor: 'rgba(18, 18, 24, 0.9)',
    border: '1.5px solid rgba(255, 255, 255, 0.08)',
    padding: '28px',
    boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.4)',
  };

  const rowStyle = {
    padding: '14px 18px',
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  };

  const simulatedActivities = [
    { id: 1, type: 'commit', message: 'feat: add premium git dashboard', time: '10 mins ago', icon: GitCommit, color: '#34d399' },
    { id: 2, type: 'push', message: 'Pushed 1 commit to origin/main', time: '15 mins ago', icon: ArrowUpCircle, color: '#60a5fa' },
    { id: 3, type: 'merge', message: 'Merge pull request #42 from santi/feature-ui', time: '2 hours ago', icon: GitPullRequest, color: '#a78bfa' },
    { id: 4, type: 'commit', message: 'fix: padding issues in explorer', time: '3 hours ago', icon: GitCommit, color: '#34d399' },
    { id: 5, type: 'fetch', message: 'Fetched origin', time: '1 day ago', icon: ArrowDownCircle, color: '#fbbf24' },
    { id: 6, type: 'commit', message: 'Initial commit', time: '2 days ago', icon: GitCommit, color: '#34d399' },
  ];

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '20px', padding: '24px 28px' }}>
        <div style={{ 
          backgroundColor: 'rgba(52, 211, 153, 0.1)', 
          padding: '14px', 
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <GitBranch size={32} color="#34d399" style={{ filter: 'drop-shadow(0 0 12px rgba(52, 211, 153, 0.5))' }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>Git Repository</h1>
          <p style={{ margin: 0, fontSize: '15px', color: 'rgba(255, 255, 255, 0.6)' }}>Manage branches, commits, and repository history</p>
        </div>
        
        {repository && (
          <button 
            className="hover:bg-white/10 transition-colors cursor-pointer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '14px',
            }}
            onClick={async () => {
              try {
                if ("__TAURI_INTERNALS__" in window) {
                  const { openUrl } = await import("@tauri-apps/plugin-opener");
                  await openUrl('https://github.com/YormSanti/AI-codbase-assistand');
                } else {
                  window.open('https://github.com/YormSanti/AI-codbase-assistand', '_blank');
                }
              } catch (e) {
                console.error(e);
              }
            }}
          >
            <GitHubMark size={18} />
            Open on GitHub
            <ExternalLink size={14} style={{ opacity: 0.5, marginLeft: '4px' }} />
          </button>
        )}
      </div>

      {!repository ? (
        <div style={{ 
          ...cardStyle, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '80px 40px',
          textAlign: 'center',
          gap: '24px'
        }}>
          <FolderGit2 size={64} color="#34d399" style={{ filter: 'drop-shadow(0 0 16px rgba(52, 211, 153, 0.5))' }} />
          <div>
            <h2 style={{ margin: '0 0 12px 0', color: 'white', fontSize: '24px' }}>No Repository Connected</h2>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', maxWidth: '400px' }}>Connect a local git repository to view branches and commit history.</p>
          </div>
          <button 
            className="hover:bg-emerald-500 transition-colors cursor-pointer"
            style={{
              padding: '12px 28px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '15px',
              marginTop: '16px'
            }}
            onClick={() => onNavigate("explorer")}
          >
            Connect Repository
          </button>
        </div>
      ) : (
        <>
          {/* Top 2 Columns */}
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            {/* Repository Details Card */}
            <div style={{ ...cardStyle, flex: '1 1 400px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 24px 0', color: 'white', fontSize: '18px', fontWeight: 600 }}>Repository Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={rowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.5)' }}>
                    <FolderGit2 size={16} />
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Name</span>
                  </div>
                  <span style={{ color: 'white', fontFamily: 'monospace', fontSize: '14px' }}>{repository.name || 'AI-Git-assistand'}</span>
                </div>
                <div style={rowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.5)' }}>
                    <FileBox size={16} />
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Root Path</span>
                  </div>
                  <span style={{ color: 'white', fontFamily: 'monospace', fontSize: '13px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{repository.root_path || '/home/ksk/AI-Git-assistand'}</span>
                </div>
                <div style={rowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.5)' }}>
                    <Calendar size={16} />
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Opened At</span>
                  </div>
                  <span style={{ color: 'white', fontFamily: 'monospace', fontSize: '14px' }}>{repository.opened_at ? new Date(repository.opened_at).toLocaleDateString() : 'Today'}</span>
                </div>
                <div style={{ ...rowStyle, marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.5)' }}>
                    <CheckCircle2 size={16} />
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>File Count</span>
                  </div>
                  <span style={{ color: '#34d399', fontFamily: 'monospace', fontSize: '15px', fontWeight: 600 }}>{repository.file_count || 0}</span>
                </div>
              </div>
            </div>

            {/* Branch & Commit Card */}
            <div style={{ ...cardStyle, flex: '1 1 400px', display: 'flex', flexDirection: 'column' }}>
               <h3 style={{ margin: '0 0 24px 0', color: 'white', fontSize: '18px', fontWeight: 600 }}>Branch & Commit</h3>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Branch</span>
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      padding: '8px 16px', 
                      backgroundColor: 'rgba(52, 211, 153, 0.15)', 
                      border: '1px solid rgba(52, 211, 153, 0.3)',
                      borderRadius: '24px',
                      color: '#34d399',
                      fontWeight: 600,
                      boxShadow: '0 0 16px rgba(52, 211, 153, 0.2)'
                    }}>
                      <GitBranch size={16} />
                      {repository.current_branch || 'main'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                     <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>HEAD Commit</span>
                     <div 
                      className="hover:bg-gray-800 transition-colors cursor-pointer"
                      style={{ 
                        padding: '8px 12px', 
                        backgroundColor: 'rgba(255,255,255,0.05)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#e5e7eb',
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                     }}>
                        {repository.head_commit || 'a1b2c3d4e5f6'}
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>COPY</span>
                     </div>
                  </div>
               </div>

               {/* Branch Visualization */}
               <div style={{ 
                  marginTop: 'auto', 
                  padding: '24px', 
                  backgroundColor: 'rgba(0,0,0,0.3)', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
               }}>
                  {/* Simple branch visualization with inline styles */}
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '280px', position: 'relative' }}>
                     <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#60a5fa', zIndex: 2 }} />
                     <div style={{ flex: 1, height: '2px', backgroundColor: 'rgba(255,255,255,0.2)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '50%', backgroundColor: '#60a5fa' }} />
                     </div>
                     <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#34d399', zIndex: 2, boxShadow: '0 0 10px #34d399' }} />
                     <div style={{ position: 'absolute', top: '24px', left: '-10px', color: '#60a5fa', fontSize: '12px', fontFamily: 'monospace' }}>main</div>
                     <div style={{ position: 'absolute', top: '24px', right: '-10px', color: '#34d399', fontSize: '12px', fontFamily: 'monospace' }}>santi</div>
                  </div>
               </div>
            </div>
          </div>

          {/* Activity Section */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 24px 0', color: 'white', fontSize: '18px', fontWeight: 600 }}>Git Activity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {simulatedActivities.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div key={activity.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '16px 20px', 
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    gap: '16px'
                  }}>
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '10px', 
                      backgroundColor: `${activity.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Icon size={20} color={activity.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'white', fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>{activity.message}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{activity.time}</div>
                    </div>
                    <div style={{ 
                      padding: '4px 10px', 
                      borderRadius: '20px', 
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {activity.type}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
