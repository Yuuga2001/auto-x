import { TwitterApi } from 'twitter-api-v2';
import type { OfficialApiCredentials, PostResult } from '../config/types.js';
import { logger } from '../logger/index.js';

export class OfficialPoster {
  private client: TwitterApi;

  constructor(credentials: OfficialApiCredentials) {
    this.client = new TwitterApi({
      appKey: credentials.appKey,
      appSecret: credentials.appSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
    });
  }

  async post(content: string): Promise<PostResult> {
    try {
      const result = await this.client.v2.tweet(content);
      logger.info('公式API投稿成功', { tweetId: result.data.id });
      return { success: true, tweetId: result.data.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('公式API投稿失敗', { error: message });
      return { success: false, error: message };
    }
  }

  async verify(): Promise<boolean> {
    try {
      const me = await this.client.v2.me();
      logger.info('API認証確認成功', { username: me.data.username });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('API認証確認失敗', { error: message });
      return false;
    }
  }
}
