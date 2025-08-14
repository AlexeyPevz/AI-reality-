import { Conversation } from '@grammyjs/conversations';
import { BotContext } from '../types';
import { Message, ConversationContext } from '@real-estate-bot/shared';
import { llmService } from '../services/llm.service';
import { InlineKeyboard } from 'grammy';

export async function aiInterview(conversation: Conversation<BotContext>, ctx: BotContext) {
  const startTime = Date.now();
  
  // Initialize conversation history
  const conversationHistory: Message[] = [];
  
  // Track interview start
  const { analytics } = await import('../services/analytics.service');
  analytics.trackInterviewStarted(ctx.session.userId!, 'detailed');

  // Initial greeting from AI
  const initialContext: ConversationContext = {
    userId: ctx.session.userId!,
    role: 'interviewer',
    history: [{
      role: 'user',
      content: 'Я хочу найти квартиру'
    }],
    preferences: {}
  };

  const greeting = await llmService.generateResponse(initialContext);
  await ctx.reply(greeting.message, {
    reply_markup: new InlineKeyboard()
      .text('💬 Ответить текстом', 'text_mode')
      .text('🔄 Начать заново', 'restart')
  });

  conversationHistory.push(
    { role: 'user', content: 'Я хочу найти квартиру' },
    { role: 'assistant', content: greeting.message }
  );

  // Main conversation loop
  let conversationComplete = false;
  let collectedInfo: any = {
    budget: {},
    locations: [],
    requirements: [],
    preferences: {}
  };

  while (!conversationComplete) {
    const response = await conversation.wait();
    
    // Handle callback queries
    if (response.callbackQuery) {
      await response.answerCallbackQuery();
      
      if (response.callbackQuery.data === 'restart') {
        await ctx.reply('Давайте начнем сначала...');
        return await aiInterview(conversation, ctx);
      }
      
      continue;
    }

    // Handle text messages
    if (response.message?.text) {
      const userMessage = response.message.text;
      conversationHistory.push({ role: 'user', content: userMessage });

      // Check for exit commands
      if (userMessage.toLowerCase().includes('достаточно') || 
          userMessage.toLowerCase().includes('хватит') ||
          userMessage.toLowerCase().includes('все')) {
        conversationComplete = true;
        continue;
      }

      // Generate AI response
      const aiContext: ConversationContext = {
        userId: ctx.session.userId!,
        role: 'interviewer',
        history: conversationHistory,
        preferences: collectedInfo
      };

      const aiResponse = await llmService.generateResponse(aiContext);
      await ctx.reply(aiResponse.message, {
        reply_markup: new InlineKeyboard()
          .text('✅ Достаточно информации', 'complete')
          .text('🔄 Начать заново', 'restart')
      });

      conversationHistory.push({ role: 'assistant', content: aiResponse.message });

      // Extract information from conversation (simplified for MVP)
      await extractInfoFromMessage(userMessage, collectedInfo);

      // Check if we have enough information
      if (hasEnoughInfo(collectedInfo)) {
        await ctx.reply(
          'Кажется, я собрал достаточно информации! Хотите продолжить или начнем поиск?',
          {
            reply_markup: new InlineKeyboard()
              .text('🔍 Начать поиск', 'start_search')
              .text('➕ Добавить детали', 'continue')
          }
        );

        const decision = await conversation.waitForCallbackQuery(['start_search', 'continue']);
        await decision.answerCallbackQuery();
        
        if (decision.callbackQuery.data === 'start_search') {
          conversationComplete = true;
        }
      }
    }
  }

  // Analyze collected information with AI
  await ctx.reply('🤔 Анализирую ваши предпочтения...');
  
  const analysisResult = await llmService.analyzePreferences(
    conversationHistory,
    { id: ctx.session.userId, ...collectedInfo }
  );

  // Set session data
  ctx.session.budget = collectedInfo.budget || {};
  ctx.session.locations = collectedInfo.locations || [];
  ctx.session.weights = analysisResult.weights;
  ctx.session.interviewMode = detectMode(collectedInfo);

  // Show analysis result
  await ctx.reply(
    `✅ Отлично! Вот что я понял:\n\n` +
    `${analysisResult.reasoning}\n\n` +
    `🔍 Начинаю поиск подходящих вариантов...`
  );

  // Track completion
  const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
  analytics.trackInterviewCompleted(ctx.session.userId!, 'detailed', durationSeconds);

  // Trigger search
  ctx.session.currentState = 'search_pending';
}

// Helper functions
async function extractInfoFromMessage(message: string, info: any) {
  // Simple extraction logic - in production would use NLP/LLM
  
  // Budget extraction
  const budgetMatch = message.match(/(\d+)\s*(млн|миллион|тыс|тысяч|₽|руб)/i);
  if (budgetMatch) {
    const amount = parseInt(budgetMatch[1]);
    const multiplier = budgetMatch[2].toLowerCase().includes('млн') || 
                      budgetMatch[2].toLowerCase().includes('миллион') ? 1000000 : 1000;
    info.budget.max = amount * multiplier;
  }

  // Location extraction
  const districts = ['центр', 'юг', 'север', 'запад', 'восток', 'юго-запад', 'сити'];
  districts.forEach(district => {
    if (message.toLowerCase().includes(district)) {
      if (!info.locations.includes(district)) {
        info.locations.push(district);
      }
    }
  });

  // Requirements extraction
  if (message.toLowerCase().includes('метро')) {
    info.preferences.metroImportant = true;
  }
  if (message.toLowerCase().includes('школ') || message.toLowerCase().includes('дет')) {
    info.preferences.schoolsImportant = true;
  }
  if (message.toLowerCase().includes('парк') || message.toLowerCase().includes('зелен')) {
    info.preferences.parksImportant = true;
  }
  if (message.toLowerCase().includes('парков')) {
    info.preferences.parkingRequired = true;
  }
  if (message.toLowerCase().includes('новостройк')) {
    info.preferences.newBuilding = true;
  }
}

function hasEnoughInfo(info: any): boolean {
  // Check if we have minimum required information
  return !!(info.budget.max && info.locations.length > 0);
}

function detectMode(info: any): 'life' | 'invest' {
  // Simple heuristic to detect mode
  const investKeywords = ['инвест', 'доход', 'сдава', 'окупаем', 'рост цен'];
  const hasInvestKeywords = investKeywords.some(keyword => 
    JSON.stringify(info).toLowerCase().includes(keyword)
  );
  
  return hasInvestKeywords ? 'invest' : 'life';
}