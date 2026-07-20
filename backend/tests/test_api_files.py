from pathlib import Path

from fastapi.testclient import TestClient


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
