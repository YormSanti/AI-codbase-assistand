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
    response = api_client.post("/api/repositories/open", json={"path": str(tmp_path / "non_existent")})

    assert response.status_code == 400


def test_open_repository_non_git_directory(api_client: TestClient, tmp_path: Path) -> None:
    folder = tmp_path / "my_project"
    folder.mkdir()
    (folder / "app.py").write_text("print('hello')\n")

    response = api_client.post("/api/repositories/open", json={"path": str(folder)})

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "my_project"
    assert body["file_count"] == 1


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


def test_delete_repository_endpoint(api_client: TestClient, git_repo_path: Path) -> None:
    opened = api_client.post("/api/repositories/open", json={"path": str(git_repo_path)})
    repository_id = opened.json()["id"]

    response = api_client.delete(f"/api/repositories/{repository_id}")

    assert response.status_code == 204
    assert api_client.get("/api/repositories").json() == []
    assert api_client.get(f"/api/repositories/{repository_id}/tree").status_code == 404


def test_delete_unknown_repository_returns_404(api_client: TestClient) -> None:
    response = api_client.delete("/api/repositories/999")

    assert response.status_code == 404


def test_health_endpoint(api_client: TestClient) -> None:
    response = api_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_reindex_repository_endpoint(api_client: TestClient, git_repo_path: Path) -> None:
    opened = api_client.post("/api/repositories/open", json={"path": str(git_repo_path)})
    repository_id = opened.json()["id"]
    (git_repo_path / "added.py").write_text("x = 1\n")

    response = api_client.post(f"/api/repositories/{repository_id}/reindex")

    assert response.status_code == 200
    assert response.json()["file_count"] == 6


def test_reindex_unknown_repository_returns_404(api_client: TestClient) -> None:
    assert api_client.post("/api/repositories/999/reindex").status_code == 404


def test_workspace_symbol_search_ranks_exact_then_prefix_then_substring(api_client: TestClient, tmp_path: Path) -> None:
    root = tmp_path / "symbols"
    root.mkdir()
    (root / "models.py").write_text(
        "import os\n\n"
        "class Order:\n    def total(self):\n        return 0\n\n"
        "class OrderLine:\n    pass\n\n"
        "def build_order():\n    pass\n\n"
        "def reorder_items():\n    pass\n"
    )
    (root / "web").mkdir()
    (root / "web" / "orders.ts").write_text("export function loadOrders() { return []; }\nexport class Cart {}\n")
    repo_id = api_client.post("/api/repositories/open", json={"path": str(root)}).json()["id"]

    response = api_client.get(f"/api/repositories/{repo_id}/symbols", params={"q": "order"})
    assert response.status_code == 200
    names = [(hit["name"], hit["kind"], hit["path"]) for hit in response.json()]
    assert names[0] == ("Order", "class", "models.py")
    assert names[1] == ("OrderLine", "class", "models.py")
    assert ("build_order", "function", "models.py") in names
    assert ("loadOrders", "function", "web/orders.ts") in names
    assert all(name != "os" for name, _, _ in names)  # imports are not workspace symbols

    method = api_client.get(f"/api/repositories/{repo_id}/symbols", params={"q": "TOTAL"}).json()
    assert method == [{"name": "total", "kind": "method", "path": "models.py", "start_line": 4, "end_line": 5, "parent_name": "Order"}]

    # LIKE wildcards in the query are literal characters.
    assert api_client.get(f"/api/repositories/{repo_id}/symbols", params={"q": "%"}).json() == []
    assert api_client.get(f"/api/repositories/{repo_id}/symbols", params={"q": "_"}).json()[0]["name"] == "build_order"
    assert len(api_client.get(f"/api/repositories/{repo_id}/symbols", params={"q": "o", "limit": 2}).json()) == 2
    assert api_client.get(f"/api/repositories/{repo_id}/symbols", params={"q": ""}).status_code == 422
    assert api_client.get("/api/repositories/999/symbols", params={"q": "x"}).status_code == 404


def test_tree_reports_symbol_counts_per_file(api_client: TestClient, tmp_path: Path) -> None:
    root = tmp_path / "counts"
    root.mkdir()
    (root / "models.py").write_text("import os\n\nclass Order:\n    def total(self):\n        return 0\n\ndef build():\n    pass\n")
    (root / "notes.md").write_text("# Notes\n")
    (root / "empty.py").write_text("VALUE = 1\n")
    repo_id = api_client.post("/api/repositories/open", json={"path": str(root)}).json()["id"]

    children = {child["name"]: child for child in api_client.get(f"/api/repositories/{repo_id}/tree").json()["children"]}

    assert children["models.py"]["symbol_count"] == 3  # Order, total, build; the import is not counted
    assert children["empty.py"]["symbol_count"] is None
    assert children["notes.md"]["symbol_count"] is None


def test_open_repository_requires_a_full_path(api_client: TestClient) -> None:
    for path in ("sample_repo", "./src", "", "   "):
        response = api_client.post("/api/repositories/open", json={"path": path})
        assert response.status_code == 400, path
    assert "full path" in api_client.post("/api/repositories/open", json={"path": "sample_repo"}).json()["detail"]


def test_open_repository_trims_whitespace_and_quotes(api_client: TestClient, git_repo_path: Path) -> None:
    for path in (f"  {git_repo_path}\n", f'"{git_repo_path}"', f"'{git_repo_path}'"):
        response = api_client.post("/api/repositories/open", json={"path": path})
        assert response.status_code == 200, path
        assert response.json()["root_path"] == str(git_repo_path.resolve())
