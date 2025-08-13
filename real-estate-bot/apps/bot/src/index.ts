import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { RedisAdapter } from '@grammyjs/storage-redis';
import Redis from 'ioredis';
import { config } from './config';
import { BotContext, SessionData, CONVERSATIONS } from './types';
import { mainInterview } from './conversations/main-interview';
import { quickInterview } from './conversations/quick-interview';
import { UserService } from './services/user.service';
import { PreferencesService } from './services/preferences.service';
import { mainMenuKeyboard, resultActionsKeyboard, quickStartKeyboard } from './utils/keyboards';
import { searchAndScoreListings } from './services/search.service';
import { formatPrice, formatArea } from '@real-estate-bot/shared';
import { getMarketInsights } from './services/market.service';
import { analytics } from './services/analytics.service';
import { startMonitoringJob } from './services/monitoring.service';
import { subscriptionsCommand, handleSubscriptionCallback, handleNotificationToggle } from './commands/subscriptions';
import { demoCommand, handleDemoSelection, handleDemoActions } from './commands/demo';
import { InlineKeyboard } from 'grammy';

// Create bot instance
const bot = new Bot<BotContext>(config.botToken);

// Setup Redis storage for sessions
const redis = new Redis(config.redisUrl);
const storage = new RedisAdapter({ instance: redis });

// Install session middleware
bot.use(
	session({
		initial: (): SessionData => ({
			weights: { price: 1, transport: 1 },
			commutePoints: [],
			locations: [],
		}),
		storage,
	})
);

// Install conversations plugin
bot.use(conversations());

// Register conversations
bot.use(createConversation(mainInterview, CONVERSATIONS.MAIN_INTERVIEW));
bot.use(createConversation(quickInterview, 'quickInterview'));

// Error handler
bot.catch((err) => {
	console.error('Bot error:', err);
});

// Start command with market insights
bot.command('start', async (ctx) => {
	// Ensure user exists in database
	const user = await UserService.findOrCreate(ctx.from!.id);
	ctx.session.userId = user.id;
	ctx.session.user = user;

	// Track bot start
	analytics.trackBotStart(user.id);

	// Get market insights
	const insights = await getMarketInsights();

	await ctx.replyWithPhoto(insights.imageUrl || 'https://via.placeholder.com/800x400/2481cc/ffffff?text=Real+Estate+Bot', {
		caption: 
			`📊 <b>Рынок недвижимости сейчас:</b>\n\n` +
			`${insights.trends.map(t => t).join('\n')}\n\n` +
			`<b>Найдем квартиру, которая подходит именно вам!</b>\n\n` +
			`Как хотите искать?`,
		parse_mode: 'HTML',
		reply_markup: quickStartKeyboard
	});
});

// Handle menu navigation
bot.callbackQuery('back_to_menu', async (ctx) => {
	await ctx.answerCallbackQuery();
	await ctx.editMessageText(
		'📋 Главное меню\n\nВыберите действие:',
		{ reply_markup: mainMenuKeyboard }
	);
});

// Quick start callbacks
bot.callbackQuery('quick_search', async (ctx) => {
	await ctx.answerCallbackQuery();
	await ctx.conversation.enter('quickInterview');
});

bot.callbackQuery('detailed_search', async (ctx) => {
	await ctx.answerCallbackQuery();
	await ctx.conversation.enter(CONVERSATIONS.MAIN_INTERVIEW);
});

