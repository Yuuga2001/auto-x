import type { PersonaConfig, ThemeConfig } from '../config/types.js';

export function buildSystemPrompt(persona: PersonaConfig): string {
  return `あなたは以下の人物として X (Twitter) に投稿するコンテンツを生成します。

【ペルソナ】
名前: ${persona.name}
人物像: ${persona.description}
口調: ${persona.tone}
興味・関心: ${persona.interests.join('、')}

【ルール】
- 必ず280文字以内（日本語の場合は140文字以内を推奨）
- 自然な投稿に見えるようにする
- ハッシュタグは最大2個まで
- URLは含めない
- 「AIが生成した」等のメタ的な言及はしない
- 絵文字は適度に使用（0〜3個）
- 投稿テキストのみを出力し、余計な説明は不要`;
}

export function buildUserPrompt(
  theme: ThemeConfig,
  customPrompt: string | undefined,
  recentPosts: string[],
): string {
  const topic = theme.topics[Math.floor(Math.random() * theme.topics.length)];

  const hashtags =
    theme.hashtags.length > 0
      ? `\n使用可能なハッシュタグ: ${theme.hashtags.join(', ')}`
      : '';

  const recentContext =
    recentPosts.length > 0
      ? `\n\n【最近の投稿（重複を避けてください）】\n${recentPosts.slice(0, 10).map((p) => `- ${p}`).join('\n')}`
      : '';

  const custom = customPrompt ? `\n\n【追加指示】\n${customPrompt}` : '';

  return `以下のテーマで${theme.style}なスタイルの投稿を1つ生成してください。

テーマ: ${topic}${hashtags}${recentContext}${custom}`;
}
