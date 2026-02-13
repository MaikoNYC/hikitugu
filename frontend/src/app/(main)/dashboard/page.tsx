"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useDocuments } from "@/hooks/use-documents";

export default function DashboardPage() {
  const { documents, loading, error, fetchDocuments } = useDocuments();

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const statusLabel = (status: string) => {
    switch (status) {
      case "draft": return "下書き";
      case "generating": return "生成中";
      case "completed": return "完了";
      case "error": return "エラー";
      default: return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-700";
      case "generating": return "bg-yellow-100 text-yellow-700";
      case "completed": return "bg-green-100 text-green-700";
      case "error": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <Link
          href="/documents/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          新規作成
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">引き継ぎ資料一覧</h2>
        </div>
        <div className="p-6">
          {loading && (
            <p className="text-gray-500 text-center py-8">読み込み中...</p>
          )}
          {error && (
            <p className="text-red-500 text-center py-8">{error}</p>
          )}
          {!loading && !error && documents.length === 0 && (
            <p className="text-gray-500 text-center py-8">
              まだ資料がありません。「新規作成」から引き継ぎ資料を作成してください。
            </p>
          )}
          {!loading && documents.length > 0 && (
            <div className="space-y-3">
              {documents.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{doc.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {doc.target_user_email && `対象: ${doc.target_user_email} | `}
                        作成日: {doc.created_at?.slice(0, 10)}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(doc.status)}`}>
                      {statusLabel(doc.status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
