"""Google Sheets integration service."""


class SheetsService:
    """Fetches spreadsheet data from Google Sheets API."""

    async def list_spreadsheets(self, access_token: str) -> list[dict]:
        """List spreadsheets accessible by the user.

        Args:
            access_token: Decrypted Google OAuth access token.

        Returns:
            List of spreadsheet summary dicts.
        """
        # TODO: Use google-api-python-client to call Drive API
        return []

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
        # TODO: Use google-api-python-client to call Sheets API
        return {"id": spreadsheet_id, "title": "", "sheets": []}
