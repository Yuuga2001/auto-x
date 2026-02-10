import { OfficialPoster } from './official.js';
import type { AppConfig, PostResult } from '../config/types.js';
import { logger } from '../logger/index.js';

export class XPoster {
  private poster: OfficialPoster;

  constructor(config: AppConfig) {
    this.poster = new OfficialPoster(config.xApi.official);
  }

  async post(content: string): Promise<PostResult> {
    logger.info('X に投稿中...', { contentLength: content.length });
    return this.poster.post(content);
  }

  async verify(): Promise<boolean> {
    return this.poster.verify();
  }
}
