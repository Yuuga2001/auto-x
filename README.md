# auto-x

OpenAI で生成したコンテンツを、毎日ランダムな時間に X (Twitter) へ自動投稿する CLI ツール。

## 特徴

- **AI コンテンツ生成** - ペルソナ・テーマ・カスタムプロンプトに基づき、OpenAI がポストを自動生成
- **ランダム時間投稿** - 指定した時間帯内で毎日ランダムな時刻に投稿。Bot っぽさを軽減
- **140 文字制限** - 生成 → 検証 → 再生成の 3 重チェックで確実に 140 文字未満に収める
- **投稿履歴管理** - 過去の投稿を記録し、重複コンテンツを自動回避
- **PM2 対応** - 常駐プロセスとして安定運用可能

## セットアップ

### 1. インストール

```bash
git clone https://github.com/Yuuga2001/auto-x.git
cd auto-x
npm install
```

### 2. X API キーの取得

1. [X Developer Portal](https://developer.x.com/) でアプリを作成
2. 「ユーザー認証設定」で **Read and Write** 権限を付与
3. 以下の 4 つのキーを取得：
   - API Key（コンシューマーキー）
   - API Secret（コンシューマーシークレット）
   - Access Token（アクセストークン）← 権限変更後に再生成が必要
   - Access Token Secret（アクセストークンシークレット）

### 3. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集：

```
OPENAI_API_KEY=sk-xxxxx

X_APP_KEY=xxxxx
X_APP_SECRET=xxxxx
X_ACCESS_TOKEN=xxxxx
X_ACCESS_SECRET=xxxxx
```

### 4. 設定ファイルの作成

```bash
cp config.example.json config.json
```

`config.json` を自分好みに編集（詳細は後述）。

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `npm run post:dry` | コンテンツ生成のみ（投稿しない）。動作テストに最適 |
| `npm run post` | 今すぐ 1 件投稿 |
| `npm run start` | スケジューラーを起動して常駐（自動投稿開始） |
| `npm run config` | 現在の設定を表示 |
| `npm run history` | 投稿履歴を表示 |
| `npx tsx src/cli.ts verify` | X API の接続テスト |

### 推奨の動作確認手順

```bash
# 1. コンテンツ生成テスト（X API キー不要、OpenAI キーのみ）
npm run post:dry

# 2. API 接続テスト
npx tsx src/cli.ts verify

# 3. 実際に 1 件投稿
npm run post

# 4. 常駐起動（自動投稿開始）
npm run start
```

## 設定ファイル（config.json）

### persona - 投稿者のペルソナ

```json
{
  "persona": {
    "name": "表示名",
    "description": "人物像の説明。経歴・価値観・発信スタンスなど",
    "tone": "文体の説明。丁寧語 or カジュアル、語尾の癖など",
    "interests": ["興味1", "興味2", "興味3"]
  }
}
```

### theme - 投稿テーマ

```json
{
  "theme": {
    "topics": [
      "テーマ1（毎回ランダムに1つ選ばれる）",
      "テーマ2",
      "テーマ3"
    ],
    "hashtags": ["#ハッシュタグ1", "#ハッシュタグ2"],
    "style": "casual"
  }
}
```

`style` は `"casual"` / `"informative"` / `"humorous"` / `"professional"` から選択。

### schedule - スケジュール

```json
{
  "schedule": {
    "timezone": "Asia/Tokyo",
    "postWindowStart": 7,
    "postWindowEnd": 23,
    "postsPerDay": 10
  }
}
```

- `postWindowStart` / `postWindowEnd` - 投稿する時間帯（時）
- `postsPerDay` - 1 日の投稿数。この数だけランダムな時刻が生成される

### openai - モデル設定

```json
{
  "openai": {
    "model": "gpt-4o-mini"
  }
}
```

コストを抑えるなら `gpt-4o-mini`、品質重視なら `gpt-4o` を指定。

### customPrompt - カスタムプロンプト

生成 AI への追加指示。文体・構成パターン・NG 事項などを自由に記述できる。

```json
{
  "customPrompt": "丁寧語で書いてください。一文は短く。"
}
```

## 常駐運用（PM2）

```bash
# PM2 をグローバルインストール
npm install -g pm2

# 起動
pm2 start ecosystem.config.cjs

# 状態確認
pm2 status

# ログ確認
pm2 logs auto-x

# 停止
pm2 stop auto-x

# OS 再起動時に自動復帰
pm2 save
pm2 startup
```

## 動作の仕組み

```
毎日 0:00
  └─ 指定した時間帯内でランダムな投稿時刻を決定
      例: 7:00-23:00 の間で 10 回分 → 8:14, 9:47, 11:03, ...

各投稿時刻になったら:
  1. 過去の投稿履歴を取得（重複回避用）
  2. OpenAI API でコンテンツを生成
  3. 140 文字未満チェック（超えたら再生成 → それでもダメなら強制切り詰め）
  4. X API (twitter-api-v2) で投稿
  5. 結果を data/history.json に記録
```

## ディレクトリ構成

```
auto-x/
├── src/
│   ├── cli.ts              # CLI コマンド定義
│   ├── index.ts            # エントリーポイント（スケジューラー起動）
│   ├── config/             # 設定読み込み・バリデーション
│   ├── generator/          # OpenAI コンテンツ生成
│   ├── poster/             # X API 投稿
│   ├── scheduler/          # ランダム時間スケジューラー
│   ├── history/            # 投稿履歴管理
│   └── logger/             # ログ管理
├── config.json             # 設定ファイル（要作成）
├── .env                    # API キー（要作成）
├── data/history.json       # 投稿履歴（自動生成）
├── logs/                   # ログファイル（自動生成）
└── ecosystem.config.cjs    # PM2 設定
```

## 注意事項

- X API Free Tier の上限は **月 500 投稿**。`postsPerDay: 10` の場合、月 300 投稿程度になるので余裕あり
- `.env` と `config.json` は `.gitignore` に含まれているため、Git にコミットされません
- API キーは絶対に公開リポジトリにプッシュしないでください

## ライセンス

ISC
