import { InlineKeyboard } from 'grammy';
import { MonitoringService } from '../services/monitoring.service';
import { formatPrice } from '@real-estate-bot/shared';
import type { BotContext } from '../types';

export async function subscriptionsCommand(ctx: BotContext) {
  if (!ctx.from) return;
  
  const monitoringService = new MonitoringService(ctx.api as any);
  const subscriptions = await monitoringService.getUserSubscriptions(ctx.session.userId!);
  
  if (subscriptions.length === 0) {
    await ctx.reply(
      '📭 У вас пока нет активных подписок на новые объекты.\n\n' +
      'Создайте поисковый запрос через /search и включите уведомления!',
      { parse_mode: 'HTML' }
    );
    return;
  }

  let message = '🔔 <b>Ваши подписки на уведомления</b>\n\n';
  
  const keyboard = new InlineKeyboard();
  
  for (const sub of subscriptions as any[]) {
    const emoji = sub.active ? '✅' : '⏸';
    const mode = sub.preferences?.mode === 'life' ? '🏠 Для жизни' : '💰 Инвестиции';
    
    message += `${emoji} <b>Подписка #${sub.id.slice(-6)}</b>\n`;
    message += `${mode}\n`;
    message += `📊 Мин. оценка: ${sub.minScore}/10\n`;
    
    if (sub.preferences) {
      const pref = sub.preferences;
      if (pref.budgetMax) {
        message += `💰 Бюджет: до ${formatPrice(pref.budgetMax)}\n`;
      }
      if ((pref as any).districts?.length) {
        const districts = (pref as any).districts as string[];
        message += `📍 Районы: ${districts.slice(0, 3).join(', ')}`;
        if (districts.length > 3) {
          message += ` +${districts.length - 3}`;
        }
        message += '\n';
      }
    }
    
    if (sub.lastChecked) {
      const lastCheck = new Date(sub.lastChecked);
      const hoursAgo = Math.floor((Date.now() - lastCheck.getTime()) / (1000 * 60 * 60));
      message += `⏰ Проверка: ${hoursAgo}ч назад\n`;
    }
    
    message += '\n';
    
    // Кнопки управления
    keyboard
      .text(
        sub.active ? `⏸ Приостановить #${sub.id.slice(-6)}` : `▶️ Активировать #${sub.id.slice(-6)}`,
        `sub_toggle_${sub.id}`
      )
      .text(`⚙️ Настройки #${sub.id.slice(-6)}`, `sub_settings_${sub.id}`)
      .row();
  }
  
  keyboard.text('➕ Создать новую подписку', 'sub_create');
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

export async function handleSubscriptionCallback(ctx: BotContext) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;
  
  const monitoringService = new MonitoringService(ctx.api as any);
  
  if (data.startsWith('sub_toggle_')) {
    const id = data.replace('sub_toggle_', '');
    const subs = await monitoringService.getUserSubscriptions(ctx.session.userId!);
    const sub = subs.find(s => s.id === id);
    if (!sub) return;
    await monitoringService.updateSubscription(id, { active: !sub.active });
    await ctx.answerCallbackQuery(`Статус: ${!sub.active ? 'Активна' : 'Приостановлена'}`);
  }
}

export async function createSubscriptionAfterSearch(ctx: BotContext, preferencesId: string) {
  const keyboard = new InlineKeyboard()
    .text('🔔 Включить уведомления', `enable_notifications_${preferencesId}`)
    .text('❌ Не надо', 'close');
  
  await ctx.reply(
    '💡 <b>Хотите получать уведомления о новых объектах?</b>\n\n' +
    'Я буду проверять новые объявления каждые 2 часа и присылать вам самые подходящие варианты (оценка 7.0+).\n\n' +
    'Вы сможете в любой момент отключить уведомления через команду /subscriptions',
    {
      parse_mode: 'HTML',
      reply_markup: keyboard
    }
  );
}

export async function handleNotificationToggle(ctx: BotContext) {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('enable_notifications_')) return;
  
  const preferencesId = data.replace('enable_notifications_', '');
  const monitoringService = new MonitoringService(ctx.api as any);
  
  try {
    await monitoringService.createSubscription(
      ctx.session.userId!,
      preferencesId,
      {
        notificationsEnabled: true,
        minScore: 7.0
      }
    );
    
    await ctx.answerCallbackQuery('✅ Уведомления включены!');
    await ctx.editMessageText(
      '✅ <b>Уведомления включены!</b>\n\n' +
      'Теперь вы будете получать сообщения о новых подходящих объектах.\n\n' +
      'Управление подписками: /subscriptions',
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('Error creating subscription:', error);
    await ctx.answerCallbackQuery('❌ Произошла ошибка');
  }
}