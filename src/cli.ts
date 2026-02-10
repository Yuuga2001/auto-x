import { Command } from 'commander';
import { loadConfig, loadConfigForDryRun } from './config/index.js';
import { ContentGenerator } from './generator/index.js';
import { XPoster } from './poster/index.js';
import { PostHistory } from './history/index.js';

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
  .action(async (options: { dryRun?: boolean }) => {
    const history = new PostHistory();
    const recentPosts = history.getRecentPosts(20);

    if (options.dryRun) {
      const config = loadConfigForDryRun();
      const generator = new ContentGenerator(config);

      console.log('コンテンツ生成中...');
      const content = await generator.generate(recentPosts);

      console.log('\n--- 生成されたコンテンツ ---');
      console.log(content);
      console.log(`--- 文字数: ${content.length} ---\n`);
    } else {
      const config = loadConfig();
      const generator = new ContentGenerator(config);
      const poster = new XPoster(config);

      console.log('コンテンツ生成中...');
      const content = await generator.generate(recentPosts);
      console.log('\n--- 生成されたコンテンツ ---');
      console.log(content);
      console.log(`--- 文字数: ${content.length} ---\n`);

      console.log('X に投稿中...');
      const result = await poster.post(content);

      if (result.success) {
        console.log(`投稿成功! Tweet ID: ${result.tweetId}`);
        history.addPost({
          content,
          tweetId: result.tweetId,
          success: true,
        });
      } else {
        console.error(`投稿失敗: ${result.error}`);
        history.addPost({
          content,
          success: false,
          error: result.error,
        });
      }
    }
  });

// 設定確認
program
  .command('config')
  .description('現在の設定を表示')
  .action(() => {
    const config = loadConfig();
    console.log(
      JSON.stringify(
        {
          persona: config.persona,
          theme: config.theme,
          schedule: config.schedule,
          model: config.openai.model,
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
      const date = new Date(record.timestamp).toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
      });
      console.log(`[${status}] ${date}`);
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