bot.callbackQuery('view_demo', async (ctx) => {
	await ctx.answerCallbackQuery();
	await ctx.reply(
		'👀 <b>Примеры подбора:</b>\n\n' +
		'1️⃣ <b>Молодая семья</b>\n' +
		'• Бюджет: 8 млн\n' +
		'• Приоритет: школы и парки\n' +
		'➜ Нашли 2-комн. в Юго-Западном с парком и 3 школами рядом\n\n' +
		'2️⃣ <b>IT-специалист</b>\n' +
		'• Бюджет: 12 млн\n' +
		'• Приоритет: близость к метро\n' +
		'➜ Нашли студию в 5 мин от метро с парковкой\n\n' +
		'3️⃣ <b>Инвестор</b>\n' +
		'• Бюджет: 15 млн\n' +
		'• Приоритет: ликвидность\n' +
		'➜ Нашли 1-комн. в Москва-Сити с доходностью 7%\n\n' +
		'Попробуйте сами! 👇',
		{ 
			parse_mode: 'HTML',
			reply_markup: quickStartKeyboard 
		}
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
			dealType: (ctx.session as any).dealType,
			rentDeposit: (ctx.session as any).rentDeposit,
			rentPeriod: (ctx.session as any).rentPeriod,
			furnished: (ctx.session as any).furnished,
			petsAllowed: (ctx.session as any).petsAllowed,
			utilitiesIncluded: (ctx.session as any).utilitiesIncluded,
		});

		// Perform search
		try {
			const results = await searchAndScoreListings(preferences as any);
			
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

// Show search result with wow effect for high scores
async function showSearchResult(ctx: BotContext, result: any, index: number = 0) {
	const listing = result.listing;
	const isFirstResult = index === 0;
	
	// Special effect for perfect matches
	if (result.matchScore >= 9.5 && isFirstResult) {
		await ctx.reply(
			'🎉 <b>НЕВЕРОЯТНО!</b>\n\n' +
			'Я нашел квартиру, которая подходит вам на <b>' + Math.round(result.matchScore * 10) + '%!</b>\n' +
			'Такое совпадение бывает крайне редко.\n\n' +
			'⚡ <i>Обычно на такие квартиры очередь - посмотрите скорее!</i>',
			{ parse_mode: 'HTML' }
		);
		// Small delay for dramatic effect
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
	
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
	
	// Add social proof for high-scoring properties
	if (result.matchScore >= 8) {
		const viewsToday = 20 + Math.floor(Math.random() * 80);
		const hoursAgo = Math.floor(Math.random() * 48);
		message += `\n👀 ${viewsToday} просмотров сегодня`;
		if (hoursAgo < 24) {
			message += ` • Последний показ ${hoursAgo} ч. назад`;
		}
		message += '\n';
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

	// Build offers keyboard (subtle)
	const offersKb = new InlineKeyboard();
	if ((listing.dealType || (ctx.session as any).dealType) !== 'rent') {
		offersKb.url('🏦 Ипотека', `${process.env.API_URL}/api/offers/redirect?type=mortgage&source=bot&uid=${ctx.from?.id}&listingId=${listing.id}`);
	} else {
		offersKb.url('🔎 Проверить аренду', `${process.env.API_URL}/api/offers/redirect?type=rent&source=bot&uid=${ctx.from?.id}&listingId=${listing.id}`);
	}
	offersKb.row().url('⚖️ Юрпроверка', `${process.env.API_URL}/api/offers/redirect?type=legal&source=bot&uid=${ctx.from?.id}&listingId=${listing.id}`);

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
	// Add subtle offers below
	await ctx.reply('Полезные сервисы (по желанию):', { reply_markup: offersKb });
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
		{ command: 'demo', description: '🎮 Демо-режим' },
		{ command: 'search', description: 'Новый поиск' },
		{ command: 'queries', description: 'Мои запросы' },
		{ command: 'subscriptions', description: 'Подписки на уведомления' },
		{ command: 'settings', description: 'Настройки' },
		{ command: 'help', description: 'Помощь' },
	]);

	// Register /subscriptions command
	bot.command('subscriptions', subscriptionsCommand);

	// Handle subscription callbacks
	bot.callbackQuery(/^sub_/, handleSubscriptionCallback);
	bot.callbackQuery(/^enable_notifications_/, handleNotificationToggle);
	
	// Register /demo command
	bot.command('demo', demoCommand);

	// Offers command
	const { offersCommand } = await import('./commands/offers');
	bot.command('offers', offersCommand);
	
	// Handle demo callbacks
	bot.callbackQuery(/^demo_/, handleDemoSelection);
	bot.callbackQuery(['start_real_search', 'demo_how_it_works'], handleDemoActions);

	// Start background monitoring
	startMonitoringJob(bot as any);

	// Start polling
	bot.start({
		onStart: () => {
			console.log('Bot started successfully');
			console.log('Background monitoring is active');
		},
	});
}

// Handle graceful shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());

// Start the bot
start().catch(console.error);