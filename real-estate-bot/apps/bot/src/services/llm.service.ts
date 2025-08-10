import axios from 'axios';
import { 
  LLMProvider, 
  LLMModel, 
  AgentRole, 
  Message, 
  AgentResponse,
  ConversationContext,
  ModelInfo
} from '@real-estate-bot/shared';
import { PROMPTS } from '../prompts';
import { config } from '../config';
import { MODELS, MODEL_PRESETS, selectOptimalModel } from '../config/models';

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LLMService {
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';
  private modelPreset: keyof typeof MODEL_PRESETS;
  private customModels?: Partial<Record<AgentRole, LLMModel>>;

  constructor(
    modelPreset: keyof typeof MODEL_PRESETS = 'balanced',
    customModels?: Partial<Record<AgentRole, LLMModel>>
  ) {
    this.apiKey = config.openRouterApiKey || '';
    this.modelPreset = modelPreset;
    this.customModels = customModels;
    
    if (!this.apiKey) {
      console.warn('OpenRouter API key not configured, using mock responses');
    }
  }

  private getModelForRole(role: AgentRole): LLMModel {
    // Check custom models first
    if (this.customModels?.[role]) {
      return this.customModels[role];
    }
    
    // Use preset
    return MODEL_PRESETS[this.modelPreset][role];
  }

  async generateResponse(context: ConversationContext): Promise<AgentResponse> {
    const prompt = PROMPTS[context.role];
    if (!prompt) {
      throw new Error(`No prompt template for role: ${context.role}`);
    }

    // Select optimal model for this role
    const model = this.getModelForRole(context.role);
    const modelInfo = MODELS[model];

    // Build messages array
    const messages: Message[] = [
      {
        role: 'system',
        content: prompt.systemPrompt
      },
      ...context.history,
    ];

    // Add user prompt with context
    const userPrompt = this.fillTemplate(prompt.userPromptTemplate, {
      context: JSON.stringify(context.preferences || {}),
      userMessage: context.history[context.history.length - 1]?.content || '',
      preferences: JSON.stringify(context.preferences || {}),
      listing: JSON.stringify(context.currentListing || {}),
      marketData: JSON.stringify(context.marketData || {}),
    });

    messages.push({
      role: 'user',
      content: userPrompt
    });

    try {
      let response: string;
      
      if (this.apiKey) {
        response = await this.callOpenRouter(messages, model, modelInfo);
      } else {
        response = await this.generateMock(context);
      }

      // Parse response if JSON format expected
      if (prompt.outputFormat === 'JSON') {
        try {
          const parsed = JSON.parse(response);
          return {
            message: parsed.message || JSON.stringify(parsed),
            confidence: parsed.confidence,
            reasoning: parsed.reasoning,
          };
        } catch {
          return { message: response };
        }
      }

      return { message: response };
    } catch (error) {
      console.error('LLM generation error:', error);
      return this.getFallbackResponse(context.role);
    }
  }

  private async callOpenRouter(
    messages: Message[], 
    model: LLMModel,
    modelInfo: ModelInfo
  ): Promise<string> {
    try {
      const response = await axios.post<OpenRouterResponse>(
        `${this.baseURL}/chat/completions`,
        {
          model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          temperature: 0.7,
          max_tokens: Math.min(1000, modelInfo.outputTokens),
          // OpenRouter specific headers
          transforms: ["middle-out"], // Better handling of context
          route: "fallback" // Automatic fallback if model unavailable
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': config.appUrl || 'https://real-estate-bot.com',
            'X-Title': 'Real Estate Bot',
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('Empty response from OpenRouter');
      }

      // Log usage for cost tracking
      if (response.data.usage && config.isDevelopment) {
        const cost = this.calculateCost(
          response.data.usage.prompt_tokens,
          response.data.usage.completion_tokens,
          modelInfo
        );
        console.log(`[LLM] Model: ${model}, Tokens: ${response.data.usage.total_tokens}, Cost: $${cost.toFixed(4)}`);
      }

      return content;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.error('OpenRouter rate limit exceeded');
        throw new Error('Rate limit exceeded, please try again later');
      }
      
      if (error.response?.data?.error) {
        console.error('OpenRouter API error:', error.response.data.error);
        throw new Error(error.response.data.error.message || 'OpenRouter API error');
      }
      
      throw error;
    }
  }

  private calculateCost(inputTokens: number, outputTokens: number, modelInfo: ModelInfo): number {
    const inputCost = (inputTokens / 1_000_000) * modelInfo.inputCost;
    const outputCost = (outputTokens / 1_000_000) * modelInfo.outputCost;
    return inputCost + outputCost;
  }

  private async generateMock(context: ConversationContext): Promise<string> {
    // Development fallback responses
    const mockResponses: Record<AgentRole, string> = {
      interviewer: "Отличный выбор! Давайте уточним несколько деталей. Какой у вас примерный бюджет? И есть ли у вас предпочтения по району?",
      analyzer: JSON.stringify({
        weights: {
          transport: 8,
          metro: 7,
          schools: 6,
          parks: 5,
          parking: 4,
          noise: 6,
          price: 9,
          liquidity: 5,
          constructionStage: 3,
          ecology: 5,
          infrastructure: 7
        },
        reasoning: "Основываясь на ваших ответах, приоритет отдан транспортной доступности и цене"
      }),
      explainer: "Эта квартира идеально подходит вам! Она находится в 5 минутах от метро, что решает вашу главную задачу - быстро добираться на работу. Район тихий и зеленый, рядом есть хорошая школа. Единственный компромисс - нет парковки, но вы упоминали, что не водите машину.",
      consultant: "По вашему вопросу: сейчас отличное время для покупки. Цены стабилизировались, ипотечные ставки снижаются. Рекомендую обратить внимание на районы с развивающейся инфраструктурой - там лучший потенциал роста.",
      negotiator: "Учитывая, что квартира на рынке уже 2 месяца, есть хорошие шансы на торг. Начните с предложения на 7-10% ниже заявленной цены. Подчеркните готовность к быстрой сделке - это ваше преимущество."
    };

    return mockResponses[context.role] || "Извините, не могу обработать этот запрос";
  }

  private fillTemplate(template: string, values: Record<string, string>): string {
    return template.replace(/{{(\w+)}}/g, (match, key) => values[key] || match);
  }

  private getFallbackResponse(role: AgentRole): AgentResponse {
    const fallbacks: Record<AgentRole, string> = {
      interviewer: "Давайте продолжим. Расскажите, что для вас важно при выборе жилья?",
      analyzer: "Анализирую ваши предпочтения...",
      explainer: "Этот объект соответствует вашим основным критериям.",
      consultant: "Это интересный вопрос. Давайте рассмотрим варианты.",
      negotiator: "Есть несколько стратегий для успешных переговоров."
    };

    return {
      message: fallbacks[role],
      confidence: 0.5
    };
  }

  // Specific methods for common scenarios
  async analyzePreferences(conversationHistory: Message[], userProfile: any): Promise<any> {
    const context: ConversationContext = {
      userId: userProfile.id,
      role: 'analyzer',
      history: conversationHistory,
      preferences: userProfile
    };

    const response = await this.generateResponse(context);
    
    try {
      return JSON.parse(response.message);
    } catch {
      // Fallback weights if parsing fails
      return {
        weights: DEFAULT_WEIGHTS[userProfile.mode || 'life'],
        reasoning: "Использованы стандартные веса для вашего типа поиска"
      };
    }
  }

  async explainMatch(listing: any, preferences: any, breakdown: any, matchScore: number): Promise<string> {
    const context: ConversationContext = {
      userId: preferences.userId,
      role: 'explainer',
      history: [],
      preferences,
      currentListing: listing
    };

    const template = PROMPTS.explainer.userPromptTemplate;
    const filledPrompt = this.fillTemplate(template, {
      listing: JSON.stringify(listing),
      preferences: JSON.stringify(preferences),
      breakdown: JSON.stringify(breakdown),
      matchScore: matchScore.toString()
    });

    context.history.push({
      role: 'user',
      content: filledPrompt
    });

    const response = await this.generateResponse(context);
    return response.message;
  }
}

