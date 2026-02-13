from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.models.common import ApiResponse

router = APIRouter()


@router.get("/calendar/events")
async def get_calendar_events(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    target_email: str | None = None,
    _user=Depends(get_current_user),
):
    """Fetch Google Calendar events for the given date range."""
    # TODO: Use CalendarService to fetch events
    return {"events": [], "total_count": 0}


@router.get("/slack/channels")
async def get_slack_channels(_user=Depends(get_current_user)):
    """List Slack channels the user has access to."""
    # TODO: Use SlackService to fetch channels
    return {"channels": []}


@router.get("/slack/messages")
async def get_slack_messages(
    channel_id: str = Query(..., description="Slack channel ID"),
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    _user=Depends(get_current_user),
):
    """Fetch Slack messages from a channel for the given date range."""
    # TODO: Use SlackService to fetch messages
    return {"messages": [], "total_count": 0}


@router.get("/spreadsheets")
async def list_spreadsheets(_user=Depends(get_current_user)):
    """List Google Spreadsheets accessible by the user."""
    # TODO: Use SheetsService to list spreadsheets
    return {"spreadsheets": []}


@router.get("/spreadsheets/{spreadsheet_id}")
async def get_spreadsheet(
    spreadsheet_id: str,
    sheet_name: str | None = None,
    _user=Depends(get_current_user),
):
    """Get a specific spreadsheet's data."""
    # TODO: Use SheetsService to fetch spreadsheet data
    return {"id": spreadsheet_id, "title": "", "sheets": []}


@router.post("/preview")
async def preview_aggregated_data(_user=Depends(get_current_user)):
    """Preview aggregated data from all selected sources before generation."""
    # TODO: Use DataAggregatorService to collect and merge data
    return {
        "summary": {
            "calendar_events_count": 0,
            "slack_messages_count": 0,
            "spreadsheet_rows_count": 0,
        },
        "calendar_events": [],
        "slack_messages": [],
        "spreadsheet_data": [],
    }
