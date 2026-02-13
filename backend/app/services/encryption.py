"""OAuth token encryption service using AES-256-GCM."""

from app.utils.crypto import decrypt_token, encrypt_token


class EncryptionService:
    """Encrypts and decrypts OAuth tokens at rest using AES-256-GCM."""

    def encrypt(self, plaintext: str) -> str:
        """Encrypt a token for database storage."""
        return encrypt_token(plaintext)

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt a token retrieved from the database."""
        return decrypt_token(ciphertext)