// Default weights fallback
const DEFAULT_WEIGHTS = {
  life: {
    transport: 8,
    metro: 8,
    schools: 7,
    parks: 7,
    parking: 5,
    noise: 6,
    price: 8,
    ecology: 6,
    infrastructure: 7,
  },
  invest: {
    price: 10,
    liquidity: 9,
    constructionStage: 8,
    transport: 7,
    metro: 8,
    infrastructure: 7,
    parks: 5,
    ecology: 4,
  }
};

// Create different service instances for different purposes
export const llmService = new LLMService(
  (config.llmPreset as keyof typeof MODEL_PRESETS) || 'balanced'
);

// Specialized instances with custom models
export const premiumLLM = new LLMService('premium');
export const economyLLM = new LLMService('economy');
export const russianLLM = new LLMService('russian');

// Usage tracking
export class LLMUsageTracker {
  private static usage: Record<string, { count: number; cost: number }> = {};

  static track(model: string, cost: number) {
    if (!this.usage[model]) {
      this.usage[model] = { count: 0, cost: 0 };
    }
    this.usage[model].count++;
    this.usage[model].cost += cost;
  }

  static getReport() {
    const total = Object.values(this.usage).reduce(
      (acc, curr) => ({ count: acc.count + curr.count, cost: acc.cost + curr.cost }),
      { count: 0, cost: 0 }
    );

    return {
      byModel: this.usage,
      total,
      averageCostPerCall: total.count > 0 ? total.cost / total.count : 0
    };
  }
}