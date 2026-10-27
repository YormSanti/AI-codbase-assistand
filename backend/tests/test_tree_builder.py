from dataclasses import replace

from app.domain.models import FileMetadata, Language
from app.domain.tree_builder import build_tree


def _file(path: str) -> FileMetadata:
    return FileMetadata(
        relative_path=path,
        size_bytes=10,
        language=Language.PYTHON,
        content_hash="deadbeef",
        is_binary=False,
    )


def test_build_tree_nests_directories() -> None:
    files = [_file("main.py"), _file("src/app.py"), _file("src/lib/utils.py")]

    tree = build_tree("myrepo", files)

    assert tree.name == "myrepo"
    assert tree.is_directory is True
    names = {child.name for child in tree.children}
    assert names == {"main.py", "src"}

    src_node = next(c for c in tree.children if c.name == "src")
    assert {c.name for c in src_node.children} == {"app.py", "lib"}


def test_build_tree_sorts_directories_before_files_alphabetically() -> None:
    files = [_file("zeta.py"), _file("alpha/inner.py"), _file("beta.py")]

    tree = build_tree("repo", files)

    assert [c.name for c in tree.children] == ["alpha", "beta.py", "zeta.py"]


def test_build_tree_empty_repository() -> None:
    tree = build_tree("empty", [])

    assert tree.children == []


def test_build_tree_attaches_symbol_counts_by_file_id() -> None:
    files = [replace(_file("main.py"), id=1), replace(_file("src/app.py"), id=2)]

    tree = build_tree("repo", files, {1: 4})

    main = next(c for c in tree.children if c.name == "main.py")
    app = next(c for c in tree.children if c.name == "src").children[0]
    assert main.symbol_count == 4
    assert app.symbol_count is None
    assert tree.symbol_count is None
