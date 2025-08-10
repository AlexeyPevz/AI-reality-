import { ModelInfo, LLMModel, AgentRole } from '@real-estate-bot/shared';

export const MODELS: Record<LLMModel, ModelInfo> = {
  // OpenAI Models
  'openai/gpt-4-turbo-preview': {
    model: 'openai/gpt-4-turbo-preview',
    contextWindow: 128000,
    outputTokens: 4096,
    inputCost: 10,
    outputCost: 30,
    speed: 'medium',
    capabilities: {
      coding: 9,
      reasoning: 9,
      creativity: 8,
      multilingual: 9,
      factual: 9
    },
    recommended_for: ['analyzer', 'consultant', 'negotiator']
  },
  
  'openai/gpt-4': {
    model: 'openai/gpt-4',
    contextWindow: 8192,
    outputTokens: 4096,
    inputCost: 30,
    outputCost: 60,
    speed: 'slow',
    capabilities: {
      coding: 9,
      reasoning: 10,
      creativity: 8,
      multilingual: 9,
      factual: 9
    },
    recommended_for: ['analyzer', 'consultant']
  },
  
  'openai/gpt-3.5-turbo': {
    model: 'openai/gpt-3.5-turbo',
    contextWindow: 16384,
    outputTokens: 4096,
    inputCost: 0.5,
    outputCost: 1.5,
    speed: 'fast',
    capabilities: {
      coding: 7,
      reasoning: 7,
      creativity: 7,
      multilingual: 8,
      factual: 7
    },
    recommended_for: ['interviewer', 'explainer']
  },

  'openai/gpt-4-32k': {
    model: 'openai/gpt-4-32k',
    contextWindow: 32768,
    outputTokens: 4096,
    inputCost: 60,
    outputCost: 120,
    speed: 'slow',
    capabilities: {
      coding: 9,
      reasoning: 10,
      creativity: 8,
      multilingual: 9,
      factual: 9
    },
    recommended_for: ['consultant']
  },

  // Anthropic Models
  'anthropic/claude-3-opus': {
    model: 'anthropic/claude-3-opus',
    contextWindow: 200000,
    outputTokens: 4096,
    inputCost: 15,
    outputCost: 75,
    speed: 'slow',
    capabilities: {
      coding: 10,
      reasoning: 10,
      creativity: 9,
      multilingual: 9,
      factual: 10
    },
    recommended_for: ['analyzer', 'consultant', 'negotiator']
  },

  'anthropic/claude-3-sonnet': {
    model: 'anthropic/claude-3-sonnet',
    contextWindow: 200000,
    outputTokens: 4096,
    inputCost: 3,
    outputCost: 15,
    speed: 'medium',
    capabilities: {
      coding: 9,
      reasoning: 9,
      creativity: 8,
      multilingual: 8,
      factual: 9
    },
    recommended_for: ['interviewer', 'explainer', 'analyzer']
  },

  'anthropic/claude-3-haiku': {
    model: 'anthropic/claude-3-haiku',
    contextWindow: 200000,
    outputTokens: 4096,
    inputCost: 0.25,
    outputCost: 1.25,
    speed: 'fast',
    capabilities: {
      coding: 8,
      reasoning: 8,
      creativity: 7,
      multilingual: 8,
      factual: 8
    },
    recommended_for: ['interviewer', 'explainer']
  },

  'anthropic/claude-2.1': {
    model: 'anthropic/claude-2.1',
    contextWindow: 200000,
    outputTokens: 4096,
    inputCost: 8,
    outputCost: 24,
    speed: 'medium',
    capabilities: {
      coding: 8,
      reasoning: 8,
      creativity: 7,
      multilingual: 8,
      factual: 8
    },
    recommended_for: ['consultant']
  },

  'anthropic/claude-instant-1': {
    model: 'anthropic/claude-instant-1',
    contextWindow: 100000,
    outputTokens: 4096,
    inputCost: 0.8,
    outputCost: 2.4,
    speed: 'fast',
    capabilities: {
      coding: 7,
      reasoning: 7,
      creativity: 6,
      multilingual: 7,
      factual: 7
    },
    recommended_for: ['interviewer']
  },

  // Google Models
  'google/gemini-pro': {
    model: 'google/gemini-pro',
    contextWindow: 32768,
    outputTokens: 2048,
    inputCost: 0.5,
    outputCost: 1.5,
    speed: 'fast',
    capabilities: {
      coding: 8,
      reasoning: 8,
      creativity: 8,
      multilingual: 9,
      factual: 8
    },
    recommended_for: ['interviewer', 'explainer']
  },

  'google/gemini-pro-1.5': {
    model: 'google/gemini-pro-1.5',
    contextWindow: 1000000,
    outputTokens: 8192,
    inputCost: 2.5,
    outputCost: 7.5,
    speed: 'medium',
    capabilities: {
      coding: 9,
      reasoning: 9,
      creativity: 8,
      multilingual: 9,
      factual: 9
    },
    recommended_for: ['analyzer', 'consultant']
  },

  'google/palm-2-chat-bison': {
    model: 'google/palm-2-chat-bison',
    contextWindow: 8192,
    outputTokens: 1024,
    inputCost: 0.5,
    outputCost: 0.5,
    speed: 'fast',
    capabilities: {
      coding: 7,
      reasoning: 7,
      creativity: 7,
      multilingual: 8,
      factual: 7
    },
    recommended_for: ['interviewer']
  },

  // Meta Models
  'meta-llama/llama-3-70b-instruct': {
    model: 'meta-llama/llama-3-70b-instruct',
    contextWindow: 8192,
    outputTokens: 4096,
    inputCost: 0.8,
    outputCost: 0.8,
    speed: 'medium',
    capabilities: {
      coding: 8,
      reasoning: 8,
      creativity: 8,
      multilingual: 7,
      factual: 8
    },
    recommended_for: ['interviewer', 'explainer']
  },

  'meta-llama/llama-3-8b-instruct': {
    model: 'meta-llama/llama-3-8b-instruct',
    contextWindow: 8192,
    outputTokens: 4096,
    inputCost: 0.2,
    outputCost: 0.2,
    speed: 'fast',
    capabilities: {
      coding: 7,
      reasoning: 7,
      creativity: 7,
      multilingual: 6,
      factual: 7
    },
    recommended_for: ['interviewer']
  },

  'meta-llama/codellama-70b-instruct': {
    model: 'meta-llama/codellama-70b-instruct',
    contextWindow: 4096,
    outputTokens: 4096,
    inputCost: 0.8,
    outputCost: 0.8,
    speed: 'medium',
    capabilities: {
      coding: 10,
      reasoning: 8,
      creativity: 6,
      multilingual: 5,
      factual: 7
    },
    recommended_for: []
  },

  // Mistral Models
  'mistralai/mistral-medium': {
    model: 'mistralai/mistral-medium',
    contextWindow: 32768,
    outputTokens: 4096,
    inputCost: 2.7,
    outputCost: 8.1,
    speed: 'medium',
    capabilities: {
      coding: 8,
      reasoning: 8,
      creativity: 8,
      multilingual: 8,
      factual: 8
    },
    recommended_for: ['analyzer', 'explainer']
  },

  'mistralai/mixtral-8x7b-instruct': {
    model: 'mistralai/mixtral-8x7b-instruct',
    contextWindow: 32768,
    outputTokens: 4096,
    inputCost: 0.6,
    outputCost: 0.6,
    speed: 'fast',
    capabilities: {
      coding: 8,
      reasoning: 8,
      creativity: 7,
      multilingual: 8,
      factual: 8
    },
    recommended_for: ['interviewer', 'explainer']
  },

  'mistralai/mistral-7b-instruct': {
    model: 'mistralai/mistral-7b-instruct',
    contextWindow: 32768,
    outputTokens: 4096,
    inputCost: 0.2,
    outputCost: 0.2,
    speed: 'fast',
    capabilities: {
      coding: 7,
      reasoning: 7,
      creativity: 7,
      multilingual: 7,
      factual: 7
    },
    recommended_for: ['interviewer']
  },

  // Other Models
  'nousresearch/nous-hermes-2-mixtral-8x7b-dpo': {
    model: 'nousresearch/nous-hermes-2-mixtral-8x7b-dpo',
    contextWindow: 32768,
    outputTokens: 4096,
    inputCost: 0.3,
    outputCost: 0.3,
    speed: 'fast',
    capabilities: {
      coding: 8,
      reasoning: 9,
      creativity: 8,
      multilingual: 7,
      factual: 8
    },
    recommended_for: ['analyzer', 'explainer']
  },

  'cognitivecomputations/dolphin-mixtral-8x7b': {
    model: 'cognitivecomputations/dolphin-mixtral-8x7b',
    contextWindow: 32768,
    outputTokens: 4096,
    inputCost: 0.5,
    outputCost: 0.5,
    speed: 'fast',
    capabilities: {
      coding: 8,
      reasoning: 8,
      creativity: 9,
      multilingual: 7,
      factual: 7
    },
    recommended_for: ['interviewer', 'explainer']
  },

  'databricks/dbrx-instruct': {
    model: 'databricks/dbrx-instruct',
    contextWindow: 32768,
    outputTokens: 4096,
    inputCost: 0.6,
    outputCost: 0.6,
    speed: 'medium',
    capabilities: {
      coding: 9,
      reasoning: 8,
      creativity: 7,
      multilingual: 7,
      factual: 8
    },
    recommended_for: ['analyzer']
  },

  'cohere/command-r-plus': {
    model: 'cohere/command-r-plus',
    contextWindow: 128000,
    outputTokens: 4096,
    inputCost: 3,
    outputCost: 15,
    speed: 'medium',
    capabilities: {
      coding: 8,
      reasoning: 9,
      creativity: 8,
      multilingual: 9,
      factual: 9
    },
    recommended_for: ['consultant', 'analyzer']
  },

  'perplexity/llama-3-sonar-large-32k-online': {
    model: 'perplexity/llama-3-sonar-large-32k-online',
    contextWindow: 32768,
    outputTokens: 4096,
    inputCost: 1,
    outputCost: 1,
    speed: 'medium',
    capabilities: {
      coding: 7,
      reasoning: 8,
      creativity: 7,
      multilingual: 7,
      factual: 10 // Online search capability
    },
    recommended_for: ['consultant'] // Great for market data
  }
};

