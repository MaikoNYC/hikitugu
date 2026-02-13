"""Cross-source data aggregation service."""


class DataAggregatorService:
    """Aggregates data from Calendar, Slack, and Sheets into a unified preview."""

    async def aggregate(
        self,
        calendar_events: list[dict],
        slack_messages: list[dict],
        spreadsheet_data: list[dict],
    ) -> dict:
        """Merge and normalize data from all sources.

        Args:
            calendar_events: Events from Google Calendar.
            slack_messages: Messages from Slack.
            spreadsheet_data: Rows from Google Sheets.

        Returns:
            Aggregated data dict with summary counts and source-tagged items.
        """
        return {
            "summary": {
                "calendar_events_count": len(calendar_events),
                "slack_messages_count": len(slack_messages),
                "spreadsheet_rows_count": len(spreadsheet_data),
            },
            "calendar_events": calendar_events,
            "slack_messages": slack_messages,
            "spreadsheet_data": spreadsheet_data,
        }
