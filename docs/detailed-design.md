# hikitugu 詳細設計書

**バージョン**: 1.0
**作成日**: 2026-02-13
**ステータス**: ドラフト
**関連ドキュメント**: [要件定義書](./requirements.md)

---

## 1. DB設計 (Supabase PostgreSQL)

全テーブル共通方針:
- 主キーは `uuid` 型（`gen_random_uuid()` でデフォルト生成）
- 監査フィールドとして `created_at`、`updated_at` を全テーブルに付与
- 外部キーには適切な `ON DELETE` 制約を設定
- Row Level Security (RLS) を全テーブルで有効化

---

### 1.1 tenants テーブル

テナント（組織）を管理するマスターテーブル。

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | テナント一意識別子 |
| name | text | NOT NULL | テナント表示名 |
| slug | text | UNIQUE NOT NULL | URL用スラッグ（例: `acme-corp`） |
| plan | text | DEFAULT 'free' | 契約プラン（`free`, `pro`, `enterprise`） |
| settings | jsonb | DEFAULT '{}' | テナント固有設定（通知設定、デフォルト値など） |
| created_at | timestamptz | DEFAULT now() | 作成日時 |
| updated_at | timestamptz | DEFAULT now() | 更新日時 |

**インデックス**:
- `idx_tenants_slug` ON slug

---

### 1.2 users テーブル

テナントに所属するユーザーを管理する。Supabase Auth の `auth.users` と `supabase_auth_id` で紐付ける。

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | ユーザー一意識別子 |
| tenant_id | uuid | FK → tenants(id) ON DELETE CASCADE, NOT NULL | 所属テナント |
| supabase_auth_id | uuid | UNIQUE NOT NULL | Supabase Auth の user ID |
| email | text | NOT NULL | メールアドレス |
| display_name | text | | 表示名 |
| role | text | DEFAULT 'member', CHECK (role IN ('owner', 'admin', 'member')) | テナント内ロール |
| avatar_url | text | | アバター画像URL |
| created_at | timestamptz | DEFAULT now() | 作成日時 |
| updated_at | timestamptz | DEFAULT now() | 更新日時 |

**インデックス**:
- `idx_users_tenant_id` ON tenant_id
- `idx_users_supabase_auth_id` ON supabase_auth_id

---

### 1.3 oauth_tokens テーブル

外部サービス（Google, Slack）の OAuth トークンを暗号化して保管する。

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | トークン一意識別子 |
| user_id | uuid | FK → users(id) ON DELETE CASCADE, NOT NULL | 所有ユーザー |
| provider | text | NOT NULL, CHECK (provider IN ('google', 'slack')) | OAuthプロバイダー |
| encrypted_access_token | text | NOT NULL | AES-256-GCM で暗号化されたアクセストークン |
| encrypted_refresh_token | text | | AES-256-GCM で暗号化されたリフレッシュトークン |
| token_expires_at | timestamptz | | アクセストークン有効期限 |
| scopes | text[] | | 認可済みスコープ一覧 |
| metadata | jsonb | DEFAULT '{}' | プロバイダー固有メタデータ（workspace_id 等） |
| created_at | timestamptz | DEFAULT now() | 作成日時 |
| updated_at | timestamptz | DEFAULT now() | 更新日時 |

**制約**:
- `uq_oauth_tokens_user_provider` UNIQUE (user_id, provider)

**インデックス**:
- `idx_oauth_tokens_user_id` ON user_id

---

### 1.4 templates テーブル

ユーザーがアップロードしたひな形（テンプレート）ファイルを管理する。

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | テンプレート一意識別子 |
| tenant_id | uuid | FK → tenants(id) ON DELETE CASCADE, NOT NULL | 所属テナント |
| uploaded_by | uuid | FK → users(id) ON DELETE SET NULL | アップロードしたユーザー |
| name | text | NOT NULL | テンプレート名 |
| description | text | | テンプレートの説明 |
| file_path | text | NOT NULL | Supabase Storage 上のファイルパス |
| file_type | text | CHECK (file_type IN ('docx', 'pdf')) | ファイル形式 |
| file_size_bytes | bigint | | ファイルサイズ（バイト） |
| parsed_structure | jsonb | | 解析されたセクション構造（見出し・順序・書式情報） |
| status | text | DEFAULT 'processing', CHECK (status IN ('processing', 'ready', 'error')) | 解析ステータス |
| created_at | timestamptz | DEFAULT now() | 作成日時 |
| updated_at | timestamptz | DEFAULT now() | 更新日時 |

**インデックス**:
- `idx_templates_tenant_id` ON tenant_id

**parsed_structure の構造例**:
```json
{
  "sections": [
    {
      "order": 1,
      "title": "概要",
      "level": 1,
      "style": { "font": "MS Gothic", "size": 14 }
    },
    {
      "order": 2,
      "title": "会議履歴",
      "level": 1,
      "style": { "font": "MS Gothic", "size": 14 }
    }
  ]
}
```

---

### 1.5 documents テーブル

生成された引き継ぎ資料の親レコードを管理する。

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 資料一意識別子 |
| tenant_id | uuid | FK → tenants(id) ON DELETE CASCADE, NOT NULL | 所属テナント |
| created_by | uuid | FK → users(id) ON DELETE SET NULL | 作成ユーザー |
| title | text | NOT NULL | 資料タイトル |
| target_user_email | text | | 引き継ぎ対象者のメールアドレス |
| generation_mode | text | NOT NULL, CHECK (generation_mode IN ('template', 'ai_proposal')) | 生成モード |
| template_id | uuid | FK → templates(id) ON DELETE SET NULL | 使用テンプレート（テンプレートモード時） |
| date_range_start | date | | データ取得期間の開始日 |
| date_range_end | date | | データ取得期間の終了日 |
| data_sources | text[] | | 使用データソース（`['calendar', 'slack', 'spreadsheet']`） |
| status | text | DEFAULT 'draft', CHECK (status IN ('draft', 'generating', 'completed', 'error')) | 資料ステータス |
| share_token | text | UNIQUE | 共有リンク用トークン |
| share_enabled | boolean | DEFAULT false | 共有リンクの有効/無効 |
| metadata | jsonb | DEFAULT '{}' | 追加メタデータ（生成パラメータ等） |
| created_at | timestamptz | DEFAULT now() | 作成日時 |
| updated_at | timestamptz | DEFAULT now() | 更新日時 |

**インデックス**:
- `idx_documents_tenant_id` ON tenant_id
- `idx_documents_created_by` ON created_by
- `idx_documents_share_token` ON share_token WHERE share_token IS NOT NULL
- `idx_documents_status` ON status

---

