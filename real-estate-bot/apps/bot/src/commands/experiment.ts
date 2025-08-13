import { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';

export async function experimentCommand(ctx: Context) {
  const keyboard = new InlineKeyboard()
    .text('🔬 Тест модели', 'exp_test')
    .text('⚖️ Сравнить модели', 'exp_compare');

  await ctx.reply(
    '🧪 Эксперименты с LLM',
    {
      reply_markup: keyboard
    }
  );
}