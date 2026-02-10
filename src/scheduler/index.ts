import { schedule as cronSchedule, type ScheduledTask } from 'node-cron';
import type { ScheduleConfig } from '../config/types.js';
import { logger } from '../logger/index.js';

export class PostScheduler {
  private config: ScheduleConfig;
  private dailyCron: ScheduledTask | null = null;
  private postTimers: ReturnType<typeof setTimeout>[] = [];
  private onPost: () => Promise<void>;

  constructor(config: ScheduleConfig, onPost: () => Promise<void>) {
    this.config = config;
    this.onPost = onPost;
  }

  start(): void {
    // 毎日0:00に「今日の投稿時間」をランダム決定
    this.dailyCron = cronSchedule(
      '0 0 * * *',
      () => {
        this.scheduleToday();
      },
      { timezone: this.config.timezone },
    );

    // 起動時にもスケジュール
    this.scheduleToday();

    logger.info('スケジューラー開始', {
      timezone: this.config.timezone,
      window: `${this.config.postWindowStart}:00 - ${this.config.postWindowEnd}:00`,
      postsPerDay: this.config.postsPerDay,
    });
  }

  stop(): void {
    this.dailyCron?.stop();
    for (const timer of this.postTimers) {
      clearTimeout(timer);
    }
    this.postTimers = [];
    logger.info('スケジューラー停止');
  }

  private scheduleToday(): void {
    // 既存のタイマーをクリア
    for (const timer of this.postTimers) {
      clearTimeout(timer);
    }
    this.postTimers = [];

    const now = new Date();
    const times = this.generateRandomTimes(this.config.postsPerDay);

    for (const time of times) {
      const scheduledDate = new Date(now);
      scheduledDate.setHours(time.hour, time.minute, time.second, 0);

      // 既に過ぎた時間はスキップ
      if (scheduledDate <= now) {
        logger.info(
          `投稿時間 ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')} は既に過ぎたためスキップ`,
        );
        continue;
      }

      const delay = scheduledDate.getTime() - now.getTime();
      const timer = setTimeout(async () => {
        try {
          await this.onPost();
        } catch (error) {
          logger.error('投稿実行エラー', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }, delay);

      this.postTimers.push(timer);

      const timeStr = scheduledDate.toLocaleString('ja-JP', {
        timeZone: this.config.timezone,
        hour: '2-digit',
        minute: '2-digit',
      });
      logger.info(`本日の投稿予定: ${timeStr}`);
    }

    if (this.postTimers.length === 0) {
      logger.info('本日の投稿予定はありません（全て過ぎた時間帯）');
    }
  }

  private generateRandomTimes(
    count: number,
  ): { hour: number; minute: number; second: number }[] {
    const times: { hour: number; minute: number; second: number }[] = [];
    const { postWindowStart, postWindowEnd } = this.config;
    const windowMinutes = (postWindowEnd - postWindowStart) * 60;

    for (let i = 0; i < count; i++) {
      const randomMinutes = Math.floor(Math.random() * windowMinutes);
      const hour = postWindowStart + Math.floor(randomMinutes / 60);
      const minute = randomMinutes % 60;
      const second = Math.floor(Math.random() * 60);
      times.push({ hour, minute, second });
    }

    return times.sort(
      (a, b) =>
        a.hour * 3600 + a.minute * 60 + a.second -
        (b.hour * 3600 + b.minute * 60 + b.second),
    );
  }
}
