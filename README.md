# auto-x

OpenAI で生成したコンテンツを、毎日ランダムな時間に X (Twitter) へ自動投稿する CLI ツール。
note 記事の自動紹介投稿にも対応。

## 特徴

- **AI コンテンツ生成** - ペルソナ・テーマ・カスタムプロンプトに基づき、OpenAI がポストを自動生成
- **note 記事の自動紹介** - CSV に登録した note 記事を、宣伝っぽくない自然な文章で紹介投稿（70/30 の比率で自動振り分け）
- **ランダム時間投稿** - 指定した時間帯内で毎日ランダムな時刻に投稿。Bot っぽさを軽減
- **140 文字制限** - 生成 → 検証 → 再生成の 3 重チェックで確実に 140 文字未満に収める
- **投稿履歴管理** - 過去の投稿を記録し、重複コンテンツを自動回避
- **PM2 対応** - 常駐プロセスとして安定運用可能
- **GCP 永久無料枠対応** - Google Cloud の e2-micro VM で 24 時間 365 日無料運用

---

## 目次

1. [ローカルセットアップ](#ローカルセットアップ)
2. [X API キーの取得](#x-api-キーの取得)
3. [note 記事の設定](#note-記事の設定)
4. [コマンド一覧](#コマンド一覧)
5. [設定ファイル（config.json）](#設定ファイルconfigjson)
6. [GCP VM へのデプロイ（本番運用）](#gcp-vm-へのデプロイ本番運用)
7. [VM の運用・メンテナンス](#vm-の運用メンテナンス)
8. [動作の仕組み](#動作の仕組み)
9. [ディレクトリ構成](#ディレクトリ構成)
10. [注意事項](#注意事項)

---

## ローカルセットアップ

### 1. インストール

```bash
git clone https://github.com/Yuuga2001/auto-x.git
cd auto-x
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して API キーを入力：

```
OPENAI_API_KEY=sk-xxxxx

X_APP_KEY=xxxxx
X_APP_SECRET=xxxxx
X_ACCESS_TOKEN=xxxxx
X_ACCESS_SECRET=xxxxx
```

### 3. 設定ファイルの作成

```bash
cp config.example.json config.json
```

`config.json` を自分好みに編集（詳細は [設定ファイル](#設定ファイルconfigjson) を参照）。

### 4. 動作確認

```bash
# コンテンツ生成テスト（投稿しない。OpenAI キーのみで動作）
npm run post:dry

# X API 接続テスト
npx tsx src/cli.ts verify

# 実際に 1 件投稿
npm run post

# 常駐起動（自動投稿開始。ターミナルを閉じると停止する）
npm run start
```

---

## X API キーの取得

### 1. Developer Portal でアプリ作成

1. [X Developer Portal](https://developer.x.com/) にアクセス
2. アプリを新規作成

### 2. ユーザー認証設定

1. アプリの「ユーザー認証設定」→「セットアップ」をクリック
2. **App permissions** を **Read and Write** に変更
3. コールバック URI: `https://localhost`
4. ウェブサイト URL: `https://github.com/Yuuga2001/auto-x`（任意）
5. 「変更を保存する」

### 3. キーの取得

アプリの「キーとトークン」画面で以下を取得：

| 取得するもの | .env の変数名 | 取得方法 |
|------------|--------------|---------|
| コンシューマーキー（API Key） | `X_APP_KEY` | 「表示する」で確認 |
| コンシューマーシークレット（API Secret） | `X_APP_SECRET` | 「表示する」で確認 |
| アクセストークン | `X_ACCESS_TOKEN` | 「生成する」をクリック |
| アクセストークンシークレット | `X_ACCESS_SECRET` | 「生成する」をクリック |

> **重要**: アクセストークンは生成時に 1 度だけ表示されます。必ずコピーしてください。
> 権限を Read and Write に変更した後にアクセストークンを再生成してください。

---

## note 記事の設定

note 記事の自動紹介投稿を有効にするには、プロジェクトルートに `notes.csv` を作成します。

### 1. CSV ファイルの作成

```bash
cp notes.example.csv notes.csv
```

### 2. 記事の登録

`notes.csv` を編集して、紹介したい note 記事のタイトルと URL を登録：

```csv
title,url
AIを使った業務効率化の全手順,https://note.com/yourname/n/n1234567890a1
プログラミング初心者が最初にやるべき3つのこと,https://note.com/yourname/n/n1234567890a2
フリーランスエンジニアになって1年で学んだこと,https://note.com/yourname/n/n1234567890a3
```

- 1 行目はヘッダー（`title,url`）。2 行目以降がデータ
- タイトルにカンマが含まれていても OK（末尾の URL 部分を自動判別）

### 3. 投稿比率

`notes.csv` が存在する場合、自動的に以下の比率で投稿が振り分けられます：

| 種類 | 比率 | 内容 |
|------|------|------|
| note 紹介ポスト | **70%** | CSV からランダムに記事を選び、自然な紹介文を生成 |
| 通常ポスト | **30%** | ペルソナ・テーマに基づく通常の投稿 |

- `notes.csv` が存在しない場合は、従来通り 100% 通常ポストになります
- note ポストは「本文 + 改行 + URL」の形式で投稿されます（140 文字制限は本文のみに適用）

### 4. 確認コマンド

```bash
# CSV の読み込みテスト・記事一覧の表示
npx tsx src/cli.ts notes
```

---

## コマンド一覧

### 基本コマンド

| コマンド | 説明 |
|---------|------|
| `npm run start` | スケジューラーを起動して常駐（自動投稿開始） |
| `npm run post` | 今すぐ 1 件投稿（70/30 自動振り分け） |
| `npm run post:dry` | コンテンツ生成のみ（投稿しない。70/30 自動振り分け） |
| `npm run config` | 現在の設定を表示 |
| `npm run history` | 投稿履歴を表示 |
| `npx tsx src/cli.ts verify` | X API の接続テスト |
| `npx tsx src/cli.ts notes` | note 記事リストの確認 |

### 投稿タイプの指定

`npm run post` と `npm run post:dry` には、投稿タイプを強制するオプションがあります：

| コマンド | 説明 |
|---------|------|
| `npm run post:dry` | 70/30 自動振り分けでテスト |
| `npm run post:dry -- --note` | note 紹介ポストを強制生成 |
| `npm run post:dry -- --normal` | 通常ポストを強制生成 |
| `npm run post` | 70/30 自動振り分けで実投稿 |
| `npm run post -- --note` | note 紹介ポストを強制投稿 |
| `npm run post -- --normal` | 通常ポストを強制投稿 |

> **Tip**: `--` は npm にオプションをスクリプトへ渡すための区切りです。

---

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
    "hashtags": [],
    "style": "casual"
  }
}
```

- `topics` - 投稿テーマのリスト。毎回ランダムに 1 つ選ばれる
- `hashtags` - 使用可能なハッシュタグ候補。空配列なら使用しない
- `style` - `"casual"` / `"informative"` / `"humorous"` / `"professional"` から選択

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

- `timezone` - 投稿時間帯の基準タイムゾーン
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
通常ポストの生成にのみ適用されます（note ポストには専用プロンプトが使われます）。

```json
{
  "customPrompt": "丁寧語で書いてください。一文は短く。140文字未満厳守。"
}
```

---

## GCP VM へのデプロイ（本番運用）

ローカル PC がスリープしても 24 時間自動投稿を続けるため、Google Cloud の永久無料 VM にデプロイします。

### 1. GCP アカウント作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. Google アカウントでログイン
3. 無料トライアルに登録（クレジットカード必要。無料枠内なら課金なし）

### 2. VM インスタンス作成

[Compute Engine](https://console.cloud.google.com/compute) →「インスタンスを作成」

| 項目 | 設定値 | 備考 |
|------|--------|------|
| 名前 | `auto-x` | 任意 |
| リージョン | `us-west1` or `us-central1` or `us-east1` | **この 3 つだけ無料** |
| マシンタイプ | `e2-micro` | **無料対象** |
| OS | Ubuntu 22.04 LTS | |
| ディスク種類 | **標準永続ディスク** | 「バランス」は有料なので注意 |
| ディスクサイズ | 30 GB | 30 GB まで無料 |

> 月間予測に $7 前後と表示されますが、無料枠適用前の定価です。実際の請求は $0 です。

「作成」をクリック。

### 3. VM に SSH 接続

VM 一覧画面で「SSH」ボタンをクリック（ブラウザで接続できます）。

### 4. Node.js と PM2 をインストール

```bash
# Node.js 20 をインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# バージョン確認
node -v
npm -v

# PM2 をグローバルインストール
sudo npm install -g pm2
```

### 5. リポジトリをクローン

```bash
git clone https://github.com/Yuuga2001/auto-x.git
cd auto-x
npm install
```

### 6. 設定ファイルを作成

```bash
cp config.example.json config.json
cp .env.example .env
```

`.env` にAPIキーを設定（`nano` がない場合は `cat` で作成）：

```bash
cat > .env << 'EOF'
OPENAI_API_KEY=sk-実際のキーをここに
X_APP_KEY=実際のキーをここに
X_APP_SECRET=実際のキーをここに
X_ACCESS_TOKEN=実際のキーをここに
X_ACCESS_SECRET=実際のキーをここに
EOF
```

`config.json` にローカルと同じ設定を反映：

```bash
cat > config.json << 'CONFIGEOF'
ここにローカルの config.json の中身を全部貼り付ける
CONFIGEOF
```

> **Tip**: ローカルの Mac で `cat config.json | pbcopy` を実行するとクリップボードにコピーされます。

note 記事を使う場合は `notes.csv` も同様に作成：

```bash
cat > notes.csv << 'CSVEOF'
title,url
記事タイトル1,https://note.com/yourname/n/xxxx
記事タイトル2,https://note.com/yourname/n/yyyy
CSVEOF
```

設定内容を確認：

```bash
cat .env
cat config.json
npx tsx src/cli.ts notes   # note記事の読み込み確認
```

### 7. 動作テスト

```bash
# コンテンツ生成テスト（70/30 自動振り分け）
npm run post:dry

# note ポストの生成テスト
npm run post:dry -- --note

# API 接続テスト
npx tsx src/cli.ts verify

# 実際に 1 件投稿
npm run post
```

### 8. PM2 で常駐起動

```bash
# 常駐起動
pm2 start ecosystem.config.cjs

# 状態を保存
pm2 save

# OS 再起動時の自動復帰を設定
pm2 startup
```

`pm2 startup` を実行すると、以下のようなコマンドが表示されます：

```
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ユーザー名 --hp /home/ユーザー名
```

**このコマンドをそのままコピー&ペーストして実行してください。**

起動確認：

```bash
pm2 status
```

以下のように `online` と表示されれば成功：

```
│ id │ name    │ mode    │ status │ cpu  │ memory │
│ 0  │ auto-x  │ cluster │ online │ 0%   │ 50mb   │
```

---

## VM の運用・メンテナンス

### SSH 接続

[GCP Console](https://console.cloud.google.com/compute) → VM 一覧 →「SSH」ボタン

### ログの確認

```bash
cd ~/auto-x

# 最新のログ 30 行を表示
tail -30 logs/combined.log

# エラーログを確認
tail -20 logs/error.log

# リアルタイムでログを監視（Ctrl+C で終了）
tail -f logs/combined.log
```

### PM2 の操作

```bash
# 状態確認
pm2 status

# ログをリアルタイム表示（Ctrl+C で終了）
pm2 logs auto-x

# 再起動
pm2 restart auto-x

# 停止
pm2 stop auto-x

# 起動
pm2 start auto-x

# 削除（完全に止める場合）
pm2 delete auto-x
```

### 投稿履歴の確認

```bash
cd ~/auto-x

# CLI コマンドで確認（[note] タグで種別表示）
npm run history

# JSON ファイルを直接確認
cat data/history.json
```

### 設定を変更したい場合

#### ローカルで変更 → VM に反映

```bash
# ローカルで config.json や src/ を編集後
git add -A && git commit -m "変更内容" && git push

# VM の SSH で実行
cd ~/auto-x
git pull
pm2 restart auto-x
```

#### VM 上で直接変更

```bash
cd ~/auto-x

# config.json を編集
cat > config.json << 'CONFIGEOF'
変更後の内容を貼り付け
CONFIGEOF

# 反映
pm2 restart auto-x

# ログで確認
tail -20 logs/combined.log
```

### note 記事を追加・変更したい場合

```bash
cd ~/auto-x

# notes.csv を編集
cat > notes.csv << 'CSVEOF'
title,url
新しい記事タイトル,https://note.com/yourname/n/xxxx
CSVEOF

# 読み込みテスト
npx tsx src/cli.ts notes

# 反映（PM2 再起動で新しい CSV を読み込む）
pm2 restart auto-x
```

### .env を変更したい場合

```bash
cd ~/auto-x

cat > .env << 'EOF'
OPENAI_API_KEY=新しいキー
X_APP_KEY=新しいキー
X_APP_SECRET=新しいキー
X_ACCESS_TOKEN=新しいキー
X_ACCESS_SECRET=新しいキー
EOF

pm2 restart auto-x
```

### VM が再起動した場合

`pm2 startup` を設定済みであれば、自動で auto-x が起動します。手動で確認する場合：

```bash
pm2 status
# online になっていればOK

# もし停止していたら
pm2 start ecosystem.config.cjs
pm2 save
```

---

## 動作の仕組み

```
毎日 0:00（指定タイムゾーン）
  └─ 指定した時間帯内でランダムな投稿時刻を決定
      例: 7:00-23:00 の間で 10 回分 → 8:14, 9:47, 11:03, ...

各投稿時刻になったら:
  1. notes.csv があるか確認
  2. 70% の確率で note 紹介ポスト / 30% で通常ポスト を選択
     （notes.csv がなければ 100% 通常ポスト）
  3. 過去の投稿履歴を取得（重複回避用）
  4. OpenAI API でコンテンツを生成
  5. 140 文字未満チェック（超えたら再生成 → それでもダメなら強制切り詰め）
  6. note ポストの場合、本文の後に改行 + URL を付与
  7. X API (twitter-api-v2) で投稿
  8. 結果を data/history.json に記録（投稿タイプも記録）
```

---

## ディレクトリ構成

```
auto-x/
├── src/
│   ├── cli.ts              # CLI コマンド定義
│   ├── index.ts            # エントリーポイント（スケジューラー起動・70/30振り分け）
│   ├── config/             # 設定読み込み・バリデーション
│   ├── generator/          # OpenAI コンテンツ生成（通常 + note 用プロンプト）
│   ├── poster/             # X API 投稿
│   ├── scheduler/          # ランダム時間スケジューラー
│   ├── history/            # 投稿履歴管理
│   ├── notes/              # note 記事 CSV 読み込み（NoteLoader）
│   └── logger/             # ログ管理
├── config.json             # 設定ファイル（要作成）
├── .env                    # API キー（要作成）
├── notes.csv               # note 記事リスト（任意。あれば note 投稿が有効化）
├── notes.example.csv       # notes.csv のサンプル
├── data/history.json       # 投稿履歴（自動生成）
├── logs/                   # ログファイル（自動生成）
└── ecosystem.config.cjs    # PM2 設定
```

---

## 注意事項

- X API Free Tier の上限は **月 500 投稿**。`postsPerDay: 10` の場合、月 300 投稿程度になるので余裕あり
- `.env`、`config.json`、`notes.csv` は `.gitignore` に含まれているため、Git にコミットされません
- API キーは絶対に公開リポジトリにプッシュしないでください
- GCP の無料枠は **us-west1 / us-central1 / us-east1** リージョンのみ対象です
- VM のタイムゾーンは UTC ですが、スケジューラーは `config.json` の `timezone` に従って正しく動作します
- note ポストの 140 文字制限は本文のみに適用されます（URL は文字数にカウントしません）

## ライセンス

ISC
