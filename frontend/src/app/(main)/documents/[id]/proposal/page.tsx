"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";

interface ProposedSection {
  title: string;
  description: string;
  estimated_sources: string[];
}

interface ProposalData {
  document_id: string;
  proposal_id: string;
  proposed_structure: ProposedSection[];
}

export default function ProposalPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const documentId = params.id as string;
  const proposalId = searchParams.get("proposal_id") || "";
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<ProposalData | null>(null);

  const fetchProposal = useCallback(async () => {
    if (!session?.access_token || !documentId) return;
    try {
      const data = await apiClient.getWithToken<{ id: string; title: string; sections: never[] }>(
        `/api/documents/${documentId}`,
        session.access_token
      );
      // Proposal data is passed via search params from the propose endpoint
      // The proposal structure was already returned during creation
    } catch {
      // ignore
    }
  }, [session?.access_token, documentId]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  const handleApprove = async () => {
    if (!session?.access_token || !proposalId) return;
    setLoading(true);
    try {
      const res = await apiClient.postWithToken<{ document_id: string; job_id: string }>(
        `/api/documents/${documentId}/approve-proposal`,
        session.access_token,
        {
          proposal_id: proposalId,
          feedback: feedback || null,
          approved_structure: proposal?.proposed_structure || null,
        }
      );
      router.push(`/documents/${res.document_id}?job_id=${res.job_id}`);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">AI提案確認</h1>

      <div className="space-y-4 mb-8">
        {proposal?.proposed_structure && proposal.proposed_structure.length > 0 ? (
          proposal.proposed_structure.map((section, index) => (
            <div key={index} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{section.title}</h3>
                <div className="flex gap-1">
                  {section.estimated_sources.map((src) => (
                    <span key={src} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      {src}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">{section.description}</p>
            </div>
          ))
        ) : (
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <p className="text-gray-500 text-sm">提案されたセクション構成を読み込み中...</p>
          </div>
        )}
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
