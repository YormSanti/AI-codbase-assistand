from pathlib import Path

from fastapi.testclient import TestClient
import pytest


def paths(tree: dict) -> dict[str, dict]:
    return {tree['path']: tree} | {
        path: node for child in tree['children'] for path, node in paths(child).items()
    }


def open_editor(client: TestClient, root: Path) -> str:
    info = client.post('/api/repositories/open', json={'path': str(root)}).json()
    return f"/api/repositories/{info['id']}/editor"


@pytest.mark.parametrize('git_project', [True, False], ids=['git', 'plain'])
def test_complete_listing_is_exclusive_to_editor(api_client, git_repo_path, tmp_path, git_project):
    root = git_repo_path if git_project else tmp_path / 'plain'
    root.mkdir(exist_ok=True)
    (root / '.gitignore').write_text('.env\nprivate/\nnode_modules/\ndist/\n')
    for path in ['.env', 'private/secret.py', 'node_modules/pkg/index.js', 'dist/out.js', '.config/tool.json', 'new.txt']:
        file = root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text('sample\n')
    (root / 'empty').mkdir()
    url = open_editor(api_client, root)
    repository_url = url.removesuffix('/editor')
    before_tree = api_client.get(repository_url + '/tree').json()
    before_info = api_client.get(repository_url).json()

    response = api_client.get(url + '/tree')
    assert response.status_code == 200
    all_files = paths(response.json())
    assert {'.env', '.gitignore', '.config/tool.json', 'private/secret.py', 'node_modules/pkg/index.js', 'dist/out.js', 'new.txt', 'empty'} <= all_files.keys()
    assert all_files['empty']['is_directory']
    assert all_files['.env']['file_id'] < 0
    assert all_files['.env']['file_id'] == paths(api_client.get(url + '/tree').json())['.env']['file_id']
    if git_project:
        assert '.git/config' in all_files
        assert all_files['main.py']['file_id'] == paths(before_tree)['main.py']['file_id']

    # No editor-only file or symbol becomes visible in other features.
    assert '.env' not in paths(before_tree)
    assert api_client.get(repository_url + '/tree').json() == before_tree
    assert api_client.get(repository_url).json() == before_info
    assert api_client.get(f"/api/files/{all_files['.env']['file_id']}/content").status_code == 404


def test_edit_ignored_file_without_indexing_it(api_client, git_repo_path):
    root = git_repo_path
    (root / '.gitignore').write_text('.env\nprivate.py\n')
    (root / '.env').write_bytes(b'APP_MODE=dev\r\n')
    (root / 'private.py').write_text('def original():\n    pass\n')
    url = open_editor(api_client, root)
    index_before = api_client.get(url.removesuffix('/editor') + '/tree').json()
    preview = api_client.get(url + '/content', params={'path': '.env'}).json()
    assert preview['editable']
    response = api_client.put(url + '/content', params={'path': '.env'}, json={'content': 'APP_MODE=test\r\n', 'expected_hash': preview['content_hash']})
    assert response.status_code == 200
    assert (root / '.env').read_bytes() == b'APP_MODE=test\r\n'
    assert response.json()['file_id'] == preview['file_id']
    stale = api_client.put(url + '/content', params={'path': '.env'}, json={'content': 'old', 'expected_hash': preview['content_hash']})
    assert stale.status_code == 409
    assert (root / '.env').read_bytes() == b'APP_MODE=test\r\n'
    assert api_client.get(url.removesuffix('/editor') + '/tree').json() == index_before
    assert [s['name'] for s in api_client.get(url + '/symbols', params={'path': 'private.py'}).json()] == ['original']
    assert 'private.py' not in paths(api_client.get(url.removesuffix('/editor') + '/tree').json())


@pytest.mark.parametrize('path', ['../outside.txt', '/etc/passwd', '', 'missing.txt', '.'])
def test_editor_paths_stay_inside_project(api_client, git_repo_path, path):
    url = open_editor(api_client, git_repo_path)
    assert api_client.get(url + '/content', params={'path': path}).status_code == 404
    assert api_client.put(url + '/content', params={'path': path}, json={'content': 'x', 'expected_hash': 'a' * 64}).status_code == 404


def test_listing_does_not_follow_directory_symlinks(api_client, git_repo_path, tmp_path):
    external = tmp_path / 'external'
    external.mkdir()
    (external / 'outside.txt').write_text('outside')
    (git_repo_path / 'linked-folder').symlink_to(external, target_is_directory=True)
    (git_repo_path / 'loop').symlink_to(git_repo_path, target_is_directory=True)
    (git_repo_path / 'linked-file').symlink_to(external / 'outside.txt')
    url = open_editor(api_client, git_repo_path)
    tree = paths(api_client.get(url + '/tree').json())
    assert tree['linked-folder']['children'] == []
    assert tree['loop']['children'] == []
    assert api_client.get(url + '/content', params={'path': 'linked-file'}).status_code == 404
    assert api_client.get(url + '/content', params={'path': 'linked-folder/outside.txt'}).status_code == 404


@pytest.mark.parametrize('content', [b'\x00binary', b'\xffinvalid', b'x' * 512_001], ids=['binary', 'encoding', 'oversized'])
def test_editor_lists_uneditable_files_without_allowing_save(api_client, git_repo_path, content):
    (git_repo_path / '.env').write_bytes(content)
    url = open_editor(api_client, git_repo_path)
    assert '.env' in paths(api_client.get(url + '/tree').json())
    preview = api_client.get(url + '/content', params={'path': '.env'}).json()
    assert not preview['editable']
    response = api_client.put(url + '/content', params={'path': '.env'}, json={'content': 'replacement', 'expected_hash': preview['content_hash'] or 'a' * 64})
    assert response.status_code == 400
    assert (git_repo_path / '.env').read_bytes() == content


def test_editor_refresh_lists_new_files_and_unknown_project_is_404(api_client, git_repo_path):
    url = open_editor(api_client, git_repo_path)
    assert '.env' not in paths(api_client.get(url + '/tree').json())
    (git_repo_path / '.env').write_text('new')
    assert '.env' in paths(api_client.get(url + '/tree').json())
    assert api_client.get('/api/repositories/999/editor/tree').status_code == 404
