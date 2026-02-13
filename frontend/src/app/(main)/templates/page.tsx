"use client";

import { useState } from "react";

export default function TemplatesPage() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">テンプレート管理</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          テンプレートをアップロード
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <p className="text-gray-500 text-center py-8">
            テンプレートがまだありません。テンプレートをアップロードしてください。
          </p>
        </div>
      </div>

      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">テンプレートアップロード</h2>
            <div className="border-2 border-dashed rounded-lg p-8 text-center mb-4">
              <p className="text-gray-500">.docx または .pdf ファイルをドラッグ＆ドロップ</p>
            </div>
            <div className="flex gap-4 justify-end">
              <button onClick={() => setShowUpload(false)} className="px-4 py-2 border rounded-lg">
                キャンセル
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                アップロード
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
