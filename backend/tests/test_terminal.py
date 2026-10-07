import pytest
from fastapi.testclient import TestClient
from app.main import app


def test_terminal_websocket_invalid_directory(api_client: TestClient) -> None:
    with api_client.websocket_connect("/ws/terminal?cwd=/path_that_does_not_exist_xyz") as ws:
        msg = ws.receive_text()
        assert "Terminal directory does not exist" in msg


def test_terminal_websocket_interactive_session(api_client: TestClient) -> None:
    with api_client.websocket_connect("/ws/terminal?cols=100&rows=30") as ws:
        ws.send_text("echo DEVPILOT_TEST_OK\n")
        received = ""
        for _ in range(15):
            chunk = ws.receive_text()
            received += chunk
            if "DEVPILOT_TEST_OK" in received:
                break
        assert "DEVPILOT_TEST_OK" in received
        ws.send_text("exit\n")
