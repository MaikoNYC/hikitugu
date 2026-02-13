"""Google Sheets integration service."""

import asyncio

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


class SheetsService:
    """Fetches spreadsheet data from Google Sheets API."""

    async def list_spreadsheets(self, access_token: str) -> list[dict]:
        """List spreadsheets accessible by the user.

        Args:
            access_token: Decrypted Google OAuth access token.

        Returns:
            List of spreadsheet summary dicts.
        """
        credentials = Credentials(token=access_token)
        service = build("drive", "v3", credentials=credentials)

        results = await asyncio.to_thread(
            lambda: service.files()
            .list(
                q="mimeType='application/vnd.google-apps.spreadsheet'",
                fields="files(id, name, modifiedTime, webViewLink)",
                orderBy="modifiedTime desc",
            )
            .execute()
        )

        files = results.get("files", [])
        return [
            {
                "id": f["id"],
                "title": f.get("name", ""),
                "url": f.get("webViewLink", ""),
                "last_modified": f.get("modifiedTime", ""),
            }
            for f in files
        ]

    async def get_spreadsheet(
        self,
        access_token: str,
        spreadsheet_id: str,
        sheet_name: str | None = None,
    ) -> dict:
        """Get spreadsheet data including headers and rows.

        Args:
            access_token: Decrypted Google OAuth access token.
            spreadsheet_id: Google Spreadsheet ID.
            sheet_name: Optional specific sheet name.

        Returns:
            Spreadsheet detail dict.
        """
        credentials = Credentials(token=access_token)
        service = build("sheets", "v4", credentials=credentials)

        metadata = await asyncio.to_thread(
            lambda: service.spreadsheets()
            .get(spreadsheetId=spreadsheet_id)
            .execute()
        )

        title = metadata.get("properties", {}).get("title", "")
        sheet_list = metadata.get("sheets", [])

        sheets_data = []
        for sheet in sheet_list:
            props = sheet.get("properties", {})
            name = props.get("title", "")
            if sheet_name and name != sheet_name:
                continue

            values_result = await asyncio.to_thread(
                lambda n=name: service.spreadsheets()
                .values()
                .get(spreadsheetId=spreadsheet_id, range=n)
                .execute()
            )
            values = values_result.get("values", [])

            headers = values[0] if values else []
            rows = values[1:] if len(values) > 1 else []

            sheets_data.append(
                {
                    "name": name,
                    "headers": headers,
                    "rows": rows,
                }
            )

        return {"id": spreadsheet_id, "title": title, "sheets": sheets_data}
