from fastapi import APIRouter, HTTPException, status

from app.models.document import DocumentResponse

router = APIRouter()


@router.get("/{token}", response_model=DocumentResponse)
async def get_shared_document(token: str):
    """Access a shared document via its public token. No authentication required."""
    # TODO: Query documents where share_token = token and share_enabled = true
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="共有リンクが見つからないか、無効化されています",
    )
