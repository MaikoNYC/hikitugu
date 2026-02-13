"use client";

import { useState, useEffect, useRef } from "react";
import { useTemplates } from "@/hooks/use-templates";
import { useAuth } from "@/hooks/use-auth";
import type { Template } from "@/types/database";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function TemplatesPage() {
  const { session } = useAuth();
  const { templates, loading, error, fetchTemplates } = useTemplates();
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleUpload = async () => {
    if (!session?.access_token || !uploadFile || !uploadName) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("name", uploadName);
      formData.append("description", uploadDescription);

      await fetch(`${API_URL}/api/templates/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      setShowUpload(false);
      setUploadName("");
      setUploadDescription("");
      setUploadFile(null);
      fetchTemplates();
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!session?.access_token) return;
    try {
      await fetch(`${API_URL}/api/templates/${templateId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      fetchTemplates();
    } catch {
      // ignore
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "processing": return "解析中";
      case "ready": return "利用可能";
      case "error": return "エラー";
      default: return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "processing": return "bg-yellow-100 text-yellow-700";
      case "ready": return "bg-green-100 text-green-700";
      case "error": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

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
          {loading && <p className="text-gray-500 text-center py-8">読み込み中...</p>}
          {error && <p className="text-red-500 text-center py-8">{error}</p>}
          {!loading && !error && templates.length === 0 && (
            <p className="text-gray-500 text-center py-8">
              テンプレートがまだありません。テンプレートをアップロードしてください。
            </p>
          )}
          {!loading && templates.length > 0 && (
            <div className="space-y-3">
              {templates.map((tmpl: Template) => (
                <div key={tmpl.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">{tmpl.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {tmpl.file_type?.toUpperCase()} | {tmpl.description || "説明なし"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(tmpl.status)}`}>
                      {statusLabel(tmpl.status)}
                    </span>
                    <button
                      onClick={() => handleDelete(tmpl.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">テンプレートアップロード</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">テンプレート名</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full border rounded-lg p-2"
                  placeholder="テンプレート名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                <input
                  type="text"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="w-full border rounded-lg p-2"
                  placeholder="テンプレートの説明（任意）"
                />
              </div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-blue-400"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.pdf"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                {uploadFile ? (
                  <p className="text-blue-600">{uploadFile.name}</p>
                ) : (
                  <p className="text-gray-500">.docx または .pdf ファイルを選択</p>
                )}
              </div>
            </div>
            <div className="flex gap-4 justify-end mt-6">
              <button
                onClick={() => {
                  setShowUpload(false);
                  setUploadFile(null);
                  setUploadName("");
                  setUploadDescription("");
                }}
                className="px-4 py-2 border rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !uploadName}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                {uploading ? "アップロード中..." : "アップロード"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