### 1.6 document_sections テーブル

資料の各セクション（章・節）を管理する。

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | セクション一意識別子 |
| document_id | uuid | FK → documents(id) ON DELETE CASCADE, NOT NULL | 親資料 |
| section_order | integer | NOT NULL | セクション表示順 |
| title | text | NOT NULL | セクションタイトル |
| content | text | | セクション本文（Markdown 形式） |
| source_tags | text[] | | 参照元ソースタグ（`['calendar', 'slack', 'spreadsheet']`） |
| source_references | jsonb | | 具体的な参照元情報 |
| is_ai_generated | boolean | DEFAULT true | AI生成フラグ（手動編集時に false に変更） |
| created_at | timestamptz | DEFAULT now() | 作成日時 |
| updated_at | timestamptz | DEFAULT now() | 更新日時 |

**インデックス**:
- `idx_document_sections_document_id` ON document_id
- `idx_document_sections_order` ON (document_id, section_order)

**source_references の構造例**:
```json
[
  {
    "source": "calendar",
    "id": "event_abc123",
    "title": "週次定例会議",
    "url": "https://calendar.google.com/event/abc123"
  },
  {
    "source": "slack",
    "id": "msg_xyz789",
    "title": "#project-alpha での議論",
    "url": "https://slack.com/archives/C01234/p1234567890"
  }
]
```

---

### 1.7 generation_jobs テーブル

資料生成の非同期ジョブを管理する。

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | ジョブ一意識別子 |
| document_id | uuid | FK → documents(id) ON DELETE CASCADE, NOT NULL | 対象資料 |
| tenant_id | uuid | FK → tenants(id) ON DELETE CASCADE, NOT NULL | テナント（クエリ最適化用） |
| status | text | DEFAULT 'pending', CHECK (status IN ('pending', 'processing', 'completed', 'failed')) | ジョブステータス |
| progress | integer | DEFAULT 0, CHECK (progress >= 0 AND progress <= 100) | 進捗率（0-100%） |
| current_step | text | | 現在の処理ステップ（例: `fetching_calendar`, `generating_summary`） |
| error_message | text | | エラー発生時のメッセージ |
| started_at | timestamptz | | 処理開始日時 |
| completed_at | timestamptz | | 処理完了日時 |
| created_at | timestamptz | DEFAULT now() | 作成日時 |

**インデックス**:
- `idx_generation_jobs_document_id` ON document_id
- `idx_generation_jobs_tenant_id_status` ON (tenant_id, status)

---

### 1.8 ai_proposals テーブル

AI提案モード時の構成提案を管理する。

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 提案一意識別子 |
| document_id | uuid | FK → documents(id) ON DELETE CASCADE, NOT NULL | 対象資料 |
| proposed_structure | jsonb | NOT NULL | 提案されたセクション構成 |
| user_feedback | text | | ユーザーからのフィードバック |
| status | text | DEFAULT 'pending', CHECK (status IN ('pending', 'approved', 'rejected', 'revised')) | 提案ステータス |
| approved_at | timestamptz | | 承認日時 |
| created_at | timestamptz | DEFAULT now() | 作成日時 |
| updated_at | timestamptz | DEFAULT now() | 更新日時 |

**インデックス**:
- `idx_ai_proposals_document_id` ON document_id

**proposed_structure の構造例**:
```json
[
  {
    "title": "概要",
    "description": "対象者名・対象期間・担当業務の全体像",
    "estimated_sources": ["calendar", "slack", "spreadsheet"]
  },
  {
    "title": "会議・予定の履歴",
    "description": "定例会議の一覧と要約、重要な決定事項",
    "estimated_sources": ["calendar", "slack"]
  },
  {
    "title": "タスク・進捗状況",
    "description": "スプレッドシートから取得したタスク一覧と状況",
    "estimated_sources": ["spreadsheet", "slack"]
  }
]
```

---

### 1.9 RLS（Row Level Security）方針

全テーブルで RLS を有効化し、テナント単位のデータ分離を実現する。

#### 共通ヘルパー関数

```sql
-- 現在のユーザーの tenant_id を取得
CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS uuid AS $$
  SELECT tenant_id FROM public.users
  WHERE supabase_auth_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

#### テーブル別ポリシー

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|----------|--------|--------|--------|--------|
| tenants | id = auth.tenant_id() | - (管理者APIのみ) | id = auth.tenant_id() AND role = 'owner' | - (管理者APIのみ) |
| users | tenant_id = auth.tenant_id() | tenant_id = auth.tenant_id() | supabase_auth_id = auth.uid() | supabase_auth_id = auth.uid() |
| oauth_tokens | user_id IN (SELECT id FROM users WHERE supabase_auth_id = auth.uid()) | user_id が自身 | user_id が自身 | user_id が自身 |
| templates | tenant_id = auth.tenant_id() | tenant_id = auth.tenant_id() | uploaded_by が自身 | uploaded_by が自身 |
| documents | tenant_id = auth.tenant_id() | tenant_id = auth.tenant_id() | created_by が自身 | created_by が自身 |
| document_sections | document_id の tenant_id = auth.tenant_id() | document の created_by が自身 | document の created_by が自身 | document の created_by が自身 |
| generation_jobs | tenant_id = auth.tenant_id() | tenant_id = auth.tenant_id() | - (システムのみ) | - |
| ai_proposals | document の tenant_id = auth.tenant_id() | document の created_by が自身 | document の created_by が自身 | - |

**共有リンクの例外**: `documents` と `document_sections` の SELECT ポリシーには、`share_enabled = true AND share_token` による匿名アクセスも許可する。

---

## 2. API設計 (FastAPI — 全27エンドポイント)

### 共通仕様

- **ベースURL**: `/api`
- **認証**: Supabase JWT を `Authorization: Bearer <token>` ヘッダーで送信
- **レスポンス形式**: JSON（共有リンク閲覧・ダウンロードを除く）
- **エラーレスポンス**: `{ "detail": "エラーメッセージ" }` + 適切な HTTP ステータスコード
- **ページネーション**: `?page=1&per_page=20` 形式（一覧系エンドポイント）

---

### 2.1 認証系 (7エンドポイント)

#### 1. GET /api/auth/google

**説明**: Google OAuth 2.0 フローを開始する。Google Calendar, Sheets, Drive の読み取りスコープを要求。

| 項目 | 値 |
|------|-----|
| 認証 | 不要 |
| クエリパラメータ | `redirect_uri` (optional) |
| レスポンス | 302 Redirect → Google OAuth 同意画面 |

---

#### 2. GET /api/auth/google/callback

**説明**: Google OAuth コールバック。認可コードをトークンに交換し、ユーザー作成/ログイン処理を行う。

| 項目 | 値 |
|------|-----|
| 認証 | 不要 |
| クエリパラメータ | `code`, `state` |
| レスポンス | 302 Redirect → フロントエンド（JWT をクエリパラメータまたは Cookie で受け渡し） |

**処理フロー**:
1. 認可コードでアクセストークン・リフレッシュトークンを取得
2. Google UserInfo API でユーザー情報を取得
3. Supabase Auth でユーザーを作成/取得
4. `users` テーブルにレコードを作成/更新
5. `oauth_tokens` テーブルにトークンを AES-256-GCM 暗号化して保存
6. Supabase セッションを発行しフロントエンドにリダイレクト

---

#### 3. GET /api/auth/slack

**説明**: Slack OAuth 2.0 フローを開始する。channels:read, chat:read のスコープを要求。

| 項目 | 値 |
|------|-----|
| 認証 | 必要（既にGoogleログイン済み） |
| クエリパラメータ | `redirect_uri` (optional) |
| レスポンス | 302 Redirect → Slack OAuth 同意画面 |

---

#### 4. GET /api/auth/slack/callback

**説明**: Slack OAuth コールバック。認可コードをトークンに交換し、Slack 連携を登録する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要（state パラメータからユーザーを特定） |
| クエリパラメータ | `code`, `state` |
| レスポンス | 302 Redirect → フロントエンド設定画面 |

---

#### 5. GET /api/auth/me

**説明**: 現在ログイン中のユーザー情報を取得する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| レスポンス | 200 OK |

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "田中太郎",
  "role": "member",
  "avatar_url": "https://...",
  "tenant": {
    "id": "uuid",
    "name": "株式会社ACME",
    "slug": "acme-corp",
    "plan": "free"
  }
}
```

