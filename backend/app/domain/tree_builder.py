"""Builds a nested `TreeNode` structure from a flat list of `FileMetadata`.

Pure function, no I/O — kept in the domain layer so it can be unit tested
without a database or filesystem.
"""
from __future__ import annotations

from app.domain.models import FileMetadata, TreeNode

_DirEntry = dict[str, "_DirEntry | FileMetadata"]


def build_tree(root_name: str, files: list[FileMetadata]) -> TreeNode:
    root: _DirEntry = {}

    for file in sorted(files, key=lambda f: f.relative_path):
        parts = file.relative_path.split("/")
        cursor = root
        for part in parts[:-1]:
            cursor = cursor.setdefault(part, {})  # type: ignore[assignment]
        cursor[parts[-1]] = file

    def to_node(name: str, path: str, entry: _DirEntry) -> TreeNode:
        children: list[TreeNode] = []
        for child_name, child_value in entry.items():
            child_path = f"{path}/{child_name}" if path else child_name
            if isinstance(child_value, FileMetadata):
                children.append(
                    TreeNode(
                        name=child_name,
                        path=child_path,
                        is_directory=False,
                        language=child_value.language,
                        size_bytes=child_value.size_bytes,
                        file_id=child_value.id,
                    )
                )
            else:
                children.append(to_node(child_name, child_path, child_value))

        children.sort(key=lambda n: (not n.is_directory, n.name.lower()))
        return TreeNode(name=name, path=path, is_directory=True, children=children)

    return to_node(root_name, "", root)
