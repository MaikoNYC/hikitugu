"""Slack integration service."""


class SlackService:
    """Fetches channels and messages from Slack API."""

    async def get_channels(self, access_token: str) -> list[dict]:
        """List channels in the connected workspace.

        Args:
            access_token: Decrypted Slack OAuth access token.

        Returns:
            List of channel dicts.
        """
        # TODO: Use slack_sdk to call conversations.list
        return []

    async def get_messages(
        self,
        access_token: str,
        channel_id: str,
        date_from: str,
        date_to: str,
    ) -> list[dict]:
        """Fetch messages from a channel for the given date range.

        Args:
            access_token: Decrypted Slack OAuth access token.
            channel_id: Slack channel ID.
            date_from: Start date (YYYY-MM-DD).
            date_to: End date (YYYY-MM-DD).

        Returns:
            List of message dicts including thread replies.
        """
        # TODO: Use slack_sdk to call conversations.history + conversations.replies
        return []