---

#### 6. POST /api/auth/logout

**説明**: ログアウト処理。Supabase セッションを無効化する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| レスポンス | 200 OK `{ "message": "ログアウトしました" }` |

---

#### 7. GET /api/auth/status

**説明**: 各外部サービスとの接続状態を取得する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| レスポンス | 200 OK |

```json
{
  "google": {
    "connected": true,
    "email": "user@gmail.com",
    "scopes": ["calendar.readonly", "spreadsheets.readonly"],
    "expires_at": "2026-02-13T12:00:00Z"
  },
  "slack": {
    "connected": true,
    "workspace_name": "ACME Corp",
    "scopes": ["channels:read", "chat:read"]
  }
}
```

---

### 2.2 データ連携系 (6エンドポイント)

#### 8. GET /api/data/calendar/events

**説明**: Google Calendar から指定期間の予定一覧を取得する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| クエリパラメータ | `date_from` (required, date), `date_to` (required, date), `target_email` (optional) |
| レスポンス | 200 OK |

```json
{
  "events": [
    {
      "id": "event_id",
      "title": "週次定例会議",
      "start": "2026-02-10T10:00:00+09:00",
      "end": "2026-02-10T11:00:00+09:00",
      "description": "議題: ...",
      "attendees": ["user1@example.com", "user2@example.com"],
      "location": "会議室A",
      "url": "https://calendar.google.com/event/..."
    }
  ],
  "total_count": 42
}
```

---

#### 9. GET /api/data/slack/channels

**説明**: 連携済み Slack ワークスペースのチャンネル一覧を取得する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| レスポンス | 200 OK |

```json
{
  "channels": [
    {
      "id": "C01234567",
      "name": "project-alpha",
      "is_private": false,
      "member_count": 12
    }
  ]
}
```

---

#### 10. GET /api/data/slack/messages

**説明**: 指定チャンネル・期間の Slack メッセージを取得する（スレッド含む）。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| クエリパラメータ | `channel_id` (required), `date_from` (required, date), `date_to` (required, date) |
| レスポンス | 200 OK |

```json
{
  "messages": [
    {
      "id": "msg_id",
      "user": "U01234567",
      "user_name": "田中太郎",
      "text": "メッセージ本文",
      "timestamp": "2026-02-10T09:30:00+09:00",
      "thread_replies": [
        {
          "id": "reply_id",
          "user_name": "佐藤花子",
          "text": "返信本文",
          "timestamp": "2026-02-10T09:35:00+09:00"
        }
      ],
      "url": "https://slack.com/archives/..."
    }
  ],
  "total_count": 156
}
```

---

#### 11. GET /api/data/spreadsheets

**説明**: Google Drive 上のスプレッドシート一覧を取得する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| レスポンス | 200 OK |

```json
{
  "spreadsheets": [
    {
      "id": "spreadsheet_id",
      "title": "プロジェクトAlpha タスク管理表",
      "url": "https://docs.google.com/spreadsheets/d/...",
      "last_modified": "2026-02-12T18:00:00+09:00"
    }
  ]
}
```

---

#### 12. GET /api/data/spreadsheets/{id}

**説明**: 指定スプレッドシートの詳細データ（シート一覧・セル値）を取得する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| パスパラメータ | `id` (spreadsheet ID) |
| クエリパラメータ | `sheet_name` (optional) |
| レスポンス | 200 OK |

```json
{
  "id": "spreadsheet_id",
  "title": "プロジェクトAlpha タスク管理表",
  "sheets": [
    {
      "name": "タスク一覧",
      "headers": ["タスク名", "担当者", "ステータス", "期限"],
      "rows": [
        ["API設計", "田中", "完了", "2026-02-01"],
        ["フロント実装", "佐藤", "進行中", "2026-02-15"]
      ]
    }
  ]
}
```

---

#### 13. POST /api/data/preview

**説明**: 全データソースを横断的に取得し、統合プレビューを返す。資料生成前のデータ確認に使用。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| リクエストボディ | JSON |
| レスポンス | 200 OK |

**リクエスト**:
```json
{
  "target_email": "target@example.com",
  "date_from": "2026-01-01",
  "date_to": "2026-02-13",
  "data_sources": ["calendar", "slack", "spreadsheet"],
  "slack_channel_ids": ["C01234567", "C01234568"],
  "spreadsheet_ids": ["spreadsheet_id_1"]
}
```

**レスポンス**:
```json
{
  "summary": {
    "calendar_events_count": 42,
    "slack_messages_count": 156,
    "spreadsheet_rows_count": 28
  },
  "calendar_events": [...],
  "slack_messages": [...],
  "spreadsheet_data": [...]
}
```

---

### 2.3 資料生成系 (4エンドポイント)

#### 14. POST /api/documents/generate

**説明**: テンプレートモードで資料生成を開始する。非同期ジョブとして実行。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| リクエストボディ | JSON |
| レスポンス | 202 Accepted |

