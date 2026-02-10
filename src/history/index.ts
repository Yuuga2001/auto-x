import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { PostRecord } from '../config/types.js';

interface HistoryData {
  posts: PostRecord[];
}

export class PostHistory {
  private filePath: string;
  private data: HistoryData;

  constructor(dataDir: string = './data') {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, 'history.json');
    this.data = this.load();
  }

  private load(): HistoryData {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return { posts: [] };
    }
  }

  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  addPost(record: Omit<PostRecord, 'id' | 'timestamp'>): PostRecord {
    const post: PostRecord = {
      ...record,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.data.posts.push(post);
    this.save();
    return post;
  }

  getRecentPosts(count: number = 20): string[] {
    return this.data.posts
      .filter((p) => p.success)
      .slice(-count)
      .map((p) => p.content);
  }

  getRecentRecords(count: number = 10): PostRecord[] {
    return this.data.posts.slice(-count);
  }

  getTodayPostCount(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.data.posts.filter(
      (p) => p.timestamp.startsWith(today!) && p.success,
    ).length;
  }
}
