import { z } from 'zod';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import type { AppConfig } from './types.js';

dotenv.config();

const ConfigSchema = z.object({
  persona: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    tone: z.string().min(1),
    interests: z.array(z.string()).min(1),
  }),
  theme: z.object({
    topics: z.array(z.string()).min(1),
    hashtags: z.array(z.string()).default([]),
    style: z.enum(['informative', 'casual', 'humorous', 'professional']).default('casual'),
  }),
  schedule: z.object({
    timezone: z.string().default('Asia/Tokyo'),
    postWindowStart: z.number().min(0).max(23).default(8),
    postWindowEnd: z.number().min(0).max(23).default(22),
    postsPerDay: z.number().min(1).max(10).default(1),
  }),
  openai: z.object({
    model: z.string().default('gpt-4o-mini'),
  }),
  customPrompt: z.string().optional(),
});

export function loadConfig(): AppConfig {
  const configPath = path.resolve(process.cwd(), 'config.json');

  if (!fs.existsSync(configPath)) {
    console.error('config.json が見つかりません。config.example.json をコピーして config.json を作成してください。');
    process.exit(1);
  }

  const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const validated = ConfigSchema.parse(rawConfig);

  const requiredEnvVars = ['OPENAI_API_KEY', 'X_APP_KEY', 'X_APP_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'];
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`環境変数が不足しています: ${missing.join(', ')}`);
    console.error('.env.example を参考に .env ファイルを作成してください。');
    process.exit(1);
  }

  return {
    persona: validated.persona,
    theme: validated.theme,
    schedule: validated.schedule,
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: validated.openai.model,
    },
    xApi: {
      official: {
        appKey: process.env.X_APP_KEY!,
        appSecret: process.env.X_APP_SECRET!,
        accessToken: process.env.X_ACCESS_TOKEN!,
        accessSecret: process.env.X_ACCESS_SECRET!,
      },
    },
    customPrompt: validated.customPrompt,
  };
}

/**
 * dry-run用: X APIキーの検証をスキップして設定を読み込む
 */
export function loadConfigForDryRun(): Omit<AppConfig, 'xApi'> & { xApi?: AppConfig['xApi'] } {
  const configPath = path.resolve(process.cwd(), 'config.json');

  if (!fs.existsSync(configPath)) {
    console.error('config.json が見つかりません。config.example.json をコピーして config.json を作成してください。');
    process.exit(1);
  }

  const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const validated = ConfigSchema.parse(rawConfig);

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY が設定されていません。');
    process.exit(1);
  }

  return {
    persona: validated.persona,
    theme: validated.theme,
    schedule: validated.schedule,
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: validated.openai.model,
    },
    customPrompt: validated.customPrompt,
  };
}