**リクエスト**:
```json
{
  "title": "田中太郎 引き継ぎ資料",
  "target_user_email": "tanaka@example.com",
  "template_id": "uuid",
  "date_range_start": "2026-01-01",
  "date_range_end": "2026-02-13",
  "data_sources": ["calendar", "slack", "spreadsheet"],
  "slack_channel_ids": ["C01234567"],
  "spreadsheet_ids": ["spreadsheet_id_1"]
}
```

**レスポンス**:
```json
{
  "document_id": "uuid",
  "job_id": "uuid",
  "status": "pending",
  "message": "資料生成を開始しました"
}
```

---

#### 15. POST /api/documents/propose

**説明**: AI提案モードでセクション構成の提案を生成する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| リクエストボディ | JSON |
| レスポンス | 200 OK |

**リクエスト**:
```json
{
  "title": "田中太郎 引き継ぎ資料",
  "target_user_email": "tanaka@example.com",
  "date_range_start": "2026-01-01",
  "date_range_end": "2026-02-13",
  "data_sources": ["calendar", "slack", "spreadsheet"],
  "slack_channel_ids": ["C01234567"],
  "spreadsheet_ids": ["spreadsheet_id_1"]
}
```

**レスポンス**:
```json
{
  "document_id": "uuid",
  "proposal_id": "uuid",
  "proposed_structure": [
    {
      "title": "概要",
      "description": "対象者名・対象期間・担当業務の全体像",
      "estimated_sources": ["calendar", "slack", "spreadsheet"]
    },
    {
      "title": "会議・予定の履歴",
      "description": "定例会議の一覧と要約、重要な決定事項",
      "estimated_sources": ["calendar", "slack"]
    },
    {
      "title": "コミュニケーション要約",
      "description": "主要な Slack チャンネルの動向と重要な議論",
      "estimated_sources": ["slack", "calendar"]
    },
    {
      "title": "タスク・進捗状況",
      "description": "タスク一覧と完了・進行中・未着手の状況",
      "estimated_sources": ["spreadsheet", "slack"]
    },
    {
      "title": "引き継ぎ事項",
      "description": "注意事項・未完了タスクの対応方針・関係者リスト",
      "estimated_sources": ["calendar", "slack", "spreadsheet"]
    }
  ]
}
```

---

#### 16. POST /api/documents/{id}/approve-proposal

**説明**: AI提案を承認し、本生成を開始する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| パスパラメータ | `id` (document ID) |
| リクエストボディ | JSON (optional) |
| レスポンス | 202 Accepted |

**リクエスト**（構成の微調整が可能）:
```json
{
  "proposal_id": "uuid",
  "feedback": "タスク状況セクションにもっと詳細を入れてほしい",
  "approved_structure": [...]
}
```

**レスポンス**:
```json
{
  "document_id": "uuid",
  "job_id": "uuid",
  "status": "pending",
  "message": "提案を承認しました。資料生成を開始します"
}
```

---

#### 17. GET /api/jobs/{id}

**説明**: 非同期生成ジョブのステータスと進捗を確認する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| パスパラメータ | `id` (job ID) |
| レスポンス | 200 OK |

```json
{
  "id": "uuid",
  "document_id": "uuid",
  "status": "processing",
  "progress": 65,
  "current_step": "generating_summary",
  "started_at": "2026-02-13T10:00:00Z",
  "completed_at": null,
  "error_message": null
}
```

---

### 2.4 資料管理系 (9エンドポイント)

#### 18. GET /api/documents

**説明**: 資料一覧を取得する（テナント内、ページネーション対応）。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| クエリパラメータ | `page` (default: 1), `per_page` (default: 20), `status` (optional), `q` (optional: 検索クエリ) |
| レスポンス | 200 OK |

```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "田中太郎 引き継ぎ資料",
      "target_user_email": "tanaka@example.com",
      "generation_mode": "ai_proposal",
      "status": "completed",
      "created_at": "2026-02-13T10:00:00Z",
      "updated_at": "2026-02-13T10:05:00Z"
    }
  ],
  "total_count": 15,
  "page": 1,
  "per_page": 20
}
```

---

#### 19. GET /api/documents/{id}

**説明**: 資料の詳細（セクション含む）を取得する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| パスパラメータ | `id` (document ID) |
| レスポンス | 200 OK |

```json
{
  "id": "uuid",
  "title": "田中太郎 引き継ぎ資料",
  "target_user_email": "tanaka@example.com",
  "generation_mode": "ai_proposal",
  "template_id": null,
  "date_range_start": "2026-01-01",
  "date_range_end": "2026-02-13",
  "data_sources": ["calendar", "slack", "spreadsheet"],
  "status": "completed",
  "share_enabled": false,
  "share_token": null,
  "metadata": {},
  "sections": [
    {
      "id": "uuid",
      "section_order": 1,
      "title": "概要",
      "content": "## 概要\n\n田中太郎さんの2026年1月〜2月の引き継ぎ資料です。...",
      "source_tags": ["calendar", "slack", "spreadsheet"],
      "source_references": [...],
      "is_ai_generated": true
    }
  ],
  "created_at": "2026-02-13T10:00:00Z",
  "updated_at": "2026-02-13T10:05:00Z"
}
```

---

#### 20. PUT /api/documents/{id}

**説明**: 資料のメタデータ（タイトル等）を更新する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要（作成者のみ） |
| パスパラメータ | `id` (document ID) |
| リクエストボディ | JSON |
| レスポンス | 200 OK |

**リクエスト**:
```json
{
  "title": "更新後のタイトル"
}
```

---

#### 21. DELETE /api/documents/{id}

**説明**: 資料を削除する（関連セクション・ジョブも CASCADE 削除）。

| 項目 | 値 |
|------|-----|
| 認証 | 必要（作成者のみ） |
| パスパラメータ | `id` (document ID) |
| レスポンス | 204 No Content |

---

#### 22. PUT /api/documents/{id}/sections/{section_id}

**説明**: セクションの内容を編集する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要（資料作成者のみ） |
| パスパラメータ | `id` (document ID), `section_id` (section ID) |
| リクエストボディ | JSON |
| レスポンス | 200 OK |

**リクエスト**:
```json
{
  "title": "更新後のセクションタイトル",
  "content": "更新後の本文..."
}
```

**備考**: 手動編集時に `is_ai_generated` を `false` に自動変更。

---

#### 23. POST /api/documents/{id}/share

**説明**: 共有リンクを発行する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要（作成者のみ） |
| パスパラメータ | `id` (document ID) |
| レスポンス | 200 OK |

