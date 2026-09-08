import React from 'react';
import { FolderOpen, FileCode2, HardDrive, Files } from 'lucide-react';
import type { RepositoryInfo, TreeNode } from '../types/domain';
import { RepositoryPicker } from './RepositoryPicker';
import { RepositorySummary } from './RepositorySummary';
import { RepositoryTree } from './RepositoryTree';
import { FileInspector } from './FileInspector';

interface Props {
  repository: RepositoryInfo | null;
  tree: TreeNode | null;
  selectedFile: TreeNode | null;
  isLoading: boolean;
  onOpen: (path: string) => void;
  onSelectFile: (node: TreeNode) => void;
  onCloseFile: () => void;
  onAskAI: (file: TreeNode) => void;
}

export const ExplorerPage: React.FC<Props> = ({
  repository,
  tree,
  selectedFile,
  isLoading,
  onOpen,
  onSelectFile,
  onCloseFile,
  onAskAI,
}) => {
  const cardStyle = {
    borderRadius: '20px',
    backgroundColor: 'rgba(18, 18, 24, 0.9)',
    border: '1.5px solid rgba(255, 255, 255, 0.08)',
    padding: '24px 28px',
    boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.4)',
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
      {/* Header Section */}
      <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            backgroundColor: 'rgba(96, 165, 250, 0.1)', 
            padding: '12px', 
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Files size={32} color="#60a5fa" style={{ filter: 'drop-shadow(0 0 8px rgba(96, 165, 250, 0.5))' }} />
          </div>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 600, color: 'white' }}>File Explorer</h1>
            <p style={{ margin: 0, fontSize: '15px', color: 'rgba(255, 255, 255, 0.6)' }}>Navigate and inspect your workspace files</p>
          </div>
        </div>
        <div style={{ minWidth: '300px' }}>
          <RepositoryPicker isLoading={isLoading} onOpen={onOpen} />
        </div>
      </div>

      {repository && (
        <div style={{ ...cardStyle, padding: '20px 28px' }}>
          <RepositorySummary repository={repository} />
        </div>
      )}

      {/* Main Content Area */}
      {!tree ? (
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
          <FolderOpen size={64} color="#60a5fa" style={{ filter: 'drop-shadow(0 0 16px rgba(96, 165, 250, 0.5))' }} />
          <div>
            <h2 style={{ margin: '0 0 12px 0', color: 'white', fontSize: '24px' }}>No Workspace Open</h2>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', maxWidth: '400px' }}>Select a repository above or open your default workspace to start exploring files.</p>
          </div>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)' }}>Choose a folder with the repository picker above.</p>
        </div>
      ) : (
        <div className="explorer-workspace-grid" style={{ gap: '20px', minHeight: '620px', height: 'calc(100vh - 310px)' }}>
          {/* Left Column: Repository Tree */}
          <div style={{ ...cardStyle, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '18px' }}>
            <h3 style={{ margin: '0 0 20px 0', color: 'white', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={18} color="#60a5fa" />
              Project Files
            </h3>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <RepositoryTree root={tree} onSelectFile={onSelectFile} selectedFilePath={selectedFile?.path} />
            </div>
          </div>

          {/* Right Column: File Inspector */}
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {!selectedFile ? (
               <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                textAlign: 'center',
                gap: '20px'
              }}>
                <FileCode2 size={56} color="rgba(255,255,255,0.2)" style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.1))' }} />
                <div>
                  <h3 style={{ margin: '0 0 8px 0', color: 'rgba(255,255,255,0.8)', fontSize: '20px' }}>No File Selected</h3>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>Select a file from the explorer to view its details and contents.</p>
                </div>
              </div>
            ) : (
              <FileInspector file={selectedFile} onClose={onCloseFile} onAskAI={onAskAI} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
