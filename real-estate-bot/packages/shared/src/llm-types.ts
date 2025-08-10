// LLM Provider types
export type LLMProvider = 'openai' | 'anthropic' | 'yandexgpt';

// LLM Model types
export type LLMModel = 
  | 'gpt-4-turbo-preview'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  | 'claude-3-opus'
  | 'claude-3-sonnet' 
  | 'claude-3-haiku'
  | 'yandexgpt-latest';

// Agent roles
export type AgentRole = 
  | 'interviewer'        // Ведет диалог с пользователем
  | 'analyzer'          // Анализирует предпочтения
  | 'explainer'         // Объясняет выбор
  | 'consultant'        // Консультирует по рынку
  | 'negotiator';       // Помогает с торгом

// Conversation context
export interface ConversationContext {
  userId: string;
  role: AgentRole;
  history: Message[];
  preferences?: any;
  currentListing?: any;
  marketData?: any;
}

// Message types
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

// Agent response
export interface AgentResponse {
  message: string;
  suggestions?: string[];
  nextAction?: string;
  confidence?: number;
  reasoning?: string;
}

// Prompt template
export interface PromptTemplate {
  role: AgentRole;
  systemPrompt: string;
  userPromptTemplate: string;
  examples?: Array<{
    user: string;
    assistant: string;
  }>;
  constraints?: string[];
  outputFormat?: string;
}