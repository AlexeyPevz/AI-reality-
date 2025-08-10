import { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { leadService } from '../services/lead.service';
import { leadDistribution } from '../services/lead-distribution.service';
import { formatPrice } from '@real-estate-bot/shared';

export async function leadsCommand(ctx: Context) {
  // Только для админов
  const adminIds = process.env.ADMIN_IDS?.split(',') || [];
  if (!adminIds.includes(ctx.from?.id.toString() || '')) {
    await ctx.reply('У вас нет доступа к этой команде');
    return;
  }

  const keyboard = new InlineKeyboard()
    .text('📊 Статистика', 'leads_stats')
    .text('🔥 Горячие лиды', 'leads_hot')
    .row()
    .text('💰 Покупатели', 'leads_buyers')
    .text('💵 Доходы', 'leads_revenue');

  await ctx.reply(
    '💼 <b>Управление лидами</b>\n\n' +
    'Здесь вы можете просматривать и управлять лидами.',
    {
      parse_mode: 'HTML',
      reply_markup: keyboard
    }
  );
}

export async function handleLeadsCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  
  switch (data) {
    case 'leads_stats':
      await showLeadStats(ctx);
      break;
    case 'leads_hot':
      await showHotLeads(ctx);
      break;
    case 'leads_buyers':
      await showBuyers(ctx);
      break;
    case 'leads_revenue':
      await showRevenue(ctx);
      break;
  }
  
  await ctx.answerCallbackQuery();
}

async function showLeadStats(ctx: Context) {
  const stats = await leadService.getLeadStats();
  
  const message = `📊 <b>Статистика лидов</b>\n\n` +
    `Всего лидов: <b>${stats.total}</b>\n\n` +
    `<b>По качеству:</b>\n` +
    `🔥 Горячие: ${stats.byQuality.hot}\n` +
    `🌡 Теплые: ${stats.byQuality.warm}\n` +
    `❄️ Холодные: ${stats.byQuality.cold}\n\n` +
    `<b>По статусу:</b>\n` +
    `🆕 Новые: ${stats.byStatus.new}\n` +
    `✅ Квалифицированные: ${stats.byStatus.qualified}\n` +
    `📞 В работе: ${stats.byStatus.contacted}\n` +
    `💰 Проданные: ${stats.byStatus.sold}\n` +
    `❌ Отклоненные: ${stats.byStatus.rejected}\n\n` +
    `<b>Финансы:</b>\n` +
    `💵 Общий доход: ${formatPrice(stats.totalRevenue)}\n` +
    `💰 Средняя цена лида: ${formatPrice(stats.avgLeadPrice)}`;

  await ctx.reply(message, { parse_mode: 'HTML' });
}

async function showHotLeads(ctx: Context) {
  const hotLeads = await leadService.getHotLeads(10);
  
  if (hotLeads.length === 0) {
    await ctx.reply('🔥 Нет горячих лидов');
    return;
  }

  let message = '🔥 <b>Горячие лиды (топ 10)</b>\n\n';
  
  for (const lead of hotLeads) {
    const potentialRevenue = leadDistribution.calculatePotentialRevenue(lead);
    
    message += `<b>Лид #${lead.id}</b>\n`;
    message += `📊 Score: ${lead.score}/100\n`;
    message += `💰 Бюджет: ${formatPrice(lead.budget.min || 0)} - ${formatPrice(lead.budget.max || 0)}\n`;
    message += `📍 Локации: ${lead.locations.join(', ')}\n`;
    message += `🏠 Комнат: ${lead.rooms?.join(', ') || 'любое'}\n`;
    message += `📱 Телефон: ${lead.phone ? '✅' : '❌'}\n`;
    message += `💵 Потенциал: ${formatPrice(potentialRevenue)}\n`;
    message += `⏰ Активность: ${new Date(lead.lastActivity).toLocaleDateString()}\n\n`;
  }

  const keyboard = new InlineKeyboard()
    .text('📤 Экспорт CSV', 'leads_export_hot')
    .text('🔄 Распределить все', 'leads_distribute_all');

  await ctx.reply(message, { 
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

async function showBuyers(ctx: Context) {
  const buyerStats = leadDistribution.getBuyerStats();
  
  let message = '💼 <b>Покупатели лидов</b>\n\n';
  
  for (const stat of buyerStats) {
    const buyer = stat.buyer;
    
    message += `<b>${buyer.name}</b> (${buyer.type})\n`;
    message += `💰 Цены: 🔥${formatPrice(buyer.pricePerLead.hot)} | `;
    message += `🌡${formatPrice(buyer.pricePerLead.warm)} | `;
    message += `❄️${formatPrice(buyer.pricePerLead.cold)}\n`;
    message += `📊 Использование:\n`;
    message += `  День: ${stat.utilizationDaily.toFixed(0)}% (${buyer.currentDaily}/${buyer.dailyLimit || '∞'})\n`;
    message += `  Месяц: ${stat.utilizationMonthly.toFixed(0)}% (${buyer.currentMonthly}/${buyer.monthlyLimit || '∞'})\n`;
    message += `✅ Активен: ${buyer.active ? 'Да' : 'Нет'}\n\n`;
  }

  await ctx.reply(message, { parse_mode: 'HTML' });
}

async function showRevenue(ctx: Context) {
  const stats = await leadService.getLeadStats();
  
  // Расчет потенциального дохода
  const hotLeads = await leadService.getHotLeads(100);
  let potentialRevenue = 0;
  
  for (const lead of hotLeads) {
    if (lead.status === 'new' || lead.status === 'qualified') {
      potentialRevenue += leadDistribution.calculatePotentialRevenue(lead);
    }
  }

  const message = `💰 <b>Доходы от лидов</b>\n\n` +
    `<b>Реализованный доход:</b>\n` +
    `💵 Всего: ${formatPrice(stats.totalRevenue)}\n` +
    `📊 Продано лидов: ${stats.byStatus.sold}\n` +
    `💰 Средний чек: ${formatPrice(stats.avgLeadPrice)}\n\n` +
    `<b>Потенциальный доход:</b>\n` +
    `🔥 Горячих лидов: ${stats.byQuality.hot - stats.byStatus.sold}\n` +
    `💎 Потенциал: ${formatPrice(potentialRevenue)}\n\n` +
    `<b>Прогноз на месяц:</b>\n` +
    `📈 При текущем темпе: ${formatPrice(stats.totalRevenue * 30 / new Date().getDate())}`;

  await ctx.reply(message, { parse_mode: 'HTML' });
}

// Обработка экспорта и распределения
export async function handleLeadActions(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  
  switch (data) {
    case 'leads_export_hot':
      await ctx.reply('📤 Функция экспорта в разработке');
      break;
      
    case 'leads_distribute_all':
      await distributeAllHotLeads(ctx);
      break;
  }
  
  await ctx.answerCallbackQuery();
}

async function distributeAllHotLeads(ctx: Context) {
  await ctx.reply('🔄 Начинаю распределение горячих лидов...');
  
  const hotLeads = await leadService.getHotLeads(50);
  let distributed = 0;
  let totalRevenue = 0;
  
  for (const lead of hotLeads) {
    if (lead.status === 'new' || lead.status === 'qualified') {
      const result = await leadDistribution.distributeLead(lead);
      
      if (result.distributed) {
        distributed++;
        totalRevenue += result.price || 0;
      }
    }
  }
  
  await ctx.reply(
    `✅ <b>Распределение завершено</b>\n\n` +
    `📤 Распределено: ${distributed} лидов\n` +
    `💰 Общий доход: ${formatPrice(totalRevenue)}`,
    { parse_mode: 'HTML' }
  );
}