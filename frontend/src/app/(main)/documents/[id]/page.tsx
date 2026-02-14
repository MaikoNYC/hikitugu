"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useJobStatus } from "@/hooks/use-job-status";

interface Section {
  id: string;
  section_order: number;
  title: string;
  content: string | null;
  source_tags: string[];
  is_ai_generated: boolean;
}

interface DocumentData {
  id: string;
  title: string;
  target_user_email: string | null;
  status: string;
  share_enabled: boolean;
  share_token: string | null;
  sections: Section[];
  created_at: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function DocumentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const documentId = params.id as string;
  const jobId = searchParams.get("job_id");
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const isGenerating = doc?.status === "generating" && !!jobId;
  const { job } = useJobStatus(isGenerating ? jobId : null);

  const fetchDocument = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const data = await apiClient.getWithToken<DocumentData>(
        `/api/documents/${documentId}`,
        session.access_token
      );
      setDoc(data);
      if (data.share_enabled && data.share_token) {
        setShareUrl(`${window.location.origin}/shared/${data.share_token}`);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [documentId, session?.access_token]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  // Auto-refetch when generation completes
  useEffect(() => {
    if (job?.status === "completed") {
      fetchDocument();
    }
  }, [job?.status, fetchDocument]);

  const handleDownload = async (format: "pdf" | "docx") => {
    if (!session?.access_token) return;
    const res = await fetch(`${API_URL}/api/documents/${documentId}/download?format=${format}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc?.title || "document"}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!session?.access_token) return;
    try {
      const res = await apiClient.postWithToken<{ share_url: string; share_token: string }>(
        `/api/documents/${documentId}/share`,
        session.access_token
      );
      setShareUrl(res.share_url);
      await fetchDocument();
    } catch {
      // ignore
    }
  };

  const handleRevokeShare = async () => {
    if (!session?.access_token) return;
    try {
      await apiClient.deleteWithToken(`/api/documents/${documentId}/share`, session.access_token);
      setShareUrl(null);
      await fetchDocument();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-gray-500 text-center py-8">読み込み中...</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-red-500 text-center py-8">資料が見つかりません</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
            ← ダッシュボードに戻る
          </Link>
          <h1 className="text-2xl font-bold">{doc.title}</h1>
          {doc.target_user_email && (
            <p className="text-sm text-gray-500 mt-1">対象: {doc.target_user_email}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleDownload("pdf")}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
          >
            PDF ダウンロード
          </button>
          <button
            onClick={() => handleDownload("docx")}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
          >
            Word ダウンロード
          </button>
          {doc.share_enabled ? (
            <button
              onClick={handleRevokeShare}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              共有を無効化
            </button>
          ) : (
            <button
              onClick={handleShare}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              共有リンク発行
            </button>
          )}
        </div>
      </div>

      {shareUrl && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-800 mb-1">共有リンク:</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 text-sm p-2 border rounded bg-white"
            />
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              コピー
            </button>
          </div>
        </div>
      )}

      {isGenerating && job ? (
        <div className="bg-white rounded-lg shadow p-6">
          {job.status === "failed" ? (
            <div className="text-center py-4">
              <p className="text-red-600 font-medium mb-2">生成に失敗しました</p>
              {job.error_message && (
                <p className="text-sm text-red-500">{job.error_message}</p>
              )}
            </div>
          ) : (
            <div className="py-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  {job.current_step || "生成準備中..."}
                </p>
                <span className="text-sm text-gray-500">{job.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {doc.sections.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-500 text-center py-8">
                セクションがまだありません
              </p>
            </div>
          ) : (
            doc.sections.map((section) => (
              <div key={section.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">{section.title}</h2>
                  <div className="flex items-center gap-2">
                    {section.source_tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                    {section.is_ai_generated && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded text-xs">AI</span>
                    )}
                  </div>
                </div>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {section.content || "（内容なし）"}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
