import { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { MonitoringService } from '../services/monitoring.service';
import { formatPrice } from '@real-estate-bot/shared';

export async function subscriptionsCommand(ctx: Context) {
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
  
  for (const sub of subscriptions) {
    const emoji = sub.active ? '✅' : '⏸';
    const status = sub.active ? 'Активна' : 'Приостановлена';
    const mode = sub.preferences?.mode === 'life' ? '🏠 Для жизни' : '💰 Инвестиции';
    
    message += `${emoji} <b>Подписка #${sub.id.slice(-6)}</b>\n`;
    message += `${mode}\n`;
    message += `📊 Мин. оценка: ${sub.minScore}/10\n`;
    
    if (sub.preferences) {
      const pref = sub.preferences;
      if (pref.budgetMax) {
        message += `💰 Бюджет: до ${formatPrice(pref.budgetMax)}\n`;
      }
      if (pref.districts?.length) {
        message += `📍 Районы: ${pref.districts.slice(0, 3).join(', ')}`;
        if (pref.districts.length > 3) {
          message += ` +${pref.districts.length - 3}`;
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

export async function handleSubscriptionCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;
  
  const monitoringService = new MonitoringService(ctx.api as any);
  
  if (data.startsWith('sub_toggle_')) {
    const subscriptionId = data.replace('sub_toggle_', '');
    const sub = await ctx.session.storage.getSubscription(subscriptionId);
    
    if (sub) {
      await monitoringService.updateSubscription(subscriptionId, {
        active: !sub.active
      });
      
      await ctx.answerCallbackQuery(
        sub.active ? 'Подписка приостановлена' : 'Подписка активирована'
      );
      
      // Обновляем сообщение
      await subscriptionsCommand(ctx);
    }
  } else if (data.startsWith('sub_settings_')) {
    const subscriptionId = data.replace('sub_settings_', '');
    await showSubscriptionSettings(ctx, subscriptionId);
  } else if (data === 'sub_create') {
    await ctx.reply(
      'Для создания новой подписки:\n\n' +
      '1. Используйте команду /search\n' +
      '2. Пройдите интервью\n' +
      '3. После получения результатов включите уведомления',
      { parse_mode: 'HTML' }
    );
  }
  
  await ctx.answerCallbackQuery();
}

async function showSubscriptionSettings(ctx: Context, subscriptionId: string) {
  const monitoringService = new MonitoringService(ctx.api as any);
  const subs = await monitoringService.getUserSubscriptions(ctx.session.userId!);
  const sub = subs.find(s => s.id === subscriptionId);
  
  if (!sub) {
    await ctx.reply('Подписка не найдена');
    return;
  }
  
  const keyboard = new InlineKeyboard();
  
  // Настройки минимального score
  keyboard
    .text('📊 Мин. оценка: 6.0', `sub_score_${subscriptionId}_6.0`)
    .text('📊 Мин. оценка: 7.0', `sub_score_${subscriptionId}_7.0`)
    .text('📊 Мин. оценка: 8.0', `sub_score_${subscriptionId}_8.0`)
    .row();
  
  // Удаление подписки
  keyboard
    .text('🗑 Удалить подписку', `sub_delete_${subscriptionId}`)
    .row()
    .text('◀️ Назад', 'subscriptions');
  
  await ctx.reply(
    `⚙️ <b>Настройки подписки #${subscriptionId.slice(-6)}</b>\n\n` +
    `Текущая мин. оценка: ${sub.minScore}/10\n` +
    `Статус: ${sub.active ? 'Активна' : 'Приостановлена'}`,
    {
      parse_mode: 'HTML',
      reply_markup: keyboard
    }
  );
}

export async function createSubscriptionAfterSearch(ctx: Context, preferencesId: string) {
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

export async function handleNotificationToggle(ctx: Context) {
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