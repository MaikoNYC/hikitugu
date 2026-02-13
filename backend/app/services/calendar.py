"""Google Calendar integration service."""

import asyncio
from datetime import datetime

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


class CalendarService:
    """Fetches events from Google Calendar API."""

    async def get_events(
        self,
        access_token: str,
        date_from: str,
        date_to: str,
        target_email: str | None = None,
    ) -> list[dict]:
        """Fetch calendar events for the given date range.

        Args:
            access_token: Decrypted Google OAuth access token.
            date_from: Start date (YYYY-MM-DD).
            date_to: End date (YYYY-MM-DD).
            target_email: Optional email to filter events by attendee.

        Returns:
            List of calendar event dicts.
        """
        credentials = Credentials(token=access_token)
        service = build("calendar", "v3", credentials=credentials)

        time_min = datetime.strptime(date_from, "%Y-%m-%d").isoformat() + "Z"
        time_max = datetime.strptime(date_to, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59
        ).isoformat() + "Z"

        events_result = await asyncio.to_thread(
            lambda: service.events()
            .list(
                calendarId="primary",
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )

        items = events_result.get("items", [])
        results = []

        for event in items:
            attendees_list = [
                a.get("email", "") for a in event.get("attendees", [])
            ]
            if target_email and target_email not in attendees_list:
                continue

            results.append(
                {
                    "id": event.get("id", ""),
                    "title": event.get("summary", ""),
                    "start": event.get("start", {}).get(
                        "dateTime", event.get("start", {}).get("date", "")
                    ),
                    "end": event.get("end", {}).get(
                        "dateTime", event.get("end", {}).get("date", "")
                    ),
                    "description": event.get("description"),
                    "attendees": attendees_list,
                    "location": event.get("location"),
                    "url": event.get("htmlLink", ""),
                }
            )

        return results
