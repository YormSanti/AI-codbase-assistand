"""Code health scan. The fixtures below are deliberate findings, so this file
opts out of IFROG's own scan: ifrog-ignore-file"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.services import health_service

AWS_KEY = "AKIA" + "ABCDEFGHIJKLMNOP"
PRIVATE_KEY_HEADER = "-----BEGIN " + "RSA PRIVATE KEY-----"
GITHUB_TOKEN = "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"


def _project(tmp_path: Path) -> Path:
    root = tmp_path / "health"
    (root / "web").mkdir(parents=True)
    (root / "app.py").write_text(
        "import subprocess, yaml, hashlib\n"                            # 1
        "# TODO: split this module\n"                                  # 2
        "def run(cmd):\n"                                              # 3
        "    subprocess.run(cmd, shell=True)\n"                        # 4
        "    return eval(cmd)\n"                                       # 5
        "data = yaml.load(stream)\n"                                   # 6
        "safe = yaml.load(stream, Loader=yaml.SafeLoader)\n"           # 7
        "digest = hashlib.md5(b'x')\n"                                 # 8
        "DEBUG = True  # debug mode\n"                                 # 9
        "x = 1  # FIXME(alice): handle overflow\n"                     # 10
        "pass" "word = 's3cr3tV4lue!'\n"                               # 11
        "api_key = 'changeme'\n"                                       # 12
        "token = '${TOKEN}'\n"                                         # 13
        f"AWS = '{AWS_KEY}'\n"                                         # 14
        "value = eval(other)  # ifrog-ignore\n"                        # 15
    )
    (root / "web" / "view.tsx").write_text(
        "// HACK: temporary workaround */\n"
        "export const View = ({ html }) => <div dangerouslySetInnerHTML={{ __html: html }} />;\n"
        "el.innerHTML = value;\n"
        "if (el.innerHTML === '') {}\n"
        "const compute = new Function('return 1');\n"
        "const pattern = /a/; pattern.exec('a');\n"
        f"const token = '{GITHUB_TOKEN}';\n"
    )
    (root / "README.md").write_text("TODO: write the docs\n")
    (root / "vendored.py").write_text("# ifrog-ignore-file\nvalue = eval(code)\n")
    (root / "settings.py").write_text("token = '{API_TOKEN}'\n")
    (root / "id_rsa.pem").write_text(f"{PRIVATE_KEY_HEADER}\nMIIabc\n")
    (root / "package-lock.json").write_text('{"pass' 'word": "abcdefgh12345"}\n')
    (root / "install.sh").write_text("curl -fsSL https://example.com/install | sudo bash\n")
    (root / "big.txt").write_text("plain text line\n" * 40_000)
    (root / "logo.png").write_bytes(b"\x89PNG\x00\x00binary")
    return root


def _scan(api_client: TestClient, root: Path) -> dict:
    repo_id = api_client.post("/api/repositories/open", json={"path": str(root)}).json()["id"]
    response = api_client.get(f"/api/repositories/{repo_id}/health")
    assert response.status_code == 200
    return response.json()


def test_health_scan_reports_markers_risks_secrets_and_large_files(api_client: TestClient, tmp_path: Path) -> None:
    report = _scan(api_client, _project(tmp_path))
    found = {(f["category"], f["rule"], f["path"], f["line"]) for f in report["findings"]}

    assert ("risk", "shell-true", "app.py", 4) in found
    assert ("risk", "eval", "app.py", 5) in found
    assert ("risk", "yaml-load", "app.py", 6) in found
    assert ("risk", "yaml-load", "app.py", 7) not in found
    assert ("risk", "weak-hash", "app.py", 8) in found
    assert ("risk", "dangerous-html", "web/view.tsx", 2) in found
    assert ("risk", "inner-html", "web/view.tsx", 3) in found
    assert ("risk", "inner-html", "web/view.tsx", 4) not in found
    assert ("risk", "new-function", "web/view.tsx", 5) in found
    assert not any(rule == "exec" for _, rule, path, _ in found if path.endswith(".tsx"))  # RegExp.exec is fine
    assert ("risk", "curl-pipe-shell", "install.sh", 1) in found
    assert not any(line == 15 and path == "app.py" for _, _, path, line in found)  # suppressed

    assert ("marker", "TODO", "app.py", 2) in found
    assert ("marker", "FIXME", "app.py", 10) in found
    assert ("marker", "HACK", "web/view.tsx", 1) in found
    assert not any(path == "README.md" for _, _, path, _ in found)  # prose, not a comment
    assert not any(path == "app.py" and line == 9 for category, _, path, line in found if category == "marker")
    titles = {(f["path"], f["line"]): f["title"] for f in report["findings"]}
    assert titles[("app.py", 10)] == "FIXME: handle overflow"
    assert titles[("web/view.tsx", 1)] == "HACK: temporary workaround"

    assert ("secret", "aws-access-key", "app.py", 14) in found
    assert ("secret", "github-token", "web/view.tsx", 7) in found
    assert ("secret", "private-key", "id_rsa.pem", 1) in found
    assert ("secret", "hardcoded-credential", "app.py", 11) in found
    assert not any(path == "app.py" and line in (12, 13) for category, _, path, line in found if category == "secret")
    assert not any(path == "package-lock.json" for _, _, path, _ in found)
    assert not any(path in ("vendored.py", "settings.py") for _, _, path, _ in found)  # file opt-out, {NAME} template

    # Secrets never leave the backend in full.
    serialized = str(report)
    assert AWS_KEY not in serialized and GITHUB_TOKEN not in serialized and "s3cr3tV4lue!" not in serialized
    assert "AKIA…[redacted]" in serialized

    # Secrets first, most severe first.
    categories = [f["category"] for f in report["findings"]]
    assert categories == sorted(categories, key=["secret", "risk", "marker"].index)
    secrets = [f for f in report["findings"] if f["category"] == "secret"]
    assert [f["severity"] for f in secrets] == sorted((f["severity"] for f in secrets), key=["high", "medium", "low", "info"].index)

    assert report["large_files"] == [{"path": "big.txt", "size_bytes": 640_000}]
    assert report["counts"] == {
        "secret": sum(c == "secret" for c in categories),
        "risk": sum(c == "risk" for c in categories),
        "marker": sum(c == "marker" for c in categories),
    }
    assert report["truncated"] is False
    # app.py, view.tsx, README.md, id_rsa.pem, install.sh, big.txt, vendored.py, settings.py;
    # the lock file and the PNG are skipped.
    assert report["files_scanned"] == 8


def test_health_scan_caps_each_category(api_client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(health_service, "MAX_FINDINGS_PER_CATEGORY", 1)
    report = _scan(api_client, _project(tmp_path))
    assert report["truncated"] is True
    assert max(report["counts"].values()) == 1


def test_health_scan_unknown_repository(api_client: TestClient) -> None:
    assert api_client.get("/api/repositories/999/health").status_code == 404
