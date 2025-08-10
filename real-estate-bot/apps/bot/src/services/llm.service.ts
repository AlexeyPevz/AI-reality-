import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { 
  LLMProvider, 
  LLMModel, 
  AgentRole, 
  Message, 
  AgentResponse,
  ConversationContext 
} from '@real-estate-bot/shared';
import { PROMPTS } from '../prompts';
import { config } from '../config';

export class LLMService {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private provider: LLMProvider;
  private model: LLMModel;

  constructor(provider: LLMProvider = 'openai', model?: LLMModel) {
    this.provider = provider;
    
    // Initialize providers based on config
    if (provider === 'openai' && config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
      this.model = model || 'gpt-4-turbo-preview';
    } else if (provider === 'anthropic' && config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
      this.model = model || 'claude-3-sonnet';
    } else {
      // Fallback to mock provider for development
      this.provider = 'openai';
      this.model = 'gpt-3.5-turbo';
      console.warn('LLM API keys not configured, using mock responses');
    }
  }

  async generateResponse(context: ConversationContext): Promise<AgentResponse> {
    const prompt = PROMPTS[context.role];
    if (!prompt) {
      throw new Error(`No prompt template for role: ${context.role}`);
    }

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
      
      if (this.provider === 'openai' && this.openai) {
        response = await this.generateOpenAI(messages);
      } else if (this.provider === 'anthropic' && this.anthropic) {
        response = await this.generateAnthropic(messages);
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

  private async generateOpenAI(messages: Message[]): Promise<string> {
    if (!this.openai) throw new Error('OpenAI not initialized');

    const completion = await this.openai.chat.completions.create({
      model: this.model as string,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      })),
      temperature: 0.7,
      max_tokens: 1000,
    });

    return completion.choices[0]?.message?.content || '';
  }

  private async generateAnthropic(messages: Message[]): Promise<string> {
    if (!this.anthropic) throw new Error('Anthropic not initialized');

    // Anthropic requires system message separately
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const otherMessages = messages.filter(m => m.role !== 'system');

    const completion = await this.anthropic.messages.create({
      model: this.model as string,
      system: systemMessage,
      messages: otherMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      max_tokens: 1000,
    });

    return completion.content[0].type === 'text' ? completion.content[0].text : '';
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

// Singleton instance
export const llmService = new LLMService(
  (config.llmProvider as LLMProvider) || 'openai',
  (config.llmModel as LLMModel) || undefined
);