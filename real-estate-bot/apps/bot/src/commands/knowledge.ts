import { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { documentService } from '../services/document.service';
import { ragService } from '../services/rag.service';

export async function knowledgeCommand(ctx: Context) {
  const keyboard = new InlineKeyboard()
    .text('📚 Все документы', 'kb_list')
    .text('➕ Добавить FAQ', 'kb_add_faq')
    .row()
    .text('🔗 Добавить URL', 'kb_add_url')
    .text('🧪 Тест поиска', 'kb_test');

  await ctx.reply(
    '📚 <b>Управление базой знаний</b>\n\n' +
    'Здесь вы можете управлять документами и FAQ для улучшения ответов бота.',
    {
      parse_mode: 'HTML',
      reply_markup: keyboard
    }
  );
}

export async function handleKnowledgeCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  
  switch (data) {
    case 'kb_list':
      await listDocuments(ctx);
      break;
    case 'kb_add_faq':
      await ctx.reply('Отправьте FAQ в формате:\n\nВопрос: Ваш вопрос?\nОтвет: Ваш ответ');
      ctx.session.waitingFor = 'faq_input';
      break;
    case 'kb_add_url':
      await ctx.reply('Отправьте URL статьи или документа:');
      ctx.session.waitingFor = 'url_input';
      break;
    case 'kb_test':
      await ctx.reply('Задайте вопрос для поиска в базе знаний:');
      ctx.session.waitingFor = 'kb_query';
      break;
  }
  
  await ctx.answerCallbackQuery();
}

async function listDocuments(ctx: Context) {
  const docs = await documentService.getDocuments();
  
  if (docs.length === 0) {
    await ctx.reply('📭 База знаний пуста');
    return;
  }
  
  let message = '📚 <b>Документы в базе знаний:</b>\n\n';
  
  for (const doc of docs) {
    const chunksCount = await prisma.knowledgeDocument.count({
      where: { parentId: doc.id }
    });
    
    message += `📄 <b>${doc.title}</b>\n`;
    message += `   Тип: ${doc.type}\n`;
    message += `   Чанков: ${chunksCount}\n`;
    message += `   Добавлен: ${doc.createdAt.toLocaleDateString()}\n\n`;
  }
  
  await ctx.reply(message, { parse_mode: 'HTML' });
}

// Handle text input for knowledge base
export async function handleKnowledgeInput(ctx: Context) {
  const waitingFor = ctx.session.waitingFor;
  const text = ctx.message?.text;
  
  if (!waitingFor || !text) return false;
  
  switch (waitingFor) {
    case 'faq_input':
      await handleFAQInput(ctx, text);
      break;
    case 'url_input':
      await handleURLInput(ctx, text);
      break;
    case 'kb_query':
      await handleKBQuery(ctx, text);
      break;
    default:
      return false;
  }
  
  ctx.session.waitingFor = undefined;
  return true;
}

async function handleFAQInput(ctx: Context, text: string) {
  const match = text.match(/Вопрос:\s*(.+?)\nОтвет:\s*(.+)/s);
  
  if (!match) {
    await ctx.reply('❌ Неверный формат. Используйте:\n\nВопрос: ...\nОтвет: ...');
    return;
  }
  
  const [, question, answer] = match;
  
  try {
    await ragService.addFAQ(question.trim(), answer.trim());
    await ctx.reply('✅ FAQ успешно добавлен в базу знаний!');
  } catch (error) {
    await ctx.reply('❌ Ошибка при добавлении FAQ');
    console.error('FAQ add error:', error);
  }
}

async function handleURLInput(ctx: Context, url: string) {
  if (!url.startsWith('http')) {
    await ctx.reply('❌ Пожалуйста, отправьте корректный URL');
    return;
  }
  
  await ctx.reply('⏳ Загружаю и индексирую документ...');
  
  try {
    const doc = await documentService.ingestDocument({
      type: 'url',
      title: url,
      url: url
    });
    
    const chunksCount = await prisma.knowledgeDocument.count({
      where: { parentId: doc.id }
    });
    
    await ctx.reply(
      `✅ Документ успешно добавлен!\n\n` +
      `📄 ${doc.title}\n` +
      `📊 Создано чанков: ${chunksCount}`
    );
  } catch (error) {
    await ctx.reply('❌ Ошибка при загрузке документа');
    console.error('URL ingest error:', error);
  }
}

async function handleKBQuery(ctx: Context, query: string) {
  await ctx.reply('🔍 Ищу в базе знаний...');
  
  try {
    const response = await ragService.query({
      query,
      topK: 3
    });
    
    let message = '📊 <b>Результаты поиска:</b>\n\n';
    
    if (response.chunks.length === 0) {
      message += 'Ничего не найдено';
    } else {
      message += '<b>Найденные фрагменты:</b>\n';
      for (const chunk of response.chunks) {
        message += `\n📌 ${chunk.content.substring(0, 150)}...\n`;
        message += `   Релевантность: ${(chunk.similarity! * 100).toFixed(0)}%\n`;
      }
      
      message += '\n<b>Сгенерированный ответ:</b>\n';
      message += response.answer || 'Не удалось сгенерировать ответ';
      
      if (response.sources.length > 0) {
        message += '\n\n<b>Источники:</b>\n';
        for (const source of response.sources) {
          message += `• ${source.title}\n`;
        }
      }
    }
    
    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    await ctx.reply('❌ Ошибка при поиске');
    console.error('KB query error:', error);
  }
}

// Import prisma
import { prisma } from '@real-estate-bot/database';