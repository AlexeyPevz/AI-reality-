import { Context, InlineKeyboard } from 'grammy';
import { formatPrice } from '@real-estate-bot/shared';
import type { Preferences } from '@real-estate-bot/shared';
import { searchAndScoreListings } from '../services/search.service';

// Предустановленные демо-профили
const DEMO_PROFILES = {
  family: {
    name: '👨‍👩‍👧‍👦 Молодая семья',
    description: 'Ищете квартиру для семьи с детьми',
    preferences: {
      mode: 'life' as const,
      budgetMin: 7000000,
      budgetMax: 15000000,
      districts: ['Пресненский', 'Хамовники', 'Тверской'],
      rooms: [2, 3],
      areaMin: 60,
      areaMax: 100,
      propertyType: 'any' as const,
      weights: {
        transport: 0.8,
        schools: 0.9,
        parks: 0.8,
        safety: 0.9 as any,
        parking: 0.7,
        infrastructure: 0.8
      }
    }
  },
  investor: {
    name: '💰 Инвестор',
    description: 'Покупка для сдачи в аренду',
    preferences: {
      mode: 'invest' as const,
      budgetMin: 5000000,
      budgetMax: 10000000,
      districts: ['Академический', 'Южное Бутово', 'Марьино'],
      rooms: [1, 2],
      areaMin: 30,
      areaMax: 60,
      propertyType: 'new' as const,
      weights: {
        liquidity: 0.9,
        price: 0.8,
        constructionStage: 0.7,
        infrastructure: 0.6
      }
    }
  },
  luxury: {
    name: '💎 Премиум сегмент',
    description: 'Элитная недвижимость в центре',
    preferences: {
      mode: 'life' as const,
      budgetMin: 30000000,
      budgetMax: 100000000,
      districts: ['Арбат', 'Патриаршие', 'Остоженка'],
      rooms: [3, 4],
      areaMin: 120,
      areaMax: 300,
      propertyType: 'any' as const,
      weights: {
        transport: 0.5,
        schools: 0.7,
        parks: 0.6,
        safety: 0.9 as any,
        parking: 0.9,
        infrastructure: 0.9
      }
    }
  },
  student: {
    name: '🎓 Студент/Молодой специалист',
    description: 'Первая квартира рядом с метро',
    preferences: {
      mode: 'life' as const,
      budgetMin: 4000000,
      budgetMax: 7000000,
      districts: ['Бибирево', 'Медведково', 'Отрадное'],
      rooms: [0, 1], // студия или однушка
      areaMin: 25,
      areaMax: 45,
      propertyType: 'secondary' as const,
      weights: {
        transport: 0.95,
        schools: 0.1,
        parks: 0.5,
        safety: 0.7 as any,
        parking: 0.2,
        infrastructure: 0.8
      }
    }
  }
};

export async function demoCommand(ctx: Context) {
  const keyboard = new InlineKeyboard();
  
  Object.entries(DEMO_PROFILES).forEach(([key, profile]) => {
    keyboard.text(profile.name, `demo_${key}`).row();
  });
  
  keyboard.text('❌ Отмена', 'close');
  
  await ctx.reply(
    '🎮 <b>Демо-режим</b>\n\n' +
    'Попробуйте наш сервис без регистрации!\n\n' +
    'Выберите демо-профиль, и я покажу, как работает подбор недвижимости:',
    {
      parse_mode: 'HTML',
      reply_markup: keyboard
    }
  );
}

