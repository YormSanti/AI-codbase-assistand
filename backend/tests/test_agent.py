import json
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.services import agent_service


def _fake_cli(tmp_path: Path, script: str) -> str:
    binary = tmp_path / "fake-cli"
    binary.write_text("#!/bin/sh\n" + script)
    binary.chmod(0o755)
    return str(binary)


def _events(response) -> list[dict]:
    return [json.loads(line) for line in response.text.splitlines() if line]


def test_run_streams_chunks_then_done_in_the_project_folder(api_client: TestClient, git_repo_path: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    binary = _fake_cli(tmp_path, 'pwd\nfor last; do :; done\necho "you said: $last"\n')
    monkeypatch.setattr(agent_service, "find_binary", lambda name: binary)
    repo_id = api_client.post("/api/repositories/open", json={"path": str(git_repo_path)}).json()["id"]

    response = api_client.post("/api/agent/run", json={"provider": "codex", "prompt": "  hello  ", "repository_id": repo_id})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    events = _events(response)
    assert all(event["type"] == "chunk" for event in events[:-1])
    assert events[-1] == {"type": "done", "content": f"{git_repo_path}\nyou said: hello"}
    assert "".join(event["text"] for event in events[:-1]).strip() == events[-1]["content"]


def test_run_reports_failures_missing_cli_and_empty_replies(api_client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    failing = _fake_cli(tmp_path, 'echo "quota exceeded" >&2\nexit 3\n')
    monkeypatch.setattr(agent_service, "find_binary", lambda name: failing)
    events = _events(api_client.post("/api/agent/run", json={"provider": "gemini", "prompt": "hi"}))
    assert events[-1] == {"type": "error", "message": "Gemini failed: quota exceeded"}

    silent = _fake_cli(tmp_path, "exit 0\n")
    monkeypatch.setattr(agent_service, "find_binary", lambda name: silent)
    assert _events(api_client.post("/api/agent/run", json={"provider": "codex", "prompt": "hi"}))[-1]["message"] == "Codex returned an empty response."

    monkeypatch.setattr(agent_service, "find_binary", lambda name: None)
    missing = _events(api_client.post("/api/agent/run", json={"provider": "codex", "prompt": "hi"}))
    assert missing == [{"type": "error", "message": "Codex CLI was not found. Install it, sign in with `codex login` in the Terminal page, then try again."}]


def test_run_validates_requests(api_client: TestClient) -> None:
    assert api_client.post("/api/agent/run", json={"provider": "other", "prompt": "hi"}).status_code == 422
    assert api_client.post("/api/agent/run", json={"provider": "codex", "prompt": ""}).status_code == 422
    assert api_client.post("/api/agent/run", json={"provider": "codex", "prompt": "   "}).status_code == 422
    assert api_client.post("/api/agent/run", json={"provider": "codex", "prompt": "x" * 64_001}).status_code == 422
    assert api_client.post("/api/agent/run", json={"provider": "codex", "prompt": "hi", "repository_id": 999}).status_code == 404


def test_provider_status(api_client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    signed_in = _fake_cli(tmp_path, "exit 0\n")
    monkeypatch.setattr(agent_service, "find_binary", lambda name: signed_in if name == "codex" else None)
    assert api_client.get("/api/agent/providers").json() == {
        "codex": {"installed": True, "authenticated": True},
        "gemini": {"installed": False, "authenticated": False},
    }
    monkeypatch.setattr(agent_service, "find_binary", lambda name: signed_in)
    monkeypatch.setenv("GEMINI_API_KEY", "set")
    assert api_client.get("/api/agent/providers").json()["gemini"] == {"installed": True, "authenticated": True}


def test_run_keeps_multibyte_characters_split_across_reads(api_client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # "é" is two bytes in UTF-8; the pause makes the reader see them in separate reads.
    binary = _fake_cli(tmp_path, "printf 'caf\\303'\nsleep 0.2\nprintf '\\251 ok\\n'\n")
    monkeypatch.setattr(agent_service, "find_binary", lambda name: binary)
    events = _events(api_client.post("/api/agent/run", json={"provider": "codex", "prompt": "hi"}))
    assert events[-1] == {"type": "done", "content": "café ok"}
    assert "\ufffd" not in "".join(event.get("text", "") for event in events)


def test_run_stops_a_cli_that_hangs_without_output(api_client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # The child sleep keeps stdout open, so only killing the whole process group ends the read.
    binary = _fake_cli(tmp_path, "sleep 30 &\nwait\n")
    monkeypatch.setattr(agent_service, "find_binary", lambda name: binary)
    monkeypatch.setattr(agent_service, "RUN_TIMEOUT_SECONDS", 0.5)
    started = time.monotonic()
    events = _events(api_client.post("/api/agent/run", json={"provider": "codex", "prompt": "hi"}))
    assert time.monotonic() - started < 10
    assert len(events) == 1 and events[0]["type"] == "error"
    assert events[0]["message"].startswith("Codex did not finish within")