```json
{
  "share_url": "https://hikitugu.vercel.app/shared/abc123token",
  "share_token": "abc123token"
}
```

---

#### 24. DELETE /api/documents/{id}/share

**説明**: 共有リンクを無効化する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要（作成者のみ） |
| パスパラメータ | `id` (document ID) |
| レスポンス | 200 OK `{ "message": "共有リンクを無効化しました" }` |

---

#### 25. GET /api/shared/{token}

**説明**: 共有リンクで資料を閲覧する（認証不要）。

| 項目 | 値 |
|------|-----|
| 認証 | 不要 |
| パスパラメータ | `token` (share token) |
| レスポンス | 200 OK（資料詳細と同じ構造、ただし編集不可情報のみ） |

---

#### 26. GET /api/documents/{id}/download

**説明**: 資料を PDF または Word 形式でダウンロードする。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| パスパラメータ | `id` (document ID) |
| クエリパラメータ | `format` (required: `pdf` or `docx`) |
| レスポンス | 200 OK (Content-Type: application/pdf or application/vnd.openxmlformats-officedocument.wordprocessingml.document) |

---

### 2.5 テンプレート管理系 (5エンドポイント)

#### 27. GET /api/templates

**説明**: テンプレート一覧を取得する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| クエリパラメータ | `page` (default: 1), `per_page` (default: 20) |
| レスポンス | 200 OK |

```json
{
  "templates": [
    {
      "id": "uuid",
      "name": "標準引き継ぎテンプレート",
      "description": "社内標準の引き継ぎ書式",
      "file_type": "docx",
      "file_size_bytes": 52480,
      "status": "ready",
      "created_at": "2026-02-01T10:00:00Z"
    }
  ],
  "total_count": 3,
  "page": 1,
  "per_page": 20
}
```

---

#### 28. POST /api/templates

**説明**: テンプレートファイルをアップロードする（multipart/form-data）。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| Content-Type | multipart/form-data |
| フォームフィールド | `file` (required: .docx or .pdf), `name` (required), `description` (optional) |
| レスポンス | 201 Created |

**処理フロー**:
1. ファイルを Supabase Storage にアップロード
2. `templates` レコードを `status: 'processing'` で作成
3. バックグラウンドでファイルを解析し `parsed_structure` を生成
4. 解析完了後 `status: 'ready'` に更新

```json
{
  "id": "uuid",
  "name": "新しいテンプレート",
  "status": "processing",
  "message": "テンプレートをアップロードしました。解析中です"
}
```

---

#### 29. GET /api/templates/{id}

**説明**: テンプレートの詳細（解析済み構造含む）を取得する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| パスパラメータ | `id` (template ID) |
| レスポンス | 200 OK |

```json
{
  "id": "uuid",
  "name": "標準引き継ぎテンプレート",
  "description": "社内標準の引き継ぎ書式",
  "file_type": "docx",
  "file_size_bytes": 52480,
  "status": "ready",
  "parsed_structure": {
    "sections": [
      { "order": 1, "title": "概要", "level": 1 },
      { "order": 2, "title": "業務内容", "level": 1 },
      { "order": 3, "title": "引き継ぎ事項", "level": 1 }
    ]
  },
  "created_at": "2026-02-01T10:00:00Z",
  "updated_at": "2026-02-01T10:00:30Z"
}
```

---

#### 30. DELETE /api/templates/{id}

**説明**: テンプレートを削除する（Storage 上のファイルも削除）。

| 項目 | 値 |
|------|-----|
| 認証 | 必要（アップロードしたユーザーのみ） |
| パスパラメータ | `id` (template ID) |
| レスポンス | 204 No Content |

---

#### 31. GET /api/templates/{id}/preview

**説明**: テンプレートのプレビュー（解析済み構造のビジュアル表示）を取得する。

| 項目 | 値 |
|------|-----|
| 認証 | 必要 |
| パスパラメータ | `id` (template ID) |
| レスポンス | 200 OK |

```json
{
  "id": "uuid",
  "name": "標準引き継ぎテンプレート",
  "preview_sections": [
    {
      "order": 1,
      "title": "概要",
      "level": 1,
      "sample_content": "（テンプレートから抽出されたサンプルテキスト）"
    }
  ]
}
```

---

## 3. 画面フロー設計 (7画面)

### 画面遷移図

```
ログイン画面 → ダッシュボード → 新規作成画面（3ステップウィザード）
                    │                    │
                    │                    ├→ AI提案確認画面 → プレビュー・編集画面
                    │                    └→ プレビュー・編集画面（テンプレートモード）
                    │
                    ├→ プレビュー・編集画面（一覧から選択）
                    ├→ テンプレート管理画面
                    └→ 設定画面
```

---

### 3.1 ログイン画面

**パス**: `/login`

**目的**: ユーザー認証。Google アカウントでのログインを提供する。

**主要コンポーネント**:
- hikitugu ロゴ・タグライン
- 「Google でログイン」ボタン（プライマリ）
- サービス説明テキスト
- 利用規約・プライバシーポリシーリンク

**ユーザーアクション**:
1. 「Google でログイン」をクリック → Google OAuth 同意画面へリダイレクト
2. Google 認証完了 → ダッシュボードへ遷移

---

### 3.2 ダッシュボード

**パス**: `/dashboard`

**目的**: 生成済み資料の一覧表示と新規作成への導線。

**主要コンポーネント**:
- ヘッダー（ロゴ、ユーザーアバター、設定リンク）
- 「新規作成」ボタン（プライマリ）
- 資料一覧テーブル（タイトル、対象者、ステータス、作成日、アクション）
- ステータスバッジ（draft / generating / completed / error）
- 検索・フィルター機能
- ページネーション

**ユーザーアクション**:
1. 「新規作成」クリック → 新規作成画面へ
2. 資料行をクリック → プレビュー・編集画面へ
3. アクションメニュー: 共有リンク発行、ダウンロード（PDF/Word）、削除
4. テンプレート管理リンク → テンプレート管理画面へ
5. 設定アイコン → 設定画面へ

---

### 3.3 新規作成画面（3ステップウィザード）

**パス**: `/documents/new`

**目的**: 引き継ぎ資料の生成条件を段階的に設定する。

#### Step 1: 対象者・期間選択

**主要コンポーネント**:
- 資料タイトル入力フィールド
- 対象者選択（自分自身 / メールアドレス指定）
- 期間選択（開始日・終了日のデートピッカー）
- 「次へ」ボタン

#### Step 2: データソース選択

