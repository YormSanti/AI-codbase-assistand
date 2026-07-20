from pathlib import Path

from fastapi.testclient import TestClient


def test_open_repository_endpoint(api_client: TestClient, git_repo_path: Path) -> None:
    response = api_client.post("/api/repositories/open", json={"path": str(git_repo_path)})

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == git_repo_path.name
    assert body["file_count"] == 5
    assert body["id"] is not None


def test_open_repository_invalid_path_returns_400(api_client: TestClient, tmp_path: Path) -> None:
    response = api_client.post("/api/repositories/open", json={"path": str(tmp_path)})

    assert response.status_code == 400


def test_get_tree_endpoint(api_client: TestClient, git_repo_path: Path) -> None:
    open_response = api_client.post("/api/repositories/open", json={"path": str(git_repo_path)})
    repo_id = open_response.json()["id"]

    tree_response = api_client.get(f"/api/repositories/{repo_id}/tree")

    assert tree_response.status_code == 200
    tree = tree_response.json()
    assert tree["is_directory"] is True
    file_names = {child["name"] for child in tree["children"]}
    assert "main.py" in file_names


def test_get_tree_unknown_repository_returns_404(api_client: TestClient) -> None:
    response = api_client.get("/api/repositories/999/tree")

    assert response.status_code == 404


def test_list_repositories_endpoint(api_client: TestClient, git_repo_path: Path) -> None:
    api_client.post("/api/repositories/open", json={"path": str(git_repo_path)})

    response = api_client.get("/api/repositories")

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_health_endpoint(api_client: TestClient) -> None:
    response = api_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
