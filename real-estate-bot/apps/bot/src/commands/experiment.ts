import { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { LLMModel, AgentRole } from '@real-estate-bot/shared';
import { LLMService } from '../services/llm.service';
import { MODELS, MODEL_PRESETS, selectOptimalModel } from '../config/models';

export async function experimentCommand(ctx: Context) {
  const keyboard = new InlineKeyboard()
    .text('🧪 Тест моделей', 'test_models')
    .text('💰 Сравнить цены', 'compare_costs')
    .row()
    .text('🎯 Тест ролей', 'test_roles')
    .text('📊 Статистика', 'usage_stats');

  await ctx.reply(
    '🔬 <b>Экспериментальный режим</b>\n\n' +
    'Здесь вы можете протестировать разные LLM модели и настройки.',
    {
      parse_mode: 'HTML',
      reply_markup: keyboard
    }
  );
}

export async function handleExperimentCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  
  switch (data) {
    case 'test_models':
      await testModels(ctx);
      break;
    case 'compare_costs':
      await compareCosts(ctx);
      break;
    case 'test_roles':
      await testRoles(ctx);
      break;
    case 'usage_stats':
      await showUsageStats(ctx);
      break;
  }
  
  await ctx.answerCallbackQuery();
}

async function testModels(ctx: Context) {
  const testPrompt = 'Найди мне квартиру для молодой семьи с ребенком, бюджет 10 млн';
  
  await ctx.reply('🔄 Тестирую разные модели с одинаковым запросом...\n');
  
  const models: LLMModel[] = [
    'openai/gpt-3.5-turbo',
    'anthropic/claude-3-haiku',
    'mistralai/mixtral-8x7b-instruct',
    'google/gemini-pro',
    'meta-llama/llama-3-8b-instruct'
  ];
  
  for (const model of models) {
    const llm = new LLMService('economy', { interviewer: model });
    const start = Date.now();
    
    try {
      const response = await llm.generateResponse({
        userId: ctx.from?.id.toString() || '',
        role: 'interviewer',
        history: [{ role: 'user', content: testPrompt }],
        preferences: {}
      });
      
      const time = Date.now() - start;
      const modelInfo = MODELS[model];
      
      await ctx.reply(
        `<b>📦 ${model}</b>\n` +
        `⏱ Время: ${time}ms\n` +
        `💰 Цена: ~$${((modelInfo.inputCost + modelInfo.outputCost) / 2000).toFixed(4)}\n` +
        `🚀 Скорость: ${modelInfo.speed}\n\n` +
        `<i>Ответ:</i>\n${response.message.substring(0, 300)}...`,
        { parse_mode: 'HTML' }
      );
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    } catch (error) {
      await ctx.reply(`❌ Ошибка с ${model}: ${error}`);
    }
  }
}

async function compareCosts(ctx: Context) {
  let report = '💰 <b>Сравнение стоимости моделей</b>\n\n';
  
  const roles: AgentRole[] = ['interviewer', 'analyzer', 'explainer', 'consultant', 'negotiator'];
  
  for (const preset of ['premium', 'balanced', 'economy'] as const) {
    report += `<b>${preset.toUpperCase()}</b>\n`;
    let totalCost = 0;
    
    for (const role of roles) {
      const model = MODEL_PRESETS[preset][role];
      const info = MODELS[model];
      const avgCost = (info.inputCost + info.outputCost) / 2000; // per 1k tokens
      totalCost += avgCost;
      
      report += `${role}: ${model.split('/')[1]} (~$${avgCost.toFixed(4)})\n`;
    }
    
    report += `<b>Общая стоимость за сессию: ~$${(totalCost * 5).toFixed(3)}</b>\n\n`;
  }
  
  await ctx.reply(report, { parse_mode: 'HTML' });
}

async function testRoles(ctx: Context) {
  const keyboard = new InlineKeyboard()
    .text('👤 Interviewer', 'role_interviewer')
    .text('🧠 Analyzer', 'role_analyzer')
    .row()
    .text('💬 Explainer', 'role_explainer')
    .text('📊 Consultant', 'role_consultant')
    .row()
    .text('💼 Negotiator', 'role_negotiator');
    
  await ctx.reply(
    '🎭 Выберите роль для тестирования:',
    { reply_markup: keyboard }
  );
}

async function showUsageStats(ctx: Context) {
  const { LLMUsageTracker } = await import('../services/llm.service');
  const report = LLMUsageTracker.getReport();
  
  let message = '📊 <b>Статистика использования LLM</b>\n\n';
  
  if (report.total.count === 0) {
    message += 'Пока нет данных об использовании.';
  } else {
    message += `<b>Всего запросов:</b> ${report.total.count}\n`;
    message += `<b>Общая стоимость:</b> $${report.total.cost.toFixed(4)}\n`;
    message += `<b>Средняя стоимость:</b> $${report.averageCostPerCall.toFixed(4)}\n\n`;
    
    message += '<b>По моделям:</b>\n';
    for (const [model, stats] of Object.entries(report.byModel)) {
      message += `${model}: ${stats.count} запросов, $${stats.cost.toFixed(4)}\n`;
    }
  }
  
  await ctx.reply(message, { parse_mode: 'HTML' });
}

// Handler for role testing
export async function handleRoleTest(ctx: Context, role: AgentRole) {
  const testCases: Record<AgentRole, { role: 'user' | 'assistant', content: string }[]> = {
    interviewer: [
      { role: 'user', content: 'Хочу купить квартиру' }
    ],
    analyzer: [
      { role: 'user', content: 'Семья с 2 детьми, работаю в центре, жена в Сколково, бюджет 15 млн' }
    ],
    explainer: [
      { role: 'user', content: 'Почему эта квартира подходит мне?' }
    ],
    consultant: [
      { role: 'user', content: 'Стоит ли покупать в новостройке или лучше вторичка?' }
    ],
    negotiator: [
      { role: 'user', content: 'Квартира стоит 12 млн, висит 2 месяца, как торговаться?' }
    ]
  };
  
  const history = testCases[role];
  if (!history) return;
  
  await ctx.reply(`🎭 Тестирую роль: <b>${role}</b>\n\nЗапрос: ${history[0].content}`, { parse_mode: 'HTML' });
  
  // Test with different presets
  for (const preset of ['economy', 'balanced', 'premium'] as const) {
    const llm = new LLMService(preset);
    const model = MODEL_PRESETS[preset][role];
    
    try {
      const response = await llm.generateResponse({
        userId: ctx.from?.id.toString() || '',
        role,
        history,
        preferences: role === 'explainer' ? {
          listing: { address: 'ул. Пушкина, д. 10', price: 12000000 },
          matchScore: 8.5
        } : {}
      });
      
      await ctx.reply(
        `\n<b>Preset: ${preset}</b>\n` +
        `Model: ${model}\n\n` +
        `${response.message}`,
        { parse_mode: 'HTML' }
      );
      
    } catch (error) {
      await ctx.reply(`❌ Ошибка с ${preset}: ${error}`);
    }
  }
}