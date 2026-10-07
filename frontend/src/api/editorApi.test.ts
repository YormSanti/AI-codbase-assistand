import { afterEach, expect, it, vi } from 'vitest';
import { editorApi } from './editorApi';

afterEach(() => vi.unstubAllGlobals());

it('uses editor-scoped endpoints and encodes local paths without treating them as routes', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
  const path = '.config/a #?&.env';
  await editorApi.getTree(5);
  await editorApi.getContent(5, path);
  await editorApi.getSymbols(5, path);
  await editorApi.saveContent(5, path, 'MODE=test', 'a'.repeat(64));
  expect(fetchMock.mock.calls[0][0]).toContain('/api/repositories/5/editor/tree');
  for (const [url] of fetchMock.mock.calls.slice(1)) {
    expect(new URL(url).searchParams.get('path')).toBe(path);
    expect(new URL(url).pathname).toMatch(/^\/api\/repositories\/5\/editor\/(content|symbols)$/);
  }
  expect(fetchMock.mock.calls[3][1]).toMatchObject({ method: 'PUT', body: JSON.stringify({ content: 'MODE=test', expected_hash: 'a'.repeat(64) }) });
});
