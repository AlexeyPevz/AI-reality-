import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types';

export async function offersCommand(ctx: BotContext) {
  const kb = new InlineKeyboard()
    .url('🏦 Ипотека', `${process.env.API_URL}/api/offers/redirect?type=mortgage&source=bot&uid=${ctx.from?.id}`)
    .row()
    .url('🛡️ Страховка', `${process.env.API_URL}/api/offers/redirect?type=insurance&source=bot&uid=${ctx.from?.id}`)
    .row()
    .url('⚖️ Юрпроверка', `${process.env.API_URL}/api/offers/redirect?type=legal&source=bot&uid=${ctx.from?.id}`)
    .row()
    .url('🔑 Аренда-партнер', `${process.env.API_URL}/api/offers/redirect?type=rent&source=bot&uid=${ctx.from?.id}`);

  await ctx.reply('Полезные сервисы для сделки:', { reply_markup: kb });
}