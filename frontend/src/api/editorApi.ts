import { apiRequest } from './client';
import type { CodeSymbol, FilePreview, SearchResults, TreeNode } from '../types/domain';

function fileUrl(repositoryId: number, resource: string, path: string) {
  return `/api/repositories/${repositoryId}/editor/${resource}?${new URLSearchParams({ path })}`;
}

export const editorApi = {
  getTree(repositoryId: number): Promise<TreeNode> {
    return apiRequest(`/api/repositories/${repositoryId}/editor/tree`);
  },
  getContent(repositoryId: number, path: string): Promise<FilePreview> {
    return apiRequest(fileUrl(repositoryId, 'content', path));
  },
  getSymbols(repositoryId: number, path: string): Promise<CodeSymbol[]> {
    return apiRequest(fileUrl(repositoryId, 'symbols', path));
  },
  /** Plain-text search across the project's text files; dependency folders are skipped server-side. */
  search(repositoryId: number, query: string, options: { caseSensitive?: boolean; limit?: number } = {}): Promise<SearchResults> {
    const params = new URLSearchParams({ q: query });
    if (options.caseSensitive) params.set('case_sensitive', 'true');
    if (options.limit) params.set('limit', String(options.limit));
    return apiRequest(`/api/repositories/${repositoryId}/editor/search?${params}`);
  },
  saveContent(repositoryId: number, path: string, content: string, expectedHash: string): Promise<FilePreview> {
    return apiRequest(fileUrl(repositoryId, 'content', path), {
      method: 'PUT', body: JSON.stringify({ content, expected_hash: expectedHash }),
    });
  },
};