export async function handleDemoSelection(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('demo_')) return;
  
  const profileKey = data.replace('demo_', '') as keyof typeof DEMO_PROFILES;
  const profile = DEMO_PROFILES[profileKey];
  
  if (!profile) {
    await ctx.answerCallbackQuery('Профиль не найден');
    return;
  }
  
  await ctx.answerCallbackQuery();
  
  // Показываем выбранный профиль
  await ctx.editMessageText(
    `✅ <b>Выбран профиль: ${profile.name}</b>\n\n` +
    `${profile.description}\n\n` +
    `💰 Бюджет: ${formatPrice(profile.preferences.budgetMin)} - ${formatPrice(profile.preferences.budgetMax)}\n` +
    `🏠 Комнат: ${profile.preferences.rooms.join(', ')}\n` +
    `📐 Площадь: ${profile.preferences.areaMin}-${profile.preferences.areaMax} м²\n` +
    `📍 Районы: ${profile.preferences.districts.join(', ')}\n\n` +
    `🔍 Начинаю поиск...`,
    { parse_mode: 'HTML' }
  );
  
  // Создаем временные preferences
  const demoPreferences: Preferences = {
    id: `demo_${Date.now()}`,
    userId: 'demo_user',
    mode: profile.preferences.mode,
    weights: profile.preferences.weights as any,
    budgetMin: profile.preferences.budgetMin,
    budgetMax: profile.preferences.budgetMax,
    locations: profile.preferences.districts,
    commutePoints: [],
    transportMode: 'public',
    rooms: profile.preferences.rooms,
    areaMin: profile.preferences.areaMin,
    areaMax: profile.preferences.areaMax,
    propertyType: profile.preferences.propertyType,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // Выполняем поиск
  const results = await searchAndScoreListings(demoPreferences);
  
  if (results.length === 0) {
    await ctx.reply(
      '😔 К сожалению, по вашим критериям ничего не найдено.\n\n' +
      'Попробуйте другой демо-профиль!',
      { parse_mode: 'HTML' }
    );
    return;
  }
  
  // Показываем результаты
  let message = `🏠 <b>Найдено ${results.length} подходящих объектов:</b>\n\n`;
  
  for (const result of results.slice(0, 3)) {
    const listing = result.listing!;
    message += `🏢 <b>${listing.title}</b>\n`;
    message += `💰 ${formatPrice(listing.price)}`;
    if (listing.area) {
      message += ` (${formatPrice(Math.round(listing.price / listing.area))}/м²)`;
    }
    message += '\n';
    if (listing.district) message += `📍 ${listing.district}`;
    if (listing.metro) {
      message += ` • ${listing.metro}`;
    }
    message += '\n';
    message += `⭐ Оценка соответствия: ${result.matchScore.toFixed(1)}/10\n`;
    message += `💡 ${result.explanation.split('.')[0]}.\n`;
    
    if ((listing as any).url) {
      message += `<a href="${(listing as any).url}">Посмотреть объект</a>\n`;
    }
    message += '\n';
  }
  
  // Призыв к действию
  const ctaKeyboard = new InlineKeyboard()
    .text('🚀 Начать полноценный поиск', 'start_real_search')
    .row()
    .text('🎮 Попробовать другой профиль', 'demo')
    .text('❓ Как это работает', 'demo_how_it_works');
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: ctaKeyboard
  });
}

export async function handleDemoActions(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  
  switch (data) {
    case 'start_real_search':
      await ctx.answerCallbackQuery();
      await ctx.reply(
        '🚀 Отлично! Давайте создадим ваш персональный профиль.\n\n' +
        'Используйте команду /start для начала работы.',
        { parse_mode: 'HTML' }
      );
      break;
      
    case 'demo_how_it_works':
      await ctx.answerCallbackQuery();
      await ctx.reply(
        '🤖 <b>Как работает наш бот?</b>\n\n' +
        '1️⃣ <b>Умное интервью</b>\n' +
        'Задаю правильные вопросы, чтобы понять ваши потребности\n\n' +
        '2️⃣ <b>Match-score алгоритм</b>\n' +
        'Оцениваю каждый объект по 10+ параметрам\n\n' +
        '3️⃣ <b>AI объяснения</b>\n' +
        'Объясняю, почему объект вам подходит\n\n' +
        '4️⃣ <b>Фоновый мониторинг</b>\n' +
        'Слежу за новыми объявлениями 24/7\n\n' +
        '5️⃣ <b>База знаний</b>\n' +
        'Отвечаю на вопросы о покупке недвижимости\n\n' +
        'Попробуйте сами! /demo',
        { parse_mode: 'HTML' }
      );
      break;
  }
}