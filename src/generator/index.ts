import OpenAI from 'openai';
import type { PersonaConfig, ThemeConfig } from '../config/types.js';
import { buildSystemPrompt, buildUserPrompt, buildNoteSystemPrompt, buildNoteUserPrompt } from './prompts.js';
import { logger } from '../logger/index.js';

export interface GeneratorConfig {
  persona: PersonaConfig;
  theme: ThemeConfig;
  openai: { apiKey: string; model: string };
  customPrompt?: string;
}

export class ContentGenerator {
  private client: OpenAI;
  private config: GeneratorConfig;

  constructor(config: GeneratorConfig) {
    this.client = new OpenAI({ apiKey: config.openai.apiKey });
    this.config = config;
  }

  async generate(recentPosts: string[]): Promise<string> {
    const systemPrompt = buildSystemPrompt(this.config.persona);
    const userPrompt = buildUserPrompt(
      this.config.theme,
      this.config.customPrompt,
      recentPosts,
    );

    logger.debug('プロンプト生成完了', { systemPrompt, userPrompt });

    const response = await this.client.chat.completions.create({
      model: this.config.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0.9,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('OpenAI API からコンテンツを取得できませんでした');
    }

    // 140文字未満を強制
    if (content.length >= 140) {
      logger.warn('生成コンテンツが140文字以上、再生成を試行', {
        original: content.length,
      });

      // 再生成を1回試行
      const retry = await this.client.chat.completions.create({
        model: this.config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: content },
          {
            role: 'user',
            content: `この投稿は${content.length}文字です。140文字未満（139文字以下）に短縮してください。内容の本質は保ちつつ、より短く凝縮してください。投稿テキストのみを出力してください。`,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const shortened = retry.choices[0]?.message?.content?.trim();
      if (shortened && shortened.length < 140) {
        logger.info('再生成で140文字未満に短縮成功', { length: shortened.length });
        return shortened;
      }

      // それでもダメなら強制切り詰め
      const fallback = shortened || content;
      logger.warn('強制切り詰め実行', { original: fallback.length });
      return fallback.substring(0, 136) + '...';
    }

    return content;
  }

  async generateNotePost(title: string, recentPosts: string[]): Promise<string> {
    const systemPrompt = buildNoteSystemPrompt(this.config.persona);
    const userPrompt = buildNoteUserPrompt(title, recentPosts);

    logger.debug('note用プロンプト生成完了', { title });

    const response = await this.client.chat.completions.create({
      model: this.config.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0.9,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('OpenAI API からnote紹介文を取得できませんでした');
    }

    // 140文字未満を強制（URLは別途付与するのでここではURL無しの文章のみ）
    if (content.length >= 140) {
      logger.warn('note紹介文が140文字以上、再生成を試行', {
        original: content.length,
      });

      const retry = await this.client.chat.completions.create({
        model: this.config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: content },
          {
            role: 'user',
            content: `この投稿は${content.length}文字です。140文字未満（139文字以下）に短縮してください。内容の本質は保ちつつ、より短く凝縮してください。投稿テキストのみを出力してください。`,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const shortened = retry.choices[0]?.message?.content?.trim();
      if (shortened && shortened.length < 140) {
        logger.info('再生成で140文字未満に短縮成功', { length: shortened.length });
        return shortened;
      }

      const fallback = shortened || content;
      logger.warn('強制切り詰め実行', { original: fallback.length });
      return fallback.substring(0, 136) + '...';
    }

    return content;
  }
}
