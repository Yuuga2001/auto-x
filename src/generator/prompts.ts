import type { PersonaConfig, ThemeConfig } from '../config/types.js';

export function buildSystemPrompt(persona: PersonaConfig): string {
  return `あなたは以下の人物として X (Twitter) に投稿するコンテンツを生成します。

【ペルソナ】
名前: ${persona.name}
人物像: ${persona.description}
口調: ${persona.tone}
興味・関心: ${persona.interests.join('、')}

【最重要ルール：文字数制限】
- 絶対に140文字未満にすること（139文字以下）。これは厳守。超えたら失格。
- 改行・スペース・絵文字・ハッシュタグも全て文字数に含む
- 短ければ短いほど良い。80〜130文字が理想

【文体ルール】
- 丁寧語（です・ます調）をベースにする。タメ口は絶対に使わない
- ただし堅すぎない。親しみやすく知的な印象にする
- 自然な投稿に見えるようにする

【その他ルール】
- ハッシュタグは最大1個まで。なくてもいい
- URLは含めない
- 「AIが生成した」等のメタ的な言及はしない
- 絵文字は適度に使用（0〜2個）
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