**主要コンポーネント**:
- データソースチェックボックス（Google Calendar, Slack, Google Sheets）
- Slack: チャンネル選択リスト（複数選択可）
- Google Sheets: スプレッドシート選択リスト（複数選択可）
- 各ソースの接続状態表示（未連携の場合は連携ボタン表示）
- データプレビューボタン（統合データプレビュー API を呼び出し）
- 「前へ」「次へ」ボタン

#### Step 3: 出力形式選択

**主要コンポーネント**:
- 出力モード選択ラジオボタン
  - A) テンプレート指定モード: テンプレート選択ドロップダウン + アップロードボタン
  - B) AI提案モード: 説明テキスト
- 「前へ」「生成開始」ボタン

**ユーザーアクション**:
1. 各ステップの入力を完了し「次へ」で進む
2. テンプレートモード選択時: 「生成開始」→ 非同期ジョブ開始 → プレビュー・編集画面（生成中表示）へ遷移
3. AI提案モード選択時: 「生成開始」→ AI提案確認画面へ遷移

---

### 3.4 AI提案確認画面

**パス**: `/documents/{id}/proposal`

**目的**: AI が提案したセクション構成を確認・承認する。

**主要コンポーネント**:
- 提案されたセクション構成のカード一覧
  - セクションタイトル
  - セクション概要説明
  - 使用予定データソースのタグ表示
- フィードバック入力欄（任意）
- 「承認して生成開始」ボタン（プライマリ）
- 「キャンセル」ボタン

**ユーザーアクション**:
1. 提案内容を確認
2. 必要に応じてフィードバックを入力
3. 「承認して生成開始」→ 非同期ジョブ開始 → プレビュー・編集画面（生成中表示）へ遷移

---

### 3.5 プレビュー・編集画面

**パス**: `/documents/{id}`

**目的**: 生成された資料の閲覧・編集・ダウンロード。

**主要コンポーネント**:
- 資料タイトル（編集可能）
- 生成ステータス表示（generating 時はプログレスバー + 現在のステップ表示）
  - Supabase Realtime でリアルタイム更新
- セクション一覧（セクション順に表示）
  - セクションタイトル（編集可能）
  - セクション本文（リッチテキストエディタ / Markdown エディタ）
  - ソース出典タグ（Calendar / Slack / Spreadsheet のバッジ表示）
  - 参照元リンク（クリックで元ソースへ遷移）
  - AI生成フラグ表示
- ツールバー
  - 「PDF ダウンロード」ボタン
  - 「Word ダウンロード」ボタン
  - 「共有リンク発行」ボタン
  - 「保存」ボタン

**ユーザーアクション**:
1. セクションの内容を直接編集
2. PDF/Word 形式でダウンロード
3. 共有リンクを発行してコピー
4. ダッシュボードに戻る

---

### 3.6 テンプレート管理画面

**パス**: `/templates`

**目的**: テンプレート（ひな形）の管理。

**主要コンポーネント**:
- 「テンプレートをアップロード」ボタン
- テンプレート一覧テーブル（名前、ファイル形式、サイズ、ステータス、アクション）
- アップロードモーダル
  - ファイルドラッグ&ドロップエリア
  - テンプレート名入力
  - 説明入力（任意）
  - 「アップロード」ボタン
- テンプレートプレビューモーダル（解析済みセクション構造の表示）

**ユーザーアクション**:
1. 「アップロード」→ ファイル選択 → テンプレート登録
2. テンプレート行をクリック → プレビューモーダル表示
3. 削除ボタン → 確認ダイアログ → 削除

---

### 3.7 設定画面

**パス**: `/settings`

**目的**: 連携先サービスの管理とプロフィール編集。

**主要コンポーネント**:
- プロフィールセクション
  - 表示名の編集
  - メールアドレス表示
  - アバター表示
- 連携先サービスセクション
  - Google: 接続状態、スコープ一覧、再認証ボタン、切断ボタン
  - Slack: 接続状態、ワークスペース名、再認証ボタン、切断ボタン
    - 未連携時は「Slack を連携する」ボタン表示
- テナント情報セクション（owner のみ表示）
  - テナント名の編集
  - プラン表示

**ユーザーアクション**:
1. 表示名を変更して保存
2. Slack 連携ボタン → Slack OAuth フローへ
3. 連携済みサービスの切断

---

## 4. システム構成図

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client (Browser)                          │
│                                                                         │
│  Next.js (React) — App Router — TypeScript                             │
│  ホスティング: Vercel (Static + SSR)                                    │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ HTTPS (REST API)
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        FastAPI Backend                                   │
│                                                                         │
│  ホスティング: Vercel Serverless Functions (Python Runtime)              │
│                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ 認証系    │  │ データ連携│  │ 資料生成  │  │ 資料管理  │               │
│  │ Router   │  │ Router   │  │ Router   │  │ Router   │               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
│       │              │              │              │                     │
│       ▼              ▼              ▼              ▼                     │
│  ┌─────────────────────────────────────────────────────┐               │
│  │                  Service Layer                       │               │
│  │  AuthService / DataService / GenerationService /    │               │
│  │  DocumentService / TemplateService                  │               │
│  └──────────────────────┬──────────────────────────────┘               │
└─────────────────────────┼───────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┬───────────────┐
          ▼               ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Supabase    │ │ Google APIs  │ │  Slack API   │ │  Gemini API  │
│              │ │              │ │              │ │              │
│ ・PostgreSQL │ │ ・Calendar   │ │ ・channels   │ │ ・要約生成    │
│ ・Auth       │ │ ・Sheets     │ │ ・messages   │ │ ・構成提案    │
│ ・Storage    │ │ ・Drive      │ │              │ │ ・セクション  │
│ ・Realtime   │ │              │ │              │ │  生成        │
│ ・Edge Funcs │ │              │ │              │ │              │
└──────┬───────┘ └──────────────┘ └──────────────┘ └──────────────┘
       │
       │ 非同期処理フロー
       ▼
┌──────────────────────────────────────────────────────────┐
│  Supabase Edge Functions (Deno Runtime)                  │
│                                                          │
│  ・generate-document: 資料生成ワーカー                    │
│  ・parse-template: テンプレート解析ワーカー                │
│                                                          │
│  処理完了 → Supabase Realtime → Client にリアルタイム通知  │
└──────────────────────────────────────────────────────────┘

