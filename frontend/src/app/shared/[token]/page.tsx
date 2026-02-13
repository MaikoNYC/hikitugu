import { notFound } from "next/navigation";

interface SharedPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedDocumentPage({ params }: SharedPageProps) {
  const { token } = await params;

  if (!token) {
    notFound();
  }

  // TODO: Fetch document via GET /api/shared/{token}

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold">hikitugu 共有資料</h1>
        <p className="text-sm text-gray-500 mt-1">この資料は共有リンクで閲覧しています</p>
      </header>

      <div className="space-y-6">
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <p className="text-gray-500">資料の内容がここに表示されます</p>
        </div>
      </div>
    </div>
  );
}
