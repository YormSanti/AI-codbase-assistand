from pathlib import Path
import hashlib
import os
import stat

from fastapi.testclient import TestClient
import pytest


def _open_and_get_main_py_file_id(api_client: TestClient, git_repo_path: Path) -> int:
    open_response = api_client.post("/api/repositories/open", json={"path": str(git_repo_path)})
    repo_id = open_response.json()["id"]

    tree = api_client.get(f"/api/repositories/{repo_id}/tree").json()
    main_py = next(child for child in tree["children"] if child["name"] == "main.py")
    return main_py["file_id"]


def test_get_file_symbols_returns_extracted_symbols(
    api_client: TestClient, git_repo_path: Path
) -> None:
    file_id = _open_and_get_main_py_file_id(api_client, git_repo_path)

    response = api_client.get(f"/api/files/{file_id}/symbols")

    assert response.status_code == 200
    body = response.json()
    assert [s["name"] for s in body] == ["main"]
    assert body[0]["kind"] == "function"


def test_get_file_symbols_unknown_file_returns_404(api_client: TestClient) -> None:
    response = api_client.get("/api/files/999/symbols")

    assert response.status_code == 404


def test_get_file_content_returns_source(api_client: TestClient, git_repo_path: Path) -> None:
    file_id = _open_and_get_main_py_file_id(api_client, git_repo_path)

    response = api_client.get(f"/api/files/{file_id}/content")

    assert response.status_code == 200
    assert response.json() == {
        "file_id": file_id,
        "path": "main.py",
        "content": "def main():\n    pass\n",
        "is_binary": False,
        "truncated": False,
        "content_hash": hashlib.sha256(b"def main():\n    pass\n").hexdigest(),
        "size_bytes": 21,
        "editable": True,
        "editing_disabled_reason": None,
    }


def test_get_file_content_unknown_file_returns_404(api_client: TestClient) -> None:
    response = api_client.get("/api/files/999/content")

    assert response.status_code == 404


def _save(api_client: TestClient, file_id: int, content: str, expected_hash: str | None = None):
    if expected_hash is None:
        expected_hash = api_client.get(f"/api/files/{file_id}/content").json()["content_hash"]
    return api_client.put(
        f"/api/files/{file_id}/content", json={"content": content, "expected_hash": expected_hash}
    )


def test_save_updates_disk_metadata_and_symbols_without_changing_file_id(
    api_client: TestClient, git_repo_path: Path
) -> None:
    file_id = _open_and_get_main_py_file_id(api_client, git_repo_path)
    source = git_repo_path / "main.py"
    source.chmod(0o755)
    content = "def renamed():\n    return 'hello'\n"

    response = _save(api_client, file_id, content)

    assert response.status_code == 200
    saved = response.json()
    assert saved["file_id"] == file_id
    assert saved["content"] == content
    assert saved["content_hash"] == hashlib.sha256(content.encode()).hexdigest()
    assert saved["size_bytes"] == len(content.encode())
    assert source.read_bytes() == content.encode()
    assert stat.S_IMODE(source.stat().st_mode) == 0o755
    assert [s["name"] for s in api_client.get(f"/api/files/{file_id}/symbols").json()] == ["renamed"]
    repo_id = api_client.get("/api/repositories").json()[0]["id"]
    tree = api_client.get(f"/api/repositories/{repo_id}/tree").json()
    node = next(child for child in tree["children"] if child["name"] == "main.py")
    assert node["file_id"] == file_id
    assert node["size_bytes"] == len(content.encode())
    assert sorted(p.name for p in git_repo_path.iterdir()) == [
        ".git", ".gitignore", "README.md", "ignored.txt", "main.py", "src", "untracked.py",
    ]


def test_save_rejects_external_changes_without_overwriting_them(
    api_client: TestClient, git_repo_path: Path
) -> None:
    file_id = _open_and_get_main_py_file_id(api_client, git_repo_path)
    original_hash = api_client.get(f"/api/files/{file_id}/content").json()["content_hash"]
    (git_repo_path / "main.py").write_text("external change\n")

    response = _save(api_client, file_id, "editor change\n", original_hash)

    assert response.status_code == 409
    assert (git_repo_path / "main.py").read_text() == "external change\n"


def test_two_saves_using_the_same_version_cannot_overwrite_each_other(
    api_client: TestClient, git_repo_path: Path
) -> None:
    file_id = _open_and_get_main_py_file_id(api_client, git_repo_path)
    original_hash = api_client.get(f"/api/files/{file_id}/content").json()["content_hash"]
    assert _save(api_client, file_id, "first save\n", original_hash).status_code == 200
    assert _save(api_client, file_id, "second save\n", original_hash).status_code == 409
    assert (git_repo_path / "main.py").read_text() == "first save\n"


