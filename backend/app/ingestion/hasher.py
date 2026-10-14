"""Document content hashing for duplicate detection."""

import hashlib
from typing import BinaryIO, Union


def compute_content_hash(data: Union[bytes, BinaryIO]) -> str:
    """Calculate the SHA-256 hash of document binary content.
    
    Used to detect identical uploads across file renames.
    """
    sha256 = hashlib.sha256()
    if isinstance(data, bytes):
        sha256.update(data)
    else:
        # File-like object
        current_pos = data.tell()
        data.seek(0)
        while chunk := data.read(65536):
            sha256.update(chunk)
        data.seek(current_pos)
    return sha256.hexdigest()
