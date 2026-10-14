import pytest
from app.cli import main


def test_cli_help(capsys: pytest.CaptureFixture[str]) -> None:
    code = main([])
    assert code == 0
    captured = capsys.readouterr()
    # New output uses "DevPilot AI" in description and lists subcommands
    assert "DevPilot AI" in captured.out or "devpilot" in captured.out
    assert "index" in captured.out

    with pytest.raises(SystemExit):
        main(["--help"])


def test_cli_version(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exc_info:
        main(["--version"])
    assert exc_info.value.code == 0


def test_cli_info(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(["info"])
    assert code == 0
    captured = capsys.readouterr()
    # New format: "◈ DevPilot AI v… — Developer Intelligence Platform"
    assert "DevPilot AI" in captured.out
    assert "Database" in captured.out


def test_cli_info_json(capsys: pytest.CaptureFixture[str]) -> None:
    import json
    code = main(["info", "--json"])
    assert code == 0
    captured = capsys.readouterr()
    data = json.loads(captured.out)
    assert "version" in data
    assert "database_url" in data
    assert "python" in data


def test_cli_list(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(["list"])
    assert code == 0
    captured = capsys.readouterr()
    assert "indexed repository" in captured.out or "No indexed repositories" in captured.out


def test_cli_list_json(capsys: pytest.CaptureFixture[str]) -> None:
    import json
    code = main(["list", "--json"])
    assert code == 0
    captured = capsys.readouterr()
    result = json.loads(captured.out)
    assert isinstance(result, list)


def test_cli_index_nonexistent_path(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(["index", "/nonexistent_test_path_12345"])
    assert code == 1
    captured = capsys.readouterr()
    # New message: "✗ Directory does not exist: …"
    assert "Directory does not exist" in captured.err


def test_cli_status(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(["status", "1"])
    assert code == 0
    captured = capsys.readouterr()
    # New format shows repo name, branch, upstream
    assert "Branch" in captured.out
    assert "Upstream" in captured.out


def test_cli_status_json(capsys: pytest.CaptureFixture[str]) -> None:
    import json
    code = main(["status", "1", "--json"])
    assert code == 0
    captured = capsys.readouterr()
    data = json.loads(captured.out)
    assert "branch" in data
    assert "changes" in data


def test_cli_symbols(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(["symbols", "1", "-f", "terminal.py"])
    assert code == 0
    captured = capsys.readouterr()
    assert "terminal.py" in captured.out


def test_cli_symbols_kind_filter(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(["symbols", "1", "--kind", "function"])
    assert code == 0


def test_cli_run_no_command(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(["run", "."])
    assert code == 1
    captured = capsys.readouterr()
    assert "No command provided" in captured.err


def test_cli_run_command(capsys: pytest.CaptureFixture[str]) -> None:
    import os
    code = main(["run", os.getcwd(), "--", "echo", "DEVPILOT_TEST"])
    assert code == 0
