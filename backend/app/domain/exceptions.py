"""Domain-level exceptions.

Raised by services/infrastructure and translated to HTTP responses at the API
boundary (see app/api/routes) so the domain never depends on FastAPI.
"""


class DevPilotError(Exception):
    """Base class for all DevPilot domain errors."""


class NotAGitRepositoryError(DevPilotError):
    """Raised when the given path is not a valid Git repository."""


class RepositoryNotFoundError(DevPilotError):
    """Raised when a repository id does not exist in storage."""


class IndexedFileNotFoundError(DevPilotError):
    """Raised when a file id does not exist in storage."""


class FileEditError(DevPilotError):
    """Raised when content cannot safely be edited or saved."""


class FileEditConflictError(FileEditError):
    """Raised when the file changed since the editor loaded it."""


class GitReviewError(DevPilotError):
    """Raised when live Git status or a requested diff cannot be read."""
