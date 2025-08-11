// LLM Provider types
export type LLMProvider = 'openrouter';

// LLM Model types via OpenRouter
export type LLMModel = 
  // OpenAI Models
  | 'openai/gpt-4-turbo-preview'
  | 'openai/gpt-4'
  | 'openai/gpt-3.5-turbo'
  | 'openai/gpt-4-32k'
  // Anthropic Models  
  | 'anthropic/claude-3-opus'
  | 'anthropic/claude-3-sonnet'
  | 'anthropic/claude-3-haiku'
  | 'anthropic/claude-2.1'
  | 'anthropic/claude-instant-1'
  // Google Models
  | 'google/gemini-pro'
  | 'google/gemini-pro-1.5'
  | 'google/palm-2-chat-bison'
  // Meta Models
  | 'meta-llama/llama-3-70b-instruct'
  | 'meta-llama/llama-3-8b-instruct'
  | 'meta-llama/codellama-70b-instruct'
  // Mistral Models
  | 'mistralai/mistral-medium'
  | 'mistralai/mixtral-8x7b-instruct'
  | 'mistralai/mistral-7b-instruct'
  // Other Strong Models
  | 'nousresearch/nous-hermes-2-mixtral-8x7b-dpo'
  | 'cognitivecomputations/dolphin-mixtral-8x7b'
  | 'databricks/dbrx-instruct'
  | 'cohere/command-r-plus'
  | 'perplexity/llama-3-sonar-large-32k-online';

// Model capabilities and pricing
export interface ModelInfo {
  model: LLMModel;
  contextWindow: number;
  outputTokens: number;
  inputCost: number; // per 1M tokens
  outputCost: number; // per 1M tokens
  speed: 'fast' | 'medium' | 'slow';
  capabilities: {
    coding: number; // 0-10
    reasoning: number; // 0-10
    creativity: number; // 0-10
    multilingual: number; // 0-10
    factual: number; // 0-10
  };
  recommended_for: AgentRole[];
}

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