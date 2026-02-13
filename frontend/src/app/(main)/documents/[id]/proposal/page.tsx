"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function ProposalPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    // TODO: Call POST /api/documents/{id}/approve-proposal
    router.push(`/documents/${documentId}`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">AI提案確認</h1>

      <div className="space-y-4 mb-8">
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <p className="text-gray-500 text-sm">提案されたセクション構成がここに表示されます</p>
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">
          フィードバック（任意）
        </label>
        <textarea
          id="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="w-full border rounded-lg p-3 min-h-[100px]"
          placeholder="セクション構成に対するフィードバックを入力..."
        />
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "処理中..." : "承認して生成開始"}
        </button>
        <button
          onClick={() => router.back()}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