// Model selection strategy
export interface ModelSelectionCriteria {
  role: AgentRole;
  maxCost?: number; // per 1000 tokens
  minSpeed?: 'fast' | 'medium' | 'slow';
  minCapability?: keyof ModelInfo['capabilities'];
  preferRussian?: boolean;
}

export function selectOptimalModel(criteria: ModelSelectionCriteria): LLMModel {
  let candidates = Object.values(MODELS);

  // Filter by role recommendation
  candidates = candidates.filter(m => 
    m.recommended_for.includes(criteria.role)
  );

  // Filter by cost if specified
  if (criteria.maxCost) {
    candidates = candidates.filter(m => 
      (m.inputCost + m.outputCost) / 2 <= criteria.maxCost
    );
  }

  // Filter by speed
  if (criteria.minSpeed) {
    const speedOrder = { fast: 1, medium: 2, slow: 3 };
    candidates = candidates.filter(m =>
      speedOrder[m.speed] <= speedOrder[criteria.minSpeed!]
    );
  }

  // Filter by minimum capability
  if (criteria.minCapability) {
    candidates = candidates.filter(m =>
      m.capabilities[criteria.minCapability!] >= 7
    );
  }

  // Prefer multilingual models for Russian
  if (criteria.preferRussian) {
    candidates = candidates.filter(m => m.capabilities.multilingual >= 8);
  }

  // If no candidates left, return a default
  if (candidates.length === 0) {
    return 'anthropic/claude-3-haiku'; // Good balance
  }

  // Sort by overall score (capability average * speed factor / cost)
  candidates.sort((a, b) => {
    const capAvgA = Object.values(a.capabilities).reduce((s, v) => s + v, 0) / 5;
    const capAvgB = Object.values(b.capabilities).reduce((s, v) => s + v, 0) / 5;
    
    const speedScore = { fast: 3, medium: 2, slow: 1 };
    const costA = (a.inputCost + a.outputCost) / 2;
    const costB = (b.inputCost + b.outputCost) / 2;
    
    const scoreA = (capAvgA * speedScore[a.speed]) / Math.log(costA + 1);
    const scoreB = (capAvgB * speedScore[b.speed]) / Math.log(costB + 1);
    
    return scoreB - scoreA;
  });

  return candidates[0].model;
}

// Preset configurations for different scenarios
export const MODEL_PRESETS = {
  // Maximum quality, cost no object
  premium: {
    interviewer: 'anthropic/claude-3-opus' as LLMModel,
    analyzer: 'openai/gpt-4-turbo-preview' as LLMModel,
    explainer: 'anthropic/claude-3-sonnet' as LLMModel,
    consultant: 'anthropic/claude-3-opus' as LLMModel,
    negotiator: 'openai/gpt-4-turbo-preview' as LLMModel
  },
  
  // Good balance of quality and cost
  balanced: {
    interviewer: 'anthropic/claude-3-haiku' as LLMModel,
    analyzer: 'anthropic/claude-3-sonnet' as LLMModel,
    explainer: 'mistralai/mixtral-8x7b-instruct' as LLMModel,
    consultant: 'cohere/command-r-plus' as LLMModel,
    negotiator: 'anthropic/claude-3-sonnet' as LLMModel
  },
  
  // Minimum cost, acceptable quality
  economy: {
    interviewer: 'mistralai/mistral-7b-instruct' as LLMModel,
    analyzer: 'nousresearch/nous-hermes-2-mixtral-8x7b-dpo' as LLMModel,
    explainer: 'meta-llama/llama-3-8b-instruct' as LLMModel,
    consultant: 'google/gemini-pro' as LLMModel,
    negotiator: 'mistralai/mixtral-8x7b-instruct' as LLMModel
  },
  
  // Optimized for Russian language
  russian: {
    interviewer: 'anthropic/claude-3-haiku' as LLMModel,
    analyzer: 'google/gemini-pro-1.5' as LLMModel,
    explainer: 'anthropic/claude-3-haiku' as LLMModel,
    consultant: 'cohere/command-r-plus' as LLMModel,
    negotiator: 'openai/gpt-4-turbo-preview' as LLMModel
  }
};