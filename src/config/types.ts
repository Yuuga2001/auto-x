export interface PersonaConfig {
  name: string;
  description: string;
  tone: string;
  interests: string[];
}

export interface ThemeConfig {
  topics: string[];
  hashtags: string[];
  style: 'informative' | 'casual' | 'humorous' | 'professional';
}

export interface ScheduleConfig {
  timezone: string;
  postWindowStart: number;
  postWindowEnd: number;
  postsPerDay: number;
}

export interface OfficialApiCredentials {
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
}

export interface AppConfig {
  persona: PersonaConfig;
  theme: ThemeConfig;
  schedule: ScheduleConfig;
  openai: {
    apiKey: string;
    model: string;
  };
  xApi: {
    official: OfficialApiCredentials;
  };
  customPrompt?: string;
}

export interface PostRecord {
  id: string;
  content: string;
  tweetId?: string;
  timestamp: string;
  success: boolean;
  error?: string;
  type?: 'normal' | 'note';
  noteUrl?: string;
}

export interface PostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}
