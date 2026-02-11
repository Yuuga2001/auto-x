import { Command } from 'commander';
import { loadConfig, loadConfigForDryRun } from './config/index.js';
import { ContentGenerator } from './generator/index.js';
import { XPoster } from './poster/index.js';
import { PostHistory } from './history/index.js';
import { NoteLoader } from './notes/index.js';

const program = new Command();

program
  .name('auto-x')
  .description('X (Twitter) 自動投稿ツール')
  .version('1.0.0');

// 常駐起動
program
  .command('start')
  .description('スケジューラーを起動して常駐')
  .action(async () => {
    await import('./index.js');
  });

// 手動投稿
program
  .command('post')
  .description('今すぐ1件投稿')
  .option('--dry-run', 'コンテンツ生成のみ（投稿しない）')
  .option('--note', 'note記事ポストを強制（テスト用）')
  .option('--normal', '通常ポストを強制（テスト用）')
  .action(async (options: { dryRun?: boolean; note?: boolean; normal?: boolean }) => {
    const history = new PostHistory();
    const recentPosts = history.getRecentPosts(20);

    if (options.dryRun) {
      const config = loadConfigForDryRun();
      const generator = new ContentGenerator(config);
      const NOTE_RATIO = 0.7;

      // --note: 強制note / --normal: 強制通常 / 指定なし: 70/30自動振り分け
      const noteLoader = new NoteLoader();
      const hasNotes = noteLoader.exists() && noteLoader.count() > 0;
      const isNotePost = options.note
        ? true
        : options.normal
          ? false
          : hasNotes && Math.random() < NOTE_RATIO;

      if (isNotePost) {
        if (!hasNotes) {
          console.error('notes.csv が見つからないか、記事がありません。');
          process.exit(1);
        }
        const article = noteLoader.pickRandom()!;

        console.log(`[note選択] note記事ポスト生成中... [${article.title}]`);
        const text = await generator.generateNotePost(article.title, recentPosts);
        const fullContent = `${text}\n\n ${article.url}`;

        console.log('\n--- 生成されたコンテンツ (note) ---');
        console.log(fullContent);
        console.log(`--- 文章文字数: ${text.length} / 全体文字数: ${fullContent.length} ---\n`);
      } else {
        console.log(`[通常選択] 通常ポスト生成中...`);
        const content = await generator.generate(recentPosts);

        console.log('\n--- 生成されたコンテンツ ---');
        console.log(content);
        console.log(`--- 文字数: ${content.length} ---\n`);
      }
    } else {
      const config = loadConfig();
      const generator = new ContentGenerator(config);
      const poster = new XPoster(config);
      const NOTE_RATIO = 0.7;

      let content: string;
      let type: 'normal' | 'note' = 'normal';
      let noteUrl: string | undefined;

      // --note: 強制note / --normal: 強制通常 / 指定なし: 70/30自動振り分け
      const noteLoader = new NoteLoader();
      const hasNotes = noteLoader.exists() && noteLoader.count() > 0;
      const isNotePost = options.note
        ? true
        : options.normal
          ? false
          : hasNotes && Math.random() < NOTE_RATIO;

      if (isNotePost) {
        if (!hasNotes) {
          console.error('notes.csv が見つからないか、記事がありません。');
          process.exit(1);
        }
        const article = noteLoader.pickRandom()!;

        console.log(`[note選択] note記事ポスト生成中... [${article.title}]`);
        const text = await generator.generateNotePost(article.title, recentPosts);
        content = `${text}\n\n ${article.url}`;
        type = 'note';
        noteUrl = article.url;

        console.log('\n--- 生成されたコンテンツ (note) ---');
        console.log(content);
        console.log(`--- 文章文字数: ${text.length} ---\n`);
      } else {
        console.log('[通常選択] 通常ポスト生成中...');
        content = await generator.generate(recentPosts);

        console.log('\n--- 生成されたコンテンツ ---');
        console.log(content);
        console.log(`--- 文字数: ${content.length} ---\n`);
      }

      console.log('X に投稿中...');
      const result = await poster.post(content);

      if (result.success) {
        console.log(`投稿成功! Tweet ID: ${result.tweetId}`);
        history.addPost({
          content,
          tweetId: result.tweetId,
          success: true,
          type,
          noteUrl,
        });
      } else {
        console.error(`投稿失敗: ${result.error}`);
        history.addPost({
          content,
          success: false,
          error: result.error,
          type,
          noteUrl,
        });
      }
    }
  });

// note記事リスト確認
program
  .command('notes')
  .description('note記事リスト（notes.csv）の読み込みテスト')
  .action(() => {
    const noteLoader = new NoteLoader();
    if (!noteLoader.exists()) {
      console.log('notes.csv が見つかりません。');
      console.log('notes.example.csv を参考に notes.csv を作成してください。');
      return;
    }

    const articles = noteLoader.load();
    console.log(`note記事: ${articles.length} 件\n`);
    for (const [i, article] of articles.entries()) {
      console.log(`${i + 1}. ${article.title}`);
      console.log(`   ${article.url}`);
    }
  });

// 設定確認
program
  .command('config')
  .description('現在の設定を表示')
  .action(() => {
    const config = loadConfig();
    const noteLoader = new NoteLoader();
    console.log(
      JSON.stringify(
        {
          persona: config.persona,
          theme: config.theme,
          schedule: config.schedule,
          model: config.openai.model,
          noteArticles: noteLoader.exists() ? noteLoader.count() : 0,
        },
        null,
        2,
      ),
    );
  });

// 履歴確認
program
  .command('history')
  .description('投稿履歴を表示')
  .option('-n, --count <number>', '表示件数', '10')
  .action((options: { count: string }) => {
    const history = new PostHistory();
    const records = history.getRecentRecords(parseInt(options.count));

    if (records.length === 0) {
      console.log('投稿履歴はまだありません。');
      return;
    }

    for (const record of records) {
      const status = record.success ? '成功' : '失敗';
      const type = record.type === 'note' ? ' [note]' : '';
      const date = new Date(record.timestamp).toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
      });
      console.log(`[${status}]${type} ${date}`);
      console.log(`  ${record.content}`);
      if (record.tweetId) {
        console.log(`  Tweet ID: ${record.tweetId}`);
      }
      if (record.error) {
        console.log(`  エラー: ${record.error}`);
      }
      console.log('');
    }
  });

// API接続テスト
program
  .command('verify')
  .description('X API の接続テスト')
  .action(async () => {
    const config = loadConfig();
    const poster = new XPoster(config);

    console.log('X API 接続テスト中...');
    const ok = await poster.verify();
    if (ok) {
      console.log('接続成功! API認証が正しく設定されています。');
    } else {
      console.error('接続失敗。.env の X API キーを確認してください。');
      process.exit(1);
    }
  });

program.parse();