def test_save_detects_external_changes_while_preparing_the_replacement(
    api_client: TestClient, git_repo_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = _open_and_get_main_py_file_id(api_client, git_repo_path)
    original_fsync = os.fsync
    before = set(git_repo_path.iterdir())

    def external_save(descriptor: int) -> None:
        original_fsync(descriptor)
        (git_repo_path / "main.py").write_text("external save\n")

    monkeypatch.setattr("app.services.file_content_service.os.fsync", external_save)
    assert _save(api_client, file_id, "editor save\n").status_code == 409
    assert (git_repo_path / "main.py").read_text() == "external save\n"
    assert set(git_repo_path.iterdir()) == before


@pytest.mark.parametrize("content", ["", "# café 🐸\r\n", "\ufeff# BOM\n"])
def test_save_preserves_exact_utf8_content(
    api_client: TestClient, git_repo_path: Path, content: str
) -> None:
    file_id = _open_and_get_main_py_file_id(api_client, git_repo_path)
    assert _save(api_client, file_id, content).status_code == 200
    assert (git_repo_path / "main.py").read_bytes() == content.encode("utf-8")


@pytest.mark.parametrize("raw", [b"\x00binary", b"\xffinvalid utf8", b"x" * 512_001], ids=["binary", "non-utf8", "oversize"])
def test_preview_and_save_disable_unsafe_text_files(
    api_client: TestClient, git_repo_path: Path, raw: bytes
) -> None:
    file_id = _open_and_get_main_py_file_id(api_client, git_repo_path)
    (git_repo_path / "main.py").write_bytes(raw)
    preview = api_client.get(f"/api/files/{file_id}/content").json()
    assert preview["editable"] is False
    assert preview["editing_disabled_reason"]
    assert _save(api_client, file_id, "replacement", "a" * 64).status_code == 400
    assert (git_repo_path / "main.py").read_bytes() == raw


@pytest.mark.parametrize("content", ["nul\x00content", "é" * 256_001], ids=["nul", "oversize-utf8"])
def test_save_rejects_binary_or_oversize_payload(
    api_client: TestClient, git_repo_path: Path, content: str
) -> None:
    file_id = _open_and_get_main_py_file_id(api_client, git_repo_path)
    assert _save(api_client, file_id, content).status_code == 400
    assert (git_repo_path / "main.py").read_text() == "def main():\n    pass\n"


def test_save_rejects_unknown_or_deleted_file(api_client: TestClient, git_repo_path: Path) -> None:
    assert _save(api_client, 999, "replacement", "a" * 64).status_code == 404
    file_id = _open_and_get_main_py_file_id(api_client, git_repo_path)
    (git_repo_path / "main.py").unlink()
    assert _save(api_client, file_id, "replacement", "a" * 64).status_code == 404


@pytest.mark.parametrize("outside", [False, True])
def test_save_rejects_symbolic_links(
    api_client: TestClient, git_repo_path: Path, tmp_path: Path, outside: bool
) -> None:
    file_id = _open_and_get_main_py_file_id(api_client, git_repo_path)
    target = (tmp_path if outside else git_repo_path) / "target.py"
    target.write_text("untouched\n")
    source = git_repo_path / "main.py"
    source.unlink()
    source.symlink_to(target)
    response = _save(api_client, file_id, "replacement", "a" * 64)
    assert response.status_code == (404 if outside else 400)
    assert target.read_text() == "untouched\n"
    assert source.is_symlink()


def test_save_rejects_read_only_file(api_client: TestClient, git_repo_path: Path) -> None:
    file_id = _open_and_get_main_py_file_id(api_client, git_repo_path)
    (git_repo_path / "main.py").chmod(0o444)
    assert api_client.get(f"/api/files/{file_id}/content").json()["editable"] is False
    assert _save(api_client, file_id, "replacement", "a" * 64).status_code == 400


def test_save_failure_leaves_original_file_and_cleans_temp_file(
    api_client: TestClient, git_repo_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = _open_and_get_main_py_file_id(api_client, git_repo_path)
    before = set(git_repo_path.iterdir())

    def fail_replace(*args):
        raise PermissionError("read-only directory")

    monkeypatch.setattr("app.services.file_content_service.os.replace", fail_replace)
    assert _save(api_client, file_id, "replacement").status_code == 400
    assert (git_repo_path / "main.py").read_text() == "def main():\n    pass\n"
    assert set(git_repo_path.iterdir()) == before


def test_save_requires_a_valid_version_token(api_client: TestClient, git_repo_path: Path) -> None:
    file_id = _open_and_get_main_py_file_id(api_client, git_repo_path)
    response = api_client.put(f"/api/files/{file_id}/content", json={"content": "replacement"})
    assert response.status_code == 422
