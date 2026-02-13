# Claude Code「Agent Teams」— チーム生成と並列稼働

Claude（Anthropic）の **Claude Code** で、複数エージェントをチームとして並列稼働させる手順です。

---

## 1. Agent Teams を有効にする

**実験的機能**のため、明示的に有効化が必要です。

### 方法A: ユーザー設定（推奨）

次のファイルを編集します。

- **Windows**: `C:\Users\atumi\.claude\settings.json`

内容を次のようにします（既存のキーは残したまま `env` を追加）。

```json
{
  "autoUpdatesChannel": "latest",
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### 方法B: 環境変数

PowerShell で現在のセッションだけ有効にする場合:

```powershell
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"
claude
```

---

## 2. チームを起動する

ターミナルで `claude` を起動し、**自然言語で**チーム作成を指示します。

### 例: 役割を分けた 3 人チーム

```
エージェントチームを3人作成してください。
- researcher：市場調査担当
- analyst：データ分析担当
- reviewer：品質レビュー担当
```

### 例: 並列レビュー

```
PR #142 をレビューするエージェントチームを作成して。
3人のレビュアーを起動して：
- 1人目はセキュリティ観点
- 1人目はパフォーマンス影響
- 1人目はテストカバレッジの検証
それぞれレビューして結果を報告させる。
```

### 例: 人数とモデルを指定

```
4人のチームメンバーで、これらのモジュールを並列にリファクタして。
各メンバーは Sonnet を使って。
```

---

## 3. 表示モード

| モード | 説明 | 備考 |
|--------|------|------|
| **In-process** | 全員が同じターミナル内 | 追加設定不要。Shift+Up/Down でメンバー切り替え |
| **Split panes** | 各メンバーが別ペイン | **tmux** または **iTerm2** が必要。Windows では制限あり |

- デフォルトは **auto**（tmux 内なら Split、それ以外は In-process）。
- Windows では **In-process** が無難です（Split は macOS 向けの記載が多いです）。

強制的に In-process にしたい場合:

```powershell
claude --teammate-mode in-process
```

または `settings.json` に:

```json
"teammateMode": "in-process"
```

---

## 4. 操作の基本

- **メンバー選択**: **Shift+Up / Shift+Down** でチームメンバーを切り替え、そのメンバーに直接メッセージ送信。
- **タスクリスト**: **Ctrl+T** で共有タスクリストの表示切替。
- **デリゲートモード**: **Shift+Tab** でリーダーを「調整専用」にし、自分ではコードを触らずチームだけを動かす。
- **シャットダウン**: チャットで「researcher をシャットダウンして」などと指示。
- **クリーンアップ**: 作業後は「チームをクリーンアップして」と指示。

---

## 5. 向いているタスク

- **調査・レビュー**: 複数人が別の観点で並列に調査し、結果を共有・議論する。
- **競合仮説の検証**: 別々の仮説を並列で検証し、早く結論に寄せる。
- **役割分担**: フロント / バック / テストなど、担当ファイルが分かれる作業。

**注意**: 同じファイルを複数人が編集すると上書きされます。担当ファイルを分けて使ってください。トークン消費は単一セッションより多くなります。

---

## 6. スタートまでの最短手順

1. `C:\Users\atumi\.claude\settings.json` に `"env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }` を追加して保存。
2. ターミナルで `claude` を起動（PATH が通っていること）。
3. 「3人のエージェントチームを作成。researcher、analyst、reviewer の役割で」などと入力して実行。

以上で、Claude の Agent 機能でチームを生成し並列稼働できます。
