"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import type { GenerationResult } from "@/types/api";

type Step = 1 | 2 | 3;

interface ProposalResult {
  document_id: string;
  proposal_id: string;
  proposed_structure: Array<{
    title: string;
    description: string;
    estimated_sources: string[];
  }>;
}

export default function NewDocumentPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dataSources, setDataSources] = useState<string[]>([]);
  const [generationMode, setGenerationMode] = useState<"template" | "ai_proposal">("ai_proposal");
  const [templateId, setTemplateId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!session?.access_token) return;
    setSubmitting(true);
    try {
      if (generationMode === "ai_proposal") {
        const res = await apiClient.postWithToken<ProposalResult>(
          "/api/documents/propose",
          session.access_token,
          {
            title,
            target_user_email: targetEmail || null,
            date_range_start: dateFrom,
            date_range_end: dateTo,
            data_sources: dataSources,
          }
        );
        router.push(`/documents/${res.document_id}/proposal?proposal_id=${res.proposal_id}`);
      } else {
        const res = await apiClient.postWithToken<GenerationResult>(
          "/api/documents/generate",
          session.access_token,
          {
            title,
            target_user_email: targetEmail || null,
            template_id: templateId,
            date_range_start: dateFrom,
            date_range_end: dateTo,
            data_sources: dataSources,
          }
        );
        router.push(`/documents/${res.document_id}?job_id=${res.job_id}`);
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDataSource = (source: string) => {
    setDataSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-8">新規引き継ぎ資料作成</h1>

      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s <= step ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              {s}
            </div>
            {s < 3 && <div className={`w-12 h-0.5 mx-1 ${s < step ? "bg-blue-600" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">資料タイトル</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-lg p-2"
              placeholder="例: 田中太郎 引き継ぎ資料"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">対象者メールアドレス</label>
            <input
              type="email"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              className="w-full border rounded-lg p-2"
              placeholder="target@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full border rounded-lg p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full border rounded-lg p-2" />
            </div>
          </div>
          <button onClick={() => setStep(2)} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            次へ
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">データソース選択</h2>
          {["calendar", "slack", "spreadsheet"].map((source) => (
            <label key={source} className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={dataSources.includes(source)}
                onChange={() => toggleDataSource(source)}
                className="w-4 h-4"
              />
              <span className="font-medium capitalize">{source === "calendar" ? "Google Calendar" : source === "slack" ? "Slack" : "Google Sheets"}</span>
            </label>
          ))}
          <div className="flex gap-4">
            <button onClick={() => setStep(1)} className="px-6 py-2 border rounded-lg hover:bg-gray-50">前へ</button>
            <button onClick={() => setStep(3)} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">次へ</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">出力形式選択</h2>
          <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="radio" name="mode" checked={generationMode === "template"} onChange={() => setGenerationMode("template")} className="mt-1" />
            <div>
              <span className="font-medium">テンプレート指定モード</span>
              <p className="text-sm text-gray-500">アップロード済みのテンプレートに沿って生成</p>
            </div>
          </label>
          {generationMode === "template" && (
            <div className="ml-7">
              <label className="block text-sm font-medium text-gray-700 mb-1">テンプレートID</label>
              <input
                type="text"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full border rounded-lg p-2"
                placeholder="テンプレートIDを入力"
              />
            </div>
          )}
          <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="radio" name="mode" checked={generationMode === "ai_proposal"} onChange={() => setGenerationMode("ai_proposal")} className="mt-1" />
            <div>
              <span className="font-medium">AI提案モード</span>
              <p className="text-sm text-gray-500">AIが最適なセクション構成を提案</p>
            </div>
          </label>
          <div className="flex gap-4">
            <button onClick={() => setStep(2)} className="px-6 py-2 border rounded-lg hover:bg-gray-50">前へ</button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "処理中..." : "生成開始"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
