"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

export default function DocumentDetailPage() {
  const params = useParams();
  const documentId = params.id as string;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
            ← ダッシュボードに戻る
          </Link>
          <h1 className="text-2xl font-bold">資料プレビュー</h1>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">PDF ダウンロード</button>
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">Word ダウンロード</button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">共有リンク発行</button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">
            資料ID: {documentId} の内容がここに表示されます
          </p>
        </div>
      </div>
    </div>
  );
}
