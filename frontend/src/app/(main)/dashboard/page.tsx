"use client";

import Link from "next/link";

export default function DashboardPage() {
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
          <p className="text-gray-500 text-center py-8">
            まだ資料がありません。「新規作成」から引き継ぎ資料を作成してください。
          </p>
        </div>
      </div>
    </div>
  );
}
