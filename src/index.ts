import { loadConfig } from './config/index.js';
import { ContentGenerator } from './generator/index.js';
import { XPoster } from './poster/index.js';
import { PostScheduler } from './scheduler/index.js';
import { PostHistory } from './history/index.js';
import { NoteLoader } from './notes/index.js';
import { logger } from './logger/index.js';

const config = loadConfig();
const generator = new ContentGenerator(config);
const poster = new XPoster(config);
const history = new PostHistory();
const noteLoader = new NoteLoader();

const NOTE_RATIO = 0.7; // note記事ポストの比率

async function executePost(): Promise<void> {
  logger.info('投稿プロセス開始');

  const recentPosts = history.getRecentPosts(20);
  const hasNotes = noteLoader.exists() && noteLoader.count() > 0;
  const isNotePost = hasNotes && Math.random() < NOTE_RATIO;

  if (isNotePost) {
    await executeNotePost(recentPosts);
  } else {
    await executeNormalPost(recentPosts);
  }
}

async function executeNormalPost(recentPosts: string[]): Promise<void> {
  logger.info('通常ポスト生成中...');
  const content = await generator.generate(recentPosts);
  logger.info('生成されたコンテンツ', { type: 'normal', content });

  const result = await poster.post(content);

  const record = history.addPost({
    content,
    tweetId: result.tweetId,
    success: result.success,
    error: result.error,
    type: 'normal',
  });

  if (result.success) {
    logger.info('通常ポスト投稿成功', { tweetId: result.tweetId, recordId: record.id });
  } else {
    logger.error('通常ポスト投稿失敗', { error: result.error });
  }
}

async function executeNotePost(recentPosts: string[]): Promise<void> {
  const article = noteLoader.pickRandom();
  if (!article) {
    logger.warn('note記事の選択に失敗。通常ポストにフォールバック');
    await executeNormalPost(recentPosts);
    return;
  }

  logger.info('noteポスト生成中...', { title: article.title });
  const text = await generator.generateNotePost(article.title, recentPosts);

  // 文章 + 改行 + 半角スペース + URL
  const fullContent = `${text}\n\n ${article.url}`;
  logger.info('生成されたコンテンツ', { type: 'note', text, url: article.url });

  const result = await poster.post(fullContent);

  const record = history.addPost({
    content: fullContent,
    tweetId: result.tweetId,
    success: result.success,
    error: result.error,
    type: 'note',
    noteUrl: article.url,
  });

  if (result.success) {
    logger.info('noteポスト投稿成功', { tweetId: result.tweetId, recordId: record.id, title: article.title });
  } else {
    logger.error('noteポスト投稿失敗', { error: result.error });
  }
}

// スケジューラー起動
const scheduler = new PostScheduler(config.schedule, executePost);
scheduler.start();

const noteCount = noteLoader.exists() ? noteLoader.count() : 0;
logger.info('auto-x 起動完了', {
  persona: config.persona.name,
  model: config.openai.model,
  noteArticles: noteCount,
  noteRatio: noteCount > 0 ? `${NOTE_RATIO * 100}%` : '0%（notes.csvなし）',
});

// グレースフルシャットダウン
const shutdown = () => {
  logger.info('シャットダウン中...');
  scheduler.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