ファイルストレージ:
┌──────────────────────────────────────────────────────────┐
│  Supabase Storage                                        │
│                                                          │
│  Buckets:                                                │
│  ・templates/  — アップロードされたテンプレートファイル     │
│  ・generated/  — 生成された PDF/Word ファイル              │
└──────────────────────────────────────────────────────────┘
```

---

## 5. ディレクトリ構成

```
hikitugu/
├── frontend/                          # Next.js フロントエンド
│   ├── public/                        # 静的ファイル
│   │   └── favicon.ico
│   ├── src/
│   │   ├── app/                       # App Router
│   │   │   ├── layout.tsx             # ルートレイアウト
│   │   │   ├── page.tsx               # トップページ（→ /login リダイレクト）
│   │   │   ├── login/
│   │   │   │   └── page.tsx           # ログイン画面
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx           # ダッシュボード
│   │   │   ├── documents/
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx       # 新規作成（3ステップウィザード）
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx       # プレビュー・編集
│   │   │   │       └── proposal/
│   │   │   │           └── page.tsx   # AI提案確認
│   │   │   ├── templates/
│   │   │   │   └── page.tsx           # テンプレート管理
│   │   │   ├── settings/
│   │   │   │   └── page.tsx           # 設定
│   │   │   └── shared/
│   │   │       └── [token]/
│   │   │           └── page.tsx       # 共有リンク閲覧
│   │   ├── components/                # 共通UIコンポーネント
│   │   │   ├── ui/                    # 汎用UIパーツ（Button, Card, Modal 等）
│   │   │   ├── layout/               # レイアウト系（Header, Sidebar）
│   │   │   ├── documents/            # 資料関連コンポーネント
│   │   │   ├── templates/            # テンプレート関連コンポーネント
│   │   │   └── auth/                 # 認証関連コンポーネント
│   │   ├── hooks/                     # カスタムフック
│   │   │   ├── useAuth.ts
│   │   │   ├── useDocuments.ts
│   │   │   ├── useRealtime.ts
│   │   │   └── useTemplates.ts
│   │   ├── lib/                       # ユーティリティ・設定
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts          # Supabase クライアント
│   │   │   │   └── middleware.ts      # Auth ミドルウェア
│   │   │   ├── api.ts                 # API クライアント
│   │   │   └── utils.ts              # 汎用ユーティリティ
│   │   ├── types/                     # TypeScript 型定義
│   │   │   ├── database.ts            # DB スキーマ型（Supabase 生成）
│   │   │   ├── api.ts                 # API リクエスト/レスポンス型
│   │   │   └── index.ts
│   │   └── styles/                    # グローバルスタイル
│   │       └── globals.css
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                           # FastAPI バックエンド
│   ├── api/
│   │   └── index.py                   # Vercel Serverless エントリーポイント
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI アプリケーション初期化
│   │   ├── config.py                  # 環境変数・設定
│   │   ├── dependencies.py            # DI（認証、DB セッション等）
│   │   ├── routers/                   # APIルーター
│   │   │   ├── __init__.py
│   │   │   ├── auth.py                # 認証系エンドポイント
│   │   │   ├── data.py                # データ連携系エンドポイント
│   │   │   ├── documents.py           # 資料管理系エンドポイント
│   │   │   ├── generation.py          # 資料生成系エンドポイント
│   │   │   └── templates.py           # テンプレート管理系エンドポイント
│   │   ├── services/                  # ビジネスロジック
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py        # 認証・OAuth処理
│   │   │   ├── calendar_service.py    # Google Calendar 連携
│   │   │   ├── slack_service.py       # Slack 連携
│   │   │   ├── sheets_service.py      # Google Sheets 連携
│   │   │   ├── generation_service.py  # 資料生成・AI処理
│   │   │   ├── document_service.py    # 資料CRUD
│   │   │   ├── template_service.py    # テンプレート管理
│   │   │   └── encryption_service.py  # トークン暗号化
│   │   ├── models/                    # Pydantic スキーマ
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── data.py
│   │   │   ├── documents.py
│   │   │   ├── generation.py
│   │   │   └── templates.py
│   │   └── utils/                     # ユーティリティ
│   │       ├── __init__.py
│   │       └── crypto.py              # AES-256-GCM 暗号化ヘルパー
│   ├── requirements.txt
│   └── vercel.json
│
├── supabase/                          # Supabase 設定
│   ├── config.toml                    # Supabase CLI 設定
│   ├── migrations/                    # DBマイグレーション
│   │   ├── 00001_create_tenants.sql
│   │   ├── 00002_create_users.sql
│   │   ├── 00003_create_oauth_tokens.sql
│   │   ├── 00004_create_templates.sql
│   │   ├── 00005_create_documents.sql
│   │   ├── 00006_create_document_sections.sql
│   │   ├── 00007_create_generation_jobs.sql
│   │   ├── 00008_create_ai_proposals.sql
│   │   └── 00009_create_rls_policies.sql
│   ├── functions/                     # Supabase Edge Functions
│   │   ├── generate-document/
│   │   │   └── index.ts              # 資料生成ワーカー
│   │   └── parse-template/
│   │       └── index.ts              # テンプレート解析ワーカー
│   └── seed.sql                       # 初期データ（開発用）
│
├── .env.example                       # 環境変数テンプレート
├── .gitignore
└── README.md
```

---

## 6. 認証フロー詳細

### 6.1 Google OAuth 2.0 フロー

```
1. ユーザーが「Google でログイン」をクリック
   Browser → GET /api/auth/google

2. FastAPI が Google OAuth URL を生成しリダイレクト
   FastAPI → 302 Redirect → Google OAuth 同意画面
   スコープ:
     - openid
     - email
     - profile
     - https://www.googleapis.com/auth/calendar.readonly
     - https://www.googleapis.com/auth/spreadsheets.readonly
     - https://www.googleapis.com/auth/drive.readonly

3. ユーザーが同意
   Google → 302 Redirect → GET /api/auth/google/callback?code=xxx&state=yyy

4. FastAPI がコールバックを処理
   a. 認可コードでアクセストークン・リフレッシュトークンを取得
   b. Google UserInfo API でユーザー情報を取得
   c. Supabase Admin API でユーザーを作成/取得
      - auth.users にレコード作成
      - public.users にレコード作成（初回のみ）
      - テナントが存在しない場合は自動作成
   d. oauth_tokens テーブルにトークンを暗号化して保存
   e. Supabase セッション（JWT）を発行

5. フロントエンドにリダイレクト
   FastAPI → 302 Redirect → /dashboard
   （JWT を HttpOnly Cookie にセット）
```

### 6.2 Slack OAuth 2.0 フロー

```
1. ユーザーが設定画面で「Slack を連携する」をクリック
   Browser → GET /api/auth/slack
   ※ 既に Google 認証済みであることが前提

2. FastAPI が Slack OAuth URL を生成しリダイレクト
   スコープ:
     - channels:read
     - channels:history
     - users:read

3. ユーザーが同意
   Slack → 302 Redirect → GET /api/auth/slack/callback?code=xxx&state=yyy

