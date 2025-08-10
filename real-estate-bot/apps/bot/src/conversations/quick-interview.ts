import { Conversation } from '@grammyjs/conversations';
import { BotContext } from '../types';
import { 
  quickBudgetKeyboard,
  popularDistrictsKeyboard,
  quickPrioritiesKeyboard
} from '../utils/keyboards';
import { DEFAULT_LIFE_WEIGHTS } from '@real-estate-bot/shared';

export async function quickInterview(conversation: Conversation<BotContext>, ctx: BotContext) {
  const startTime = Date.now();
  
  // Clear previous session data
  ctx.session.budget = {};
  ctx.session.locations = [];
  ctx.session.weights = { ...DEFAULT_LIFE_WEIGHTS };
  ctx.session.interviewMode = 'life'; // Default to life mode for quick search

  // Track interview start
  const { analytics } = await import('../services/analytics.service');
  analytics.trackInterviewStarted(ctx.session.userId!, 'quick');

  await ctx.reply(
    '⚡ <b>Быстрый поиск за 30 секунд!</b>\n\n' +
    'Ответьте на 3 вопроса, и я покажу подходящие варианты.',
    { parse_mode: 'HTML' }
  );

  // Question 1: Budget (with preset options)
  await ctx.reply(
    '💰 <b>Ваш бюджет?</b>\n\n' +
    'Выберите диапазон или введите свой:',
    { 
      reply_markup: quickBudgetKeyboard,
      parse_mode: 'HTML'
    }
  );

  const budgetResponse = await conversation.wait();
  
  if (budgetResponse.callbackQuery?.data?.startsWith('qbudget_')) {
    await budgetResponse.answerCallbackQuery();
    const budgetType = budgetResponse.callbackQuery.data.replace('qbudget_', '');
    
    switch (budgetType) {
      case '5':
        ctx.session.budget = { max: 5000000 };
        break;
      case '5_8':
        ctx.session.budget = { min: 5000000, max: 8000000 };
        break;
      case '8_12':
        ctx.session.budget = { min: 8000000, max: 12000000 };
        break;
      case '12_20':
        ctx.session.budget = { min: 12000000, max: 20000000 };
        break;
      case '20_plus':
        ctx.session.budget = { min: 20000000 };
        break;
      case 'custom':
        await ctx.reply('Введите ваш бюджет (например: 7000000 или 5-10 млн):');
        const customBudget = await conversation.wait();
        if (customBudget.message?.text) {
          const budgetMatch = customBudget.message.text.match(/(\d+)(?:\s*-\s*(\d+))?/);
          if (budgetMatch) {
            const multiplier = customBudget.message.text.includes('млн') ? 1000000 : 1;
            if (budgetMatch[2]) {
              ctx.session.budget = {
                min: parseInt(budgetMatch[1]) * multiplier,
                max: parseInt(budgetMatch[2]) * multiplier
              };
            } else {
              ctx.session.budget = {
                max: parseInt(budgetMatch[1]) * multiplier
              };
            }
          }
        }
        break;
    }
  }

  // Question 2: Districts (multiple choice)
  await ctx.reply(
    '📍 <b>Где ищете?</b>\n\n' +
    'Выберите один или несколько районов:',
    { 
      reply_markup: popularDistrictsKeyboard,
      parse_mode: 'HTML'
    }
  );

  const selectedDistricts: string[] = [];
  let districtsDone = false;

  while (!districtsDone) {
    const districtResponse = await conversation.waitForCallbackQuery(/^district/);
    await districtResponse.answerCallbackQuery();
    
    if (districtResponse.callbackQuery.data === 'districts_done') {
      districtsDone = true;
    } else {
      const district = districtResponse.callbackQuery.data.replace('district_', '');
      const districtNames: Record<string, string> = {
        center: 'Центр',
        west: 'Запад',
        southwest: 'Юго-Запад',
        city: 'Москва-Сити',
        north: 'Север',
        east: 'Восток'
      };
      
      if (!selectedDistricts.includes(districtNames[district])) {
        selectedDistricts.push(districtNames[district]);
        await ctx.reply(`✅ Выбрано: ${selectedDistricts.join(', ')}`);
      }
    }
  }
  
  ctx.session.locations = selectedDistricts;

  // Question 3: Main priority (simplified)
  await ctx.reply(
    '🎯 <b>Что самое важное?</b>\n\n' +
    'Выберите главный приоритет:',
    { 
      reply_markup: quickPrioritiesKeyboard,
      parse_mode: 'HTML'
    }
  );

  const priorityResponse = await conversation.waitForCallbackQuery(/^priority_/);
  await priorityResponse.answerCallbackQuery();
  
  const priority = priorityResponse.callbackQuery.data.replace('priority_', '');
  
  // Adjust weights based on priority
  switch (priority) {
    case 'metro':
      ctx.session.weights.metro = 10;
      ctx.session.weights.transport = 10;
      break;
    case 'schools':
      ctx.session.weights.schools = 10;
      ctx.session.weights.parks = 8;
      break;
    case 'parks':
      ctx.session.weights.parks = 10;
      ctx.session.weights.ecology = 9;
      break;
    case 'price':
      ctx.session.weights.price = 10;
      break;
    case 'parking':
      ctx.session.weights.parking = 10;
      ctx.session.parkingRequired = true;
      break;
    case 'new':
      ctx.session.newBuilding = true;
      ctx.session.weights.constructionStage = 8;
      break;
  }

  // Show loading state with progress
  const loadingMsg = await ctx.reply(
    '🔍 <b>Ищу подходящие варианты...</b>\n\n' +
    '⏳ Анализирую базу объектов...',
    { parse_mode: 'HTML' }
  );

  // Simulate progress updates
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await ctx.api.editMessageText(
    ctx.chat!.id,
    loadingMsg.message_id,
    '🔍 <b>Ищу подходящие варианты...</b>\n\n' +
    '✅ База проанализирована\n' +
    '⏳ Рассчитываю совпадение...',
    { parse_mode: 'HTML' }
  );

  await new Promise(resolve => setTimeout(resolve, 500));
  
  await ctx.api.editMessageText(
    ctx.chat!.id,
    loadingMsg.message_id,
    '🔍 <b>Ищу подходящие варианты...</b>\n\n' +
    '✅ База проанализирована\n' +
    '✅ Совпадение рассчитано\n' +
    '⏳ Формирую результаты...',
    { parse_mode: 'HTML' }
  );

  // Track interview completion
  const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
  analytics.trackInterviewCompleted(ctx.session.userId!, 'quick', durationSeconds);

  // Trigger search
  ctx.session.currentState = 'search_pending';
}