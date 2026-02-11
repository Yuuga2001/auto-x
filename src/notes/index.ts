import fs from 'fs';
import path from 'path';
import { logger } from '../logger/index.js';

export interface NoteArticle {
  title: string;
  url: string;
}

export class NoteLoader {
  private filePath: string;
  private articles: NoteArticle[] = [];
  private loaded = false;

  constructor(filePath: string = './notes.csv') {
    this.filePath = path.resolve(process.cwd(), filePath);
  }

  exists(): boolean {
    return fs.existsSync(this.filePath);
  }

  load(): NoteArticle[] {
    if (this.loaded) return this.articles;

    if (!this.exists()) {
      logger.info('notes.csv が見つかりません。通常ポストのみで動作します');
      this.articles = [];
      this.loaded = true;
      return this.articles;
    }

    const raw = fs.readFileSync(this.filePath, 'utf-8');
    const lines = raw.split('\n').filter((line) => line.trim() !== '');

    // ヘッダー行をスキップ
    const dataLines = lines[0]?.startsWith('title') ? lines.slice(1) : lines;

    this.articles = dataLines
      .map((line) => {
        // 最後のカンマ区切りをURLとして扱う（タイトルにカンマが含まれる場合に対応）
        const lastCommaIndex = line.lastIndexOf(',');
        if (lastCommaIndex === -1) return null;

        const title = line.substring(0, lastCommaIndex).trim();
        const url = line.substring(lastCommaIndex + 1).trim();

        if (!title || !url) return null;
        return { title, url };
      })
      .filter((article): article is NoteArticle => article !== null);

    this.loaded = true;
    logger.info(`note記事を ${this.articles.length} 件読み込みました`);
    return this.articles;
  }

  pickRandom(): NoteArticle | null {
    const articles = this.load();
    if (articles.length === 0) return null;
    return articles[Math.floor(Math.random() * articles.length)]!;
  }

  count(): number {
    return this.load().length;
  }
}