4. FastAPI がコールバックを処理
   a. 認可コードでアクセストークンを取得
   b. oauth_tokens テーブルに暗号化して保存
      - provider: 'slack'
      - metadata: { workspace_id, team_name }

5. 設定画面にリダイレクト
   FastAPI → 302 Redirect → /settings
```

### 6.3 トークンリフレッシュフロー

```
1. API リクエスト時にトークンの有効期限を確認
2. 期限切れの場合:
   a. oauth_tokens から暗号化されたリフレッシュトークンを取得
   b. 復号化
   c. プロバイダーのトークンエンドポイントで新しいアクセストークンを取得
   d. 新しいトークンを暗号化して保存
   e. 元のリクエストを再実行
3. リフレッシュトークンも無効な場合:
   - 401 エラーを返し、再認証を促す
```

---

## 7. セキュリティ設計

### 7.1 OAuthトークンの暗号化

**方式**: AES-256-GCM（Authenticated Encryption）

```
暗号化フロー:
1. 環境変数 ENCRYPTION_KEY から 256-bit キーを取得
2. ランダムな 96-bit IV（Initialization Vector）を生成
3. AES-256-GCM でトークンを暗号化
4. IV + 暗号文 + 認証タグ を Base64 エンコードして DB に保存

復号化フロー:
1. Base64 デコード
2. IV、暗号文、認証タグを分離
3. AES-256-GCM で復号化（認証タグで改ざん検知）
```

**実装**: Python の `cryptography` ライブラリを使用。

### 7.2 Row Level Security (RLS)

- 全テーブルで RLS を有効化（セクション 1.9 参照）
- テナント単位のデータ分離を DB レベルで保証
- バックエンドの実装ミスによるデータ漏洩リスクを軽減

### 7.3 CORS 設定

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://hikitugu.vercel.app",     # 本番環境
        "http://localhost:3000",            # 開発環境
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### 7.4 Rate Limiting

| エンドポイントカテゴリ | 制限 |
|-------------------------|------|
| 認証系 | 10回/分/IP |
| データ連携系 | 30回/分/ユーザー |
| 資料生成系 | 5回/分/ユーザー |
| 一般API | 60回/分/ユーザー |

**実装**: `slowapi` ライブラリを使用。Vercel Serverless の制約上、Redis ではなくメモリベースのレートリミッターを使用（将来的に Upstash Redis への移行を検討）。

### 7.5 入力バリデーション

- 全リクエストを Pydantic モデルでバリデーション
- ファイルアップロード: ファイルタイプ（.docx, .pdf のみ）、サイズ上限（10MB）を検証
- SQL インジェクション: Supabase クライアントのパラメータバインディングで防止
- XSS: Next.js の自動エスケープ + Content-Security-Policy ヘッダー

---

## 8. 非同期処理設計

### 8.1 資料生成フロー

```
1. クライアント → POST /api/documents/generate (または /approve-proposal)
   ├→ documents テーブルにレコード作成 (status: 'generating')
   ├→ generation_jobs テーブルにレコード作成 (status: 'pending')
   └→ 202 Accepted を即座に返却

2. Supabase Edge Function をトリガー（Database Webhook または直接呼び出し）
   Edge Function: generate-document

3. Edge Function の処理ステップ:
   ┌─────────────────────────────────────────────────────────┐
   │ Step 1: データ収集 (progress: 0-30%)                     │
   │   ├→ Google Calendar API でイベント取得                   │
   │   ├→ Slack API でメッセージ取得                           │
   │   └→ Google Sheets API でスプレッドシートデータ取得        │
   │   ※ generation_jobs.current_step = 'fetching_data'       │
   │                                                          │
   │ Step 2: データ統合・前処理 (progress: 30-40%)             │
   │   ├→ 時系列でソート                                      │
   │   ├→ ソースタグ付与                                      │
   │   └→ 重複排除・正規化                                    │
   │   ※ generation_jobs.current_step = 'processing_data'     │
   │                                                          │
   │ Step 3: AI生成 (progress: 40-80%)                        │
   │   ├→ Gemini API にプロンプト送信                          │
   │   ├→ セクションごとに要約・生成                           │
   │   └→ ソース参照情報を紐付け                              │
   │   ※ generation_jobs.current_step = 'generating_content'  │
   │                                                          │
   │ Step 4: 保存 (progress: 80-100%)                         │
   │   ├→ document_sections テーブルに各セクションを保存       │
   │   ├→ documents.status を 'completed' に更新              │
   │   └→ generation_jobs.status を 'completed' に更新        │
   │   ※ generation_jobs.current_step = 'saving'              │
   └─────────────────────────────────────────────────────────┘

4. リアルタイム通知
   generation_jobs テーブルの UPDATE を Supabase Realtime で監視
   → クライアントがプログレスバーをリアルタイム更新
```

### 8.2 テンプレート解析フロー

```
1. クライアント → POST /api/templates (ファイルアップロード)
   ├→ Supabase Storage にファイル保存
   ├→ templates テーブルにレコード作成 (status: 'processing')
   └→ 201 Created を即座に返却

2. Supabase Edge Function をトリガー
   Edge Function: parse-template

3. Edge Function の処理:
   ├→ Storage からファイルをダウンロード
   ├→ ファイル形式に応じて解析
   │   ├→ .docx: python-docx で見出し・段落構造を抽出
   │   └→ .pdf: pdfplumber でテキスト・構造を抽出
   ├→ parsed_structure を JSON として保存
   └→ templates.status を 'ready' に更新

4. エラー時:
   └→ templates.status を 'error' に更新
```

### 8.3 Supabase Realtime 設定

クライアント側で `generation_jobs` テーブルの変更をサブスクライブする:

```typescript
// フロントエンド: useRealtime フック
const channel = supabase
  .channel('job-progress')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'generation_jobs',
      filter: `id=eq.${jobId}`,
    },
    (payload) => {
      setProgress(payload.new.progress);
      setCurrentStep(payload.new.current_step);
      if (payload.new.status === 'completed') {
        // 生成完了: 資料データを再取得
        refetchDocument();
      }
    }
  )
  .subscribe();
```

---

## 付録: 環境変数一覧

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://hikitugu.vercel.app/api/auth/google/callback

# Slack OAuth
SLACK_CLIENT_ID=xxx
SLACK_CLIENT_SECRET=xxx
SLACK_REDIRECT_URI=https://hikitugu.vercel.app/api/auth/slack/callback

# Gemini API
GEMINI_API_KEY=xxx

# Encryption
ENCRYPTION_KEY=base64-encoded-256-bit-key

# Application
APP_URL=https://hikitugu.vercel.app
```
