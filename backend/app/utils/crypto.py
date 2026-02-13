"""AES-256-GCM encryption helpers for OAuth token storage."""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

_IV_LENGTH = 12  # 96-bit IV for AES-GCM
_KEY_LENGTH = 32  # 256-bit key


def _get_key() -> bytes:
    """Decode the encryption key from settings."""
    raw = settings.encryption_key
    if not raw:
        raise RuntimeError("ENCRYPTION_KEY is not set")
    key = base64.b64decode(raw)
    if len(key) != _KEY_LENGTH:
        raise RuntimeError(f"ENCRYPTION_KEY must be {_KEY_LENGTH} bytes after base64 decode")
    return key


def encrypt_token(plaintext: str) -> str:
    """Encrypt a plaintext token using AES-256-GCM.

    Returns a base64-encoded string containing IV + ciphertext + tag.
    """
    key = _get_key()
    iv = os.urandom(_IV_LENGTH)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
    return base64.b64encode(iv + ciphertext).decode("ascii")


def decrypt_token(encrypted: str) -> str:
    """Decrypt an AES-256-GCM encrypted token.

    Expects the base64-encoded string produced by encrypt_token().
    """
    key = _get_key()
    raw = base64.b64decode(encrypted)
    iv = raw[:_IV_LENGTH]
    ciphertext = raw[_IV_LENGTH:]
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ciphertext, None)
    return plaintext.decode("utf-8")
