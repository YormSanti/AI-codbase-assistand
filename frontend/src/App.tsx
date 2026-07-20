import { useState } from "react";
import "./App.css";
import { repositoryApi } from "./api/repositoryApi";
import { ApiError } from "./api/client";
import { RepositoryPicker } from "./components/RepositoryPicker";
import { RepositoryTree } from "./components/RepositoryTree";
import type { RepositoryInfo, TreeNode } from "./types/domain";

function App() {
  const [repository, setRepository] = useState<RepositoryInfo | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen(path: string) {
    setIsLoading(true);
    setError(null);
    try {
      const info = await repositoryApi.open(path);
      const treeData = await repositoryApi.getTree(info.id);
      setRepository(info);
      setTree(treeData);
    } catch (err) {
      setRepository(null);
      setTree(null);
      setError(err instanceof ApiError ? err.message : "Failed to open repository");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>DevPilot AI</h1>
        <p className="subtitle">Developer Intelligence Platform</p>
      </header>

      <RepositoryPicker onOpen={handleOpen} isLoading={isLoading} />

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {repository && (
        <section className="repository-summary">
          <h2>{repository.name}</h2>
          <dl>
            <dt>Branch</dt>
            <dd>{repository.current_branch ?? "—"}</dd>
            <dt>HEAD</dt>
            <dd>{repository.head_commit ? repository.head_commit.slice(0, 7) : "—"}</dd>
            <dt>Files indexed</dt>
            <dd>{repository.file_count}</dd>
          </dl>
        </section>
      )}

      {tree && <RepositoryTree root={tree} />}
    </div>
  );
}

export default App;
