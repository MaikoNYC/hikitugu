"""Gemini AI integration service."""

import json

import google.generativeai as genai

from app.config import settings


class AIService:
    """Interfaces with Google Gemini API for content generation."""

    def __init__(self):
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
        self._model = genai.GenerativeModel("gemini-pro")

    async def generate_section_content(
        self,
        section_title: str,
        section_description: str,
        source_data: list[dict],
    ) -> str:
        """Generate content for a single document section.

        Args:
            section_title: The section heading.
            section_description: Description of what the section should contain.
            source_data: Relevant data from Calendar/Slack/Sheets.

        Returns:
            Generated Markdown content.
        """
        source_text = json.dumps(source_data, ensure_ascii=False, default=str)
        prompt = f"""あなたは引き継ぎ資料を作成するアシスタントです。
以下のセクションの内容を日本語のMarkdown形式で生成してください。

## セクション情報
- タイトル: {section_title}
- 説明: {section_description}

## 参照データ
{source_text}

## 指示
- 提供されたデータに基づいて、正確かつ簡潔な内容を生成してください
- 箇条書きや表を適切に使用してください
- 不明な情報は推測せず、「情報なし」と記載してください
- Markdown形式で出力してください
"""
        response = await self._model.generate_content_async(prompt)
        return response.text or ""

    async def propose_structure(
        self,
        data_summary: dict,
    ) -> list[dict]:
        """Ask Gemini to propose an optimal section structure.

        Args:
            data_summary: Summary of available data from all sources.

        Returns:
            List of proposed section dicts with title, description, estimated_sources.
        """
        summary_text = json.dumps(data_summary, ensure_ascii=False, default=str)
        prompt = f"""あなたは引き継ぎ資料の構成を提案するアシスタントです。
以下のデータ概要から、最適な引き継ぎ資料のセクション構成を提案してください。

## データ概要
{summary_text}

## 出力形式
以下のJSON配列形式で出力してください。他のテキストは含めないでください。
[
  {{
    "title": "セクションタイトル",
    "description": "このセクションに含める内容の説明",
    "estimated_sources": ["calendar", "slack", "spreadsheet"]
  }}
]

## 指示
- 引き継ぎに必要な一般的なセクション（概要、担当業務、進行中プロジェクト、連絡先など）を含めてください
- 利用可能なデータソースに基づいて適切なセクションを提案してください
- 5〜10セクション程度が適切です
"""
        response = await self._model.generate_content_async(prompt)
        text = response.text or "[]"
        # Extract JSON from response
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            text = text[start:end]
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return [
                {
                    "title": "概要",
                    "description": "引き継ぎの概要と目的",
                    "estimated_sources": [],
                },
                {
                    "title": "担当業務一覧",
                    "description": "現在の担当業務の一覧と状況",
                    "estimated_sources": ["calendar", "spreadsheet"],
                },
                {
                    "title": "進行中プロジェクト",
                    "description": "進行中のプロジェクトの状況と次のステップ",
                    "estimated_sources": ["calendar", "slack"],
                },
                {
                    "title": "重要な連絡先・関係者",
                    "description": "業務に関わる主要な関係者の連絡先",
                    "estimated_sources": ["slack"],
                },
                {
                    "title": "注意事項・引き継ぎメモ",
                    "description": "特に注意が必要な事項やその他メモ",
                    "estimated_sources": [],
                },
            ]
