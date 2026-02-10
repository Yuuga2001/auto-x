import { loadConfig } from './config/index.js';
import { ContentGenerator } from './generator/index.js';
import { XPoster } from './poster/index.js';
import { PostScheduler } from './scheduler/index.js';
import { PostHistory } from './history/index.js';
import { logger } from './logger/index.js';

const config = loadConfig();
const generator = new ContentGenerator(config);
const poster = new XPoster(config);
const history = new PostHistory();

async function executePost(): Promise<void> {
  logger.info('投稿プロセス開始');

  const recentPosts = history.getRecentPosts(20);

  // 1. コンテンツ生成
  logger.info('コンテンツ生成中...');
  const content = await generator.generate(recentPosts);
  logger.info('生成されたコンテンツ', { content });

  // 2. X に投稿
  const result = await poster.post(content);

  // 3. 履歴に記録
  const record = history.addPost({
    content,
    tweetId: result.tweetId,
    success: result.success,
    error: result.error,
  });

  if (result.success) {
    logger.info('投稿成功', {
      tweetId: result.tweetId,
      recordId: record.id,
    });
  } else {
    logger.error('投稿失敗', { error: result.error });
  }
}

// スケジューラー起動
const scheduler = new PostScheduler(config.schedule, executePost);
scheduler.start();

logger.info('auto-x 起動完了', {
  persona: config.persona.name,
  model: config.openai.model,
});

// グレースフルシャットダウン
const shutdown = () => {
  logger.info('シャットダウン中...');
  scheduler.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
