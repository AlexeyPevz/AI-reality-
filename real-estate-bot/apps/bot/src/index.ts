import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { RedisAdapter } from '@grammyjs/storage-redis';
import Redis from 'ioredis';
import { config } from './config';
import { BotContext, SessionData, CONVERSATIONS } from './types';
import { mainInterview } from './conversations/main-interview';
import { UserService } from './services/user.service';
import { PreferencesService } from './services/preferences.service';
import { mainMenuKeyboard, resultActionsKeyboard } from './utils/keyboards';
import { searchAndScoreListings } from './services/search.service';
import { formatPrice, formatArea } from '@real-estate-bot/shared';

// Create bot instance
const bot = new Bot<BotContext>(config.botToken);

// Setup Redis storage for sessions
const redis = new Redis(config.redisUrl);
const storage = new RedisAdapter({ instance: redis });

// Install session middleware
bot.use(
  session({
    initial: (): SessionData => ({}),
    storage,
  })
);

// Install conversations plugin
bot.use(conversations());

// Register conversations
bot.use(createConversation(mainInterview, CONVERSATIONS.MAIN_INTERVIEW));

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start command
bot.command('start', async (ctx) => {
  // Ensure user exists in database
  const user = await UserService.findOrCreate(ctx.from!.id);
  ctx.session.userId = user.id;
  ctx.session.user = user;

  await ctx.reply(
    `👋 Добро пожаловать в бот подбора недвижимости!\n\n` +
    `Я помогу вам найти идеальную квартиру для жизни или инвестиций.\n\n` +
    `Что умею:\n` +
    `• 🏠 Подбор жилья по вашим критериям\n` +
    `• 📊 Оценка объектов по системе match-score\n` +
    `• 🔔 Уведомления о новых подходящих вариантах\n` +
    `• 💡 Объяснение, почему объект вам подходит\n\n` +
    `Выберите действие:`,
    { reply_markup: mainMenuKeyboard }
  );
});

// Handle menu navigation
bot.callbackQuery('back_to_menu', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    '📋 Главное меню\n\nВыберите действие:',
    { reply_markup: mainMenuKeyboard }
  );
});

// Start search callbacks
bot.callbackQuery(['search_life', 'search_invest'], async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter(CONVERSATIONS.MAIN_INTERVIEW);
});

// Handle search completion
bot.use(async (ctx, next) => {
  if (ctx.session.currentState === 'search_pending') {
    ctx.session.currentState = undefined;
    
    // Save preferences
    const preferences = await PreferencesService.create({
      userId: ctx.session.userId!,
      mode: ctx.session.interviewMode!,
      weights: ctx.session.weights!,
      budgetMin: ctx.session.budget?.min,
      budgetMax: ctx.session.budget?.max,
      locations: ctx.session.locations || [],
      commutePoints: ctx.session.commutePoints || [],
      transportMode: ctx.session.transportMode,
      rooms: ctx.session.rooms,
      areaMin: ctx.session.areaMin,
      areaMax: ctx.session.areaMax,
      newBuilding: ctx.session.newBuilding,
      parkingRequired: ctx.session.parkingRequired,
    });

    // Perform search
    try {
      const results = await searchAndScoreListings(preferences);
      
      if (results.length === 0) {
        await ctx.reply(
          '😔 К сожалению, я не нашел подходящих вариантов по вашим критериям.\n\n' +
          'Попробуйте:\n' +
          '• Расширить бюджет\n' +
          '• Изменить требования к району\n' +
          '• Уменьшить количество обязательных критериев',
          { reply_markup: mainMenuKeyboard }
        );
        return;
      }

      // Store results in session
      ctx.session.lastSearchResults = results.map(r => r.listing!.id);
      ctx.session.currentViewingIndex = 0;

      // Show first result
      await showSearchResult(ctx, results[0]);
      
    } catch (error) {
      console.error('Search error:', error);
      await ctx.reply(
        '❌ Произошла ошибка при поиске. Попробуйте позже.',
        { reply_markup: mainMenuKeyboard }
      );
    }
  }
  
  await next();
});

// Show search result
async function showSearchResult(ctx: BotContext, result: any) {
  const listing = result.listing;
  const scoreEmoji = result.matchScore >= 8.5 ? '🔥' : result.matchScore >= 7 ? '✅' : '👍';
  
  let message = `${scoreEmoji} <b>Match Score: ${result.matchScore.toFixed(1)}/10</b>\n\n`;
  message += `<b>${listing.title}</b>\n`;
  message += `📍 ${listing.address}\n`;
  message += `💰 ${formatPrice(listing.price)}\n`;
  message += `🏠 ${listing.rooms} комн., ${formatArea(listing.area)}\n`;
  message += `🏢 ${listing.floor}/${listing.totalFloors} этаж\n`;
  
  if (listing.isNewBuilding) {
    message += `🏗 Новостройка${listing.stage ? ` (${listing.stage})` : ''}\n`;
    if (listing.developer) {
      message += `👷 Застройщик: ${listing.developer}\n`;
    }
  }
  
  message += `\n<b>Почему подходит:</b>\n${result.explanation}\n`;
  
  message += `\n<b>Оценка по факторам:</b>\n`;
  for (const [factor, score] of Object.entries(result.breakdown)) {
    if (score !== undefined && score !== null) {
      const factorNames: Record<string, string> = {
        transport: '🚇 Транспорт',
        schools: '🏫 Школы',
        parks: '🌳 Парки',
        parking: '🚗 Парковка',
        price: '💰 Цена',
        metro: '🚇 Метро',
      };
      message += `${factorNames[factor] || factor}: ${(score as number).toFixed(1)}/10\n`;
    }
  }

  // Send photo if available
  if (listing.photos && listing.photos.length > 0) {
    await ctx.replyWithPhoto(listing.photos[0], {
      caption: message,
      parse_mode: 'HTML',
      reply_markup: resultActionsKeyboard,
    });
  } else {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: resultActionsKeyboard,
    });
  }
}

// Settings callback
bot.callbackQuery('settings', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply('⚙️ Настройки находятся в разработке');
});

// My queries callback
bot.callbackQuery('my_queries', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply('📋 Ваши сохраненные запросы находятся в разработке');
});

// Start bot
async function start() {
  console.log('Starting bot...');
  
  // Set bot commands
  await bot.api.setMyCommands([
    { command: 'start', description: 'Начать работу с ботом' },
    { command: 'search', description: 'Новый поиск' },
    { command: 'queries', description: 'Мои запросы' },
    { command: 'settings', description: 'Настройки' },
    { command: 'help', description: 'Помощь' },
  ]);

  // Start polling
  bot.start({
    onStart: () => console.log('Bot started successfully'),
  });
}

// Handle graceful shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());

// Start the bot
start().catch(console.error);