import { notFound } from "next/navigation";

interface SharedPageProps {
  params: Promise<{ token: string }>;
}

interface Section {
  id: string;
  section_order: number;
  title: string;
  content: string | null;
  source_tags: string[];
  is_ai_generated: boolean;
}

interface SharedDocument {
  id: string;
  title: string;
  target_user_email: string | null;
  status: string;
  sections: Section[];
  created_at: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "";

export default async function SharedDocumentPage({ params }: SharedPageProps) {
  const { token } = await params;

  if (!token) {
    notFound();
  }

  let doc: SharedDocument | null = null;
  try {
    const res = await fetch(`${API_URL}/api/shared/${token}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      notFound();
    }
    doc = await res.json();
  } catch {
    notFound();
  }

  if (!doc) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold">{doc.title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          この資料は共有リンクで閲覧しています
          {doc.target_user_email && ` | 対象: ${doc.target_user_email}`}
        </p>
      </header>

      <div className="space-y-6">
        {doc.sections.length === 0 ? (
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <p className="text-gray-500">セクションがまだありません</p>
          </div>
        ) : (
          doc.sections.map((section) => (
            <div key={section.id} className="border rounded-lg p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <div className="flex gap-1">
                  {section.source_tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {section.content || "（内容なし）"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
