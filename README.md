# hikitugu

> AI で引き継ぎ資料を自動生成する SaaS

Google カレンダー・Slack・Google スプレッドシートの情報を横断的に統合し、AI（Gemini）が引き継ぎ資料を自動生成します。

## 解決する課題

- 引き継ぎ資料の作成に時間がかかる
- 情報が複数ツールに分散しており、手動で集約する必要がある
- 引き継ぎの質が属人化している

## 主な機能

- **Google OAuth ログイン** — カレンダー・スプレッドシートのアクセス権限を同時取得
- **Slack 連携** — チャンネル・メッセージの自動取得
- **テンプレートモード** — 既存のひな形に沿って資料を生成
- **AI 提案モード** — Gemini がデータに基づきセクション構成を提案
- **リアルタイム進捗** — Supabase Realtime で生成状況をライブ表示
- **共有リンク** — 認証不要の閲覧用リンクを発行
- **PDF / Word エクスポート** — 生成した資料をダウンロード

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| バックエンド | FastAPI (Python), Vercel Serverless Functions |
| データベース | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| 非同期処理 | Supabase Edge Functions (Deno) |
| AI | Google Gemini API |
| CI/CD | GitHub Actions, Vercel |

## ディレクトリ構成

```
hikitugu/
├── frontend/          # Next.js フロントエンド
│   └── src/
│       ├── app/       # ページ (login, dashboard, documents, templates, settings)
│       ├── components/ # UI コンポーネント
│       ├── hooks/     # カスタムフック
│       ├── lib/       # Supabase クライアント, API クライアント
│       └── types/     # TypeScript 型定義
├── backend/           # FastAPI バックエンド
│   ├── api/           # Vercel Serverless エントリーポイント
│   └── app/
│       ├── routers/   # API ルーター (auth, data_sources, documents, templates)
│       ├── services/  # ビジネスロジック
│       ├── models/    # Pydantic モデル
│       ├── db/        # Supabase クライアント, リポジトリ
│       └── utils/     # AES-256-GCM 暗号化ヘルパー
├── supabase/          # マイグレーション + Edge Functions
│   ├── migrations/    # DDL (テーブル, RLS, インデックス)
│   └── functions/     # generate-document, parse-template
└── docs/              # 要件定義書, 詳細設計書
```

## セットアップ

### 前提条件

- Node.js 20+
- Python 3.12+
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### 1. 環境変数の設定

```bash
cp .env.example .env
# .env を編集して各 API キーを設定
```

### 2. フロントエンド

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

### 3. バックエンド

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs
```

### 4. Supabase

```bash
supabase start     # ローカル Supabase を起動
supabase db push   # マイグレーション適用
```

## API 概要

全 27 エンドポイント。詳細は [docs/detailed-design.md](docs/detailed-design.md) を参照。

| カテゴリ | エンドポイント数 | 内容 |
|----------|-----------------|------|
| 認証系 | 7 | Google/Slack OAuth, ユーザー情報, ログアウト |
| データ連携系 | 6 | カレンダー, Slack, スプレッドシート, プレビュー |
| 資料生成系 | 4 | テンプレート生成, AI 提案, 承認, ジョブ状況 |
| 資料管理系 | 9 | CRUD, セクション編集, 共有, ダウンロード |
| テンプレート管理系 | 5 | 一覧, アップロード, 詳細, 削除, プレビュー |

## ドキュメント

- [要件定義書](docs/requirements.md)
- [詳細設計書](docs/detailed-design.md)

## ライセンス

Private
