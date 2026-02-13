import Link from "next/link";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold">
            hikitugu
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
              ダッシュボード
            </Link>
            <Link href="/templates" className="text-sm text-gray-600 hover:text-gray-900">
              テンプレート
            </Link>
            <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
              設定
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
