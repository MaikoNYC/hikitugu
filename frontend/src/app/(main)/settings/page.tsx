"use client";

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-8">設定</h1>

      <div className="space-y-8">
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">プロフィール</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">表示名</label>
              <input type="text" className="w-full border rounded-lg p-2" placeholder="表示名を入力" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
              <input type="email" className="w-full border rounded-lg p-2 bg-gray-50" disabled placeholder="user@example.com" />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">連携先サービス</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Google</p>
                <p className="text-sm text-gray-500">Calendar, Sheets, Drive</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">接続済み</span>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Slack</p>
                <p className="text-sm text-gray-500">チャンネル・メッセージ連携</p>
              </div>
              <button className="px-4 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                連携する
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
