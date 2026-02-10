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
    // 毎日0:00（指定タイムゾーン）に「今日の投稿時間」をランダム決定
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

  /**
   * 指定タイムゾーンでの現在時刻を取得
   */
  private getNowInTimezone(): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(new Date());
    const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0');

    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour: get('hour'),
      minute: get('minute'),
      second: get('second'),
    };
  }

  /**
   * 指定タイムゾーンの日時からUTCのDateオブジェクトを作成
   */
  private tzToUtcDate(year: number, month: number, day: number, hour: number, minute: number, second: number): Date {
    // 一旦その日時の文字列を作り、指定タイムゾーンとして解釈する
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;

    // タイムゾーンのオフセットを計算
    const tempDate = new Date(dateStr + 'Z'); // UTC として仮解釈
    const utcStr = tempDate.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
    const tzStr = tempDate.toLocaleString('en-US', { timeZone: this.config.timezone, hour12: false });

    const utcTime = new Date(utcStr).getTime();
    const tzTime = new Date(tzStr).getTime();
    const offset = tzTime - utcTime; // TZのオフセット（ミリ秒）

    return new Date(tempDate.getTime() - offset);
  }

  private scheduleToday(): void {
    // 既存のタイマーをクリア
    for (const timer of this.postTimers) {
      clearTimeout(timer);
    }
    this.postTimers = [];

    const nowUtc = new Date();
    const nowTz = this.getNowInTimezone();
    const times = this.generateRandomTimes(this.config.postsPerDay);

    logger.info(`現在のタイムゾーン時刻: ${nowTz.year}-${String(nowTz.month).padStart(2, '0')}-${String(nowTz.day).padStart(2, '0')} ${String(nowTz.hour).padStart(2, '0')}:${String(nowTz.minute).padStart(2, '0')}`);

    for (const time of times) {
      // 指定タイムゾーンの「今日の time.hour:time.minute:time.second」をUTC Dateに変換
      const scheduledUtc = this.tzToUtcDate(
        nowTz.year, nowTz.month, nowTz.day,
        time.hour, time.minute, time.second,
      );

      // 既に過ぎた時間はスキップ
      if (scheduledUtc <= nowUtc) {
        logger.info(
          `投稿時間 ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')} は既に過ぎたためスキップ`,
        );
        continue;
      }

      const delay = scheduledUtc.getTime() - nowUtc.getTime();
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

      logger.info(
        `本日の投稿予定: ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')} (${this.config.timezone})`,
      );
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
