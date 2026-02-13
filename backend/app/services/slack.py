"""Slack integration service."""

from datetime import datetime, timezone

from slack_sdk.web.async_client import AsyncWebClient


class SlackService:
    """Fetches channels and messages from Slack API."""

    async def get_channels(self, access_token: str) -> list[dict]:
        """List channels in the connected workspace.

        Args:
            access_token: Decrypted Slack OAuth access token.

        Returns:
            List of channel dicts.
        """
        client = AsyncWebClient(token=access_token)
        response = await client.conversations_list(types="public_channel")
        channels = response.get("channels", [])

        return [
            {
                "id": ch["id"],
                "name": ch["name"],
                "is_private": ch.get("is_private", False),
                "member_count": ch.get("num_members", 0),
            }
            for ch in channels
        ]

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
        client = AsyncWebClient(token=access_token)

        oldest = str(
            datetime.strptime(date_from, "%Y-%m-%d")
            .replace(tzinfo=timezone.utc)
            .timestamp()
        )
        latest = str(
            datetime.strptime(date_to, "%Y-%m-%d")
            .replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            .timestamp()
        )

        history = await client.conversations_history(
            channel=channel_id, oldest=oldest, latest=latest
        )
        messages = history.get("messages", [])

        user_cache: dict[str, str] = {}

        async def resolve_user(user_id: str) -> str:
            if user_id in user_cache:
                return user_cache[user_id]
            try:
                info = await client.users_info(user=user_id)
                name = info["user"].get("real_name") or info["user"].get("name", user_id)
            except Exception:
                name = user_id
            user_cache[user_id] = name
            return name

        results = []
        for msg in messages:
            user_id = msg.get("user", "")
            user_name = await resolve_user(user_id)

            thread_replies = []
            if msg.get("thread_ts") and msg.get("reply_count", 0) > 0:
                replies_resp = await client.conversations_replies(
                    channel=channel_id, ts=msg["thread_ts"]
                )
                for reply in replies_resp.get("messages", [])[1:]:
                    reply_user = await resolve_user(reply.get("user", ""))
                    thread_replies.append(
                        {
                            "id": reply.get("ts", ""),
                            "user_name": reply_user,
                            "text": reply.get("text", ""),
                            "timestamp": reply.get("ts", ""),
                        }
                    )

            ts = msg.get("ts", "")
            results.append(
                {
                    "id": ts,
                    "user": user_id,
                    "user_name": user_name,
                    "text": msg.get("text", ""),
                    "timestamp": ts,
                    "thread_replies": thread_replies,
                    "url": f"https://slack.com/archives/{channel_id}/p{ts.replace('.', '')}",
                }
            )

        return results
