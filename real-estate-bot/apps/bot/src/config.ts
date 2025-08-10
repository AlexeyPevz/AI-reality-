import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Bot token
  botToken: process.env.BOT_TOKEN!,
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/realestate',
  
  // Redis for sessions
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Mini App URL
  miniAppUrl: process.env.MINI_APP_URL || 'https://your-app.vercel.app',
  
  // API URL
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  
  // LLM settings
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  llmProvider: process.env.LLM_PROVIDER || 'openai',
  llmModel: process.env.LLM_MODEL || 'gpt-4-turbo-preview',
  
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Validate required config
if (!config.botToken) {
  throw new Error('BOT_TOKEN is required in environment variables');
}