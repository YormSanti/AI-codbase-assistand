import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

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


def test_terminal_websocket_environment_and_resize(api_client: TestClient) -> None:
    with api_client.websocket_connect("/ws/terminal?cols=80&rows=24") as ws:
        # Test resize command
        ws.send_text("\0DEVPILOT_RESIZE:120:40")
        # Test environment
        ws.send_text("echo PROG=$TERM_PROGRAM\n")
        received = ""
        for _ in range(15):
            chunk = ws.receive_text()
            received += chunk
            if "PROG=DevPilot" in received:
                break
        assert "PROG=DevPilot" in received
        ws.send_text("exit\n")


def test_terminal_websocket_rejects_other_origins(api_client: TestClient) -> None:
    with pytest.raises(WebSocketDisconnect) as rejected:
        with api_client.websocket_connect("/ws/terminal", headers={"Origin": "https://evil.example"}):
            pass
    assert rejected.value.code == 1008


def test_terminal_websocket_accepts_the_app_origin(api_client: TestClient) -> None:
    with api_client.websocket_connect("/ws/terminal", headers={"Origin": "http://localhost:5173"}) as ws:
        ws.send_text("echo ORIGIN_OK\n")
        received = ""
        for _ in range(15):
            received += ws.receive_text()
            if "ORIGIN_OK" in received:
                break
        assert "ORIGIN_OK" in received
        ws.send_text("exit\n")
