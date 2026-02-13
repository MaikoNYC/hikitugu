from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.db.client import get_supabase_admin_client
from app.dependencies import get_current_user
from app.models.common import ApiResponse
from app.services.calendar import CalendarService
from app.services.data_aggregator import DataAggregatorService
from app.services.encryption import EncryptionService
from app.services.slack import SlackService
from app.services.spreadsheet import SheetsService

router = APIRouter()

calendar_service = CalendarService()
slack_service = SlackService()
sheets_service = SheetsService()
encryption_service = EncryptionService()
aggregator_service = DataAggregatorService()


async def _get_decrypted_token(user, provider: str) -> str:
    """Retrieve and decrypt an OAuth token for the given provider."""
    admin = get_supabase_admin_client()
    if not admin:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database not configured")

    auth_id = user.id
    user_row = admin.table("users").select("id").eq("supabase_auth_id", auth_id).maybe_single().execute()
    if not user_row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    token_row = (
        admin.table("oauth_tokens")
        .select("encrypted_access_token")
        .eq("user_id", user_row.data["id"])
        .eq("provider", provider)
        .maybe_single()
        .execute()
    )
    if not token_row.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{provider} is not connected. Please connect via settings.",
        )

    return encryption_service.decrypt(token_row.data["encrypted_access_token"])


@router.get("/calendar/events")
async def get_calendar_events(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    target_email: str | None = None,
    user=Depends(get_current_user),
):
    """Fetch Google Calendar events for the given date range."""
    token = await _get_decrypted_token(user, "google")
    events = await calendar_service.get_events(token, date_from, date_to, target_email)
    return {"events": events, "total_count": len(events)}


@router.get("/slack/channels")
async def get_slack_channels(user=Depends(get_current_user)):
    """List Slack channels the user has access to."""
    token = await _get_decrypted_token(user, "slack")
    channels = await slack_service.get_channels(token)
    return {"channels": channels}


@router.get("/slack/messages")
async def get_slack_messages(
    channel_id: str = Query(..., description="Slack channel ID"),
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    user=Depends(get_current_user),
):
    """Fetch Slack messages from a channel for the given date range."""
    token = await _get_decrypted_token(user, "slack")
    messages = await slack_service.get_messages(token, channel_id, date_from, date_to)
    return {"messages": messages, "total_count": len(messages)}


@router.get("/spreadsheets")
async def list_spreadsheets(user=Depends(get_current_user)):
    """List Google Spreadsheets accessible by the user."""
    token = await _get_decrypted_token(user, "google")
    spreadsheets = await sheets_service.list_spreadsheets(token)
    return {"spreadsheets": spreadsheets}


@router.get("/spreadsheets/{spreadsheet_id}")
async def get_spreadsheet(
    spreadsheet_id: str,
    sheet_name: str | None = None,
    user=Depends(get_current_user),
):
    """Get a specific spreadsheet's data."""
    token = await _get_decrypted_token(user, "google")
    data = await sheets_service.get_spreadsheet(token, spreadsheet_id, sheet_name)
    return data


class DataPreviewRequest(BaseModel):
    target_email: str | None = None
    date_from: str
    date_to: str
    data_sources: list[str] = []
    slack_channel_ids: list[str] = []
    spreadsheet_ids: list[str] = []


@router.post("/preview")
async def preview_aggregated_data(
    body: DataPreviewRequest,
    user=Depends(get_current_user),
):
    """Preview aggregated data from all selected sources before generation."""
    calendar_events: list[dict] = []
    slack_messages: list[dict] = []
    spreadsheet_data: list[dict] = []

    if "calendar" in body.data_sources:
        token = await _get_decrypted_token(user, "google")
        calendar_events = await calendar_service.get_events(
            token, body.date_from, body.date_to, body.target_email
        )

    if "slack" in body.data_sources:
        token = await _get_decrypted_token(user, "slack")
        for ch_id in body.slack_channel_ids:
            msgs = await slack_service.get_messages(token, ch_id, body.date_from, body.date_to)
            slack_messages.extend(msgs)

    if "spreadsheet" in body.data_sources:
        token = await _get_decrypted_token(user, "google")
        for ss_id in body.spreadsheet_ids:
            ss = await sheets_service.get_spreadsheet(token, ss_id)
            spreadsheet_data.append(ss)

    return await aggregator_service.aggregate(calendar_events, slack_messages, spreadsheet_data)
