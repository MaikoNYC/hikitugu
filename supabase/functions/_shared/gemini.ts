/**
 * Gemini API client for content generation.
 * Mirrors Python backend ai.py prompts and logic.
 */

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

interface ProposedSection {
  title: string;
  description: string;
  estimated_sources: string[];
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data: GeminiResponse = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/**
 * Generate Markdown content for a single document section.
 * Uses the same Japanese prompt template as Python ai.py.
 */
export async function generateSectionContent(
  apiKey: string,
  sectionTitle: string,
  sectionDescription: string,
  sourceData: unknown[],
): Promise<string> {
  const sourceText = JSON.stringify(sourceData);
  const prompt = `あなたは引き継ぎ資料を作成するアシスタントです。
以下のセクションの内容を日本語のMarkdown形式で生成してください。

## セクション情報
- タイトル: ${sectionTitle}
- 説明: ${sectionDescription}

## 参照データ
${sourceText}

## 指示
- 提供されたデータに基づいて、正確かつ簡潔な内容を生成してください
- 箇条書きや表を適切に使用してください
- 不明な情報は推測せず、「情報なし」と記載してください
- Markdown形式で出力してください`;

  return await callGemini(apiKey, prompt);
}

/**
 * Ask Gemini to propose an optimal section structure.
 * Falls back to a default structure if parsing fails.
 */
export async function proposeStructure(
  apiKey: string,
  dataSummary: Record<string, unknown>,
): Promise<ProposedSection[]> {
  const summaryText = JSON.stringify(dataSummary);
  const prompt = `あなたは引き継ぎ資料の構成を提案するアシスタントです。
以下のデータ概要から、最適な引き継ぎ資料のセクション構成を提案してください。

## データ概要
${summaryText}

## 出力形式
以下のJSON配列形式で出力してください。他のテキストは含めないでください。
[
  {
    "title": "セクションタイトル",
    "description": "このセクションに含める内容の説明",
    "estimated_sources": ["calendar", "slack", "spreadsheet"]
  }
]

## 指示
- 引き継ぎに必要な一般的なセクション（概要、担当業務、進行中プロジェクト、連絡先など）を含めてください
- 利用可能なデータソースに基づいて適切なセクションを提案してください
- 5〜10セクション程度が適切です`;

  const text = await callGemini(apiKey, prompt);

  // Extract JSON array from response
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]") + 1;
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end));
    } catch {
      // Fall through to default
    }
  }

  return DEFAULT_PROPOSAL;
}

const DEFAULT_PROPOSAL: ProposedSection[] = [
  {
    title: "概要",
    description: "引き継ぎの概要と目的",
    estimated_sources: [],
  },
  {
    title: "担当業務一覧",
    description: "現在の担当業務の一覧と状況",
    estimated_sources: ["calendar", "spreadsheet"],
  },
  {
    title: "進行中プロジェクト",
    description: "進行中のプロジェクトの状況と次のステップ",
    estimated_sources: ["calendar", "slack"],
  },
  {
    title: "重要な連絡先・関係者",
    description: "業務に関わる主要な関係者の連絡先",
    estimated_sources: ["slack"],
  },
  {
    title: "注意事項・引き継ぎメモ",
    description: "特に注意が必要な事項やその他メモ",
    estimated_sources: [],
  },
];
