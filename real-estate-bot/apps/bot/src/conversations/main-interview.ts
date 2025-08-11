import { Conversation } from '@grammyjs/conversations';
import { BotContext } from '../types';
import { 
  modeSelectionKeyboard, 
  yesNoKeyboard, 
  skipKeyboard,
  transportModeKeyboard,
  roomsKeyboard,
  createImportanceKeyboard
} from '../utils/keyboards';
import { DEFAULT_LIFE_WEIGHTS, DEFAULT_INVEST_WEIGHTS } from '@real-estate-bot/shared';

export async function mainInterview(conversation: Conversation<BotContext>, ctx: BotContext) {
  // Clear previous session data
  ctx.session.budget = {};
  ctx.session.locations = [];
  ctx.session.commutePoints = [];
  ctx.session.rooms = [];
  ctx.session.weights = {};

  // Step 1: Mode selection
  await ctx.reply(
    '🏠 Давайте подберем для вас идеальную недвижимость!\n\n' +
    'Для начала выберите цель поиска:',
    { reply_markup: modeSelectionKeyboard }
  );

  const modeResponse = await conversation.waitForCallbackQuery(/^mode_/);
  await modeResponse.answerCallbackQuery();
  
  const mode = modeResponse.callbackQuery.data.replace('mode_', '') as 'life' | 'invest';
  ctx.session.interviewMode = mode;
  
  // Set default weights based on mode
  ctx.session.weights = mode === 'life' ? { ...DEFAULT_LIFE_WEIGHTS } : { ...DEFAULT_INVEST_WEIGHTS };

  // Step 2: Budget
  await ctx.reply(
    '💰 Какой у вас бюджет?\n\n' +
    'Укажите минимальную и максимальную сумму через дефис.\n' +
    'Например: 5000000-8000000\n\n' +
    'Или просто максимальную сумму:',
    { reply_markup: skipKeyboard }
  );

  const budgetResponse = await conversation.wait();
  
  if (budgetResponse.callbackQuery?.data !== 'skip' && budgetResponse.message?.text) {
    const budgetText = budgetResponse.message.text;
    const budgetMatch = budgetText.match(/(\d+)(?:\s*-\s*(\d+))?/);
    
    if (budgetMatch) {
      if (budgetMatch[2]) {
        ctx.session.budget = {
          min: parseInt(budgetMatch[1]),
          max: parseInt(budgetMatch[2])
        };
      } else {
        ctx.session.budget = {
          max: parseInt(budgetMatch[1])
        };
      }
    }
  }

  // Step 3: Location (for life mode)
  if (mode === 'life') {
    await ctx.reply(
      '📍 В каком районе или городе ищете жилье?\n\n' +
      'Можете указать несколько районов через запятую:'
    );

    const locationResponse = await conversation.wait();
    if (locationResponse.message?.text) {
      ctx.session.locations = locationResponse.message.text.split(',').map(l => l.trim());
    }

    // Step 4: Commute points
    await ctx.reply(
      '🎯 Есть ли важные для вас точки (работа, школа, др.)?\n\n' +
      'Укажите адреса или названия мест, до которых важна транспортная доступность:',
      { reply_markup: skipKeyboard }
    );

    const commuteResponse = await conversation.wait();
    if (commuteResponse.callbackQuery?.data !== 'skip' && commuteResponse.message?.text) {
      // For MVP, we'll store as text. In production, we'd geocode these
      const places = commuteResponse.message.text.split(',').map(p => p.trim());
      ctx.session.commutePoints = places.map((place, i) => ({
        name: place,
        lat: 55.7558 + (Math.random() - 0.5) * 0.1, // Mock coordinates
        lng: 37.6173 + (Math.random() - 0.5) * 0.1,
        timeImportance: 8 // Default importance
      }));

      // Ask for transport mode
      await ctx.reply(
        '🚗 Как вы обычно добираетесь?',
        { reply_markup: transportModeKeyboard }
      );

      const transportResponse = await conversation.waitForCallbackQuery(/^transport_/);
      await transportResponse.answerCallbackQuery();
      ctx.session.transportMode = transportResponse.callbackQuery.data.replace('transport_', '') as any;
    }

    // Step 5: Family situation
    await ctx.reply(
      '👨‍👩‍👧‍👦 Расскажите о вашей семье:\n\n' +
      'Есть ли дети? Планируете ли в ближайшее время?',
      { reply_markup: yesNoKeyboard }
    );

    const familyResponse = await conversation.waitForCallbackQuery(/^(yes|no)$/);
    await familyResponse.answerCallbackQuery();
    
    if (familyResponse.callbackQuery.data === 'yes') {
      // Increase importance of schools and parks
      ctx.session.weights.schools = Math.min(10, (ctx.session.weights.schools || 5) + 2);
      ctx.session.weights.parks = Math.min(10, (ctx.session.weights.parks || 5) + 2);
    }
  }

  // Step 6: Rooms
  await ctx.reply(
    '🏠 Сколько комнат вам нужно?\n\n' +
    'Можете выбрать несколько вариантов:',
    { reply_markup: roomsKeyboard }
  );

  const selectedRooms: number[] = [];
  let roomsDone = false;

  while (!roomsDone) {
    const roomResponse = await conversation.waitForCallbackQuery(/^rooms_/);
    await roomResponse.answerCallbackQuery();
    
    if (roomResponse.callbackQuery.data === 'rooms_done') {
      roomsDone = true;
    } else {
      const rooms = parseInt(roomResponse.callbackQuery.data.replace('rooms_', ''));
      if (!selectedRooms.includes(rooms)) {
        selectedRooms.push(rooms);
        await ctx.reply(`✅ Выбрано: ${selectedRooms.join(', ')} комн.`);
      }
    }
  }
  
  ctx.session.rooms = selectedRooms;

  // Step 7: Importance factors
  const factors = mode === 'life' 
    ? ['transport', 'schools', 'parks', 'parking', 'noise', 'ecology']
    : ['liquidity', 'constructionStage', 'infrastructure'];

  for (const factor of factors) {
    const factorNames: Record<string, string> = {
      transport: '🚇 Транспортная доступность',
      schools: '🏫 Близость школ/садов',
      parks: '🌳 Парки и зеленые зоны',
      parking: '🚗 Наличие парковки',
      noise: '🔇 Тишина',
      ecology: '🌿 Экология района',
      liquidity: '💰 Ликвидность',
      constructionStage: '🏗 Стадия строительства',
      infrastructure: '🏘 Инфраструктура',
    };

    await ctx.reply(
      `Насколько важен фактор:\n${factorNames[factor]}\n\n` +
      'Оцените от 1 до 10:',
      { reply_markup: createImportanceKeyboard(factor) }
    );

    const importanceResponse = await conversation.waitForCallbackQuery(new RegExp(`^importance_${factor}_`));
    await importanceResponse.answerCallbackQuery();
    
    const importance = parseInt(importanceResponse.callbackQuery.data.split('_').pop()!);
    ctx.session.weights![factor] = importance;
  }

  // Step 8: New building preference
  await ctx.reply(
    '🏗 Рассматриваете только новостройки?',
    { reply_markup: yesNoKeyboard }
  );

  const newBuildingResponse = await conversation.waitForCallbackQuery(/^(yes|no)$/);
  await newBuildingResponse.answerCallbackQuery();
  ctx.session.newBuilding = newBuildingResponse.callbackQuery.data === 'yes';

  // Step 9: Parking requirement
  if (mode === 'life') {
    await ctx.reply(
      '🚗 Нужна ли парковка?',
      { reply_markup: yesNoKeyboard }
    );

    const parkingResponse = await conversation.waitForCallbackQuery(/^(yes|no)$/);
    await parkingResponse.answerCallbackQuery();
    ctx.session.parkingRequired = parkingResponse.callbackQuery.data === 'yes';
  }

  // Summary
  await ctx.reply(
    '✅ Отлично! Я собрал все ваши предпочтения.\n\n' +
    `📊 Ваш профиль:\n` +
    `• Цель: ${mode === 'life' ? 'Жилье для жизни' : 'Инвестиции'}\n` +
    `• Бюджет: ${ctx.session.budget.min ? `от ${ctx.session.budget.min} ` : ''}до ${ctx.session.budget.max || 'не указан'}\n` +
    `• Комнат: ${ctx.session.rooms?.join(', ') || 'любое'}\n` +
    `• ${ctx.session.newBuilding ? 'Только новостройки' : 'Новостройки и вторичка'}\n\n` +
    '🔍 Начинаю поиск подходящих вариантов...'
  );

  // Save preferences and trigger search
  ctx.session.currentState = 'search_pending';
}