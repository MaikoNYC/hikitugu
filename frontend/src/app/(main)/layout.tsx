"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold">
            hikitugu
          </Link>
          <div className="flex items-center gap-6">
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
            {user && (
              <div className="flex items-center gap-3 ml-4 pl-4 border-l">
                {user.avatar_url && (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="w-7 h-7 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-700">
                  {user.display_name || user.email}
                </span>
                <button
                  onClick={logout}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
