import { InlineKeyboard } from 'grammy';

// Main menu keyboard
export const mainMenuKeyboard = new InlineKeyboard()
  .text('🏠 Найти жилье', 'search_life')
  .text('💰 Инвестиции', 'search_invest')
  .row()
  .text('📋 Мои запросы', 'my_queries')
  .text('⚙️ Настройки', 'settings');

// Mode selection keyboard
export const modeSelectionKeyboard = new InlineKeyboard()
  .text('🏠 Для жизни', 'mode_life')
  .row()
  .text('💰 Для инвестиций', 'mode_invest')
  .row()
  .text('↩️ Назад', 'back_to_menu');

// Yes/No keyboard
export const yesNoKeyboard = new InlineKeyboard()
  .text('✅ Да', 'yes')
  .text('❌ Нет', 'no');

// Skip keyboard
export const skipKeyboard = new InlineKeyboard()
  .text('⏭ Пропустить', 'skip');

// Transport mode keyboard
export const transportModeKeyboard = new InlineKeyboard()
  .text('🚗 На машине', 'transport_car')
  .row()
  .text('🚇 Общественный', 'transport_public')
  .row()
  .text('🚶 Пешком', 'transport_walk');

// Rooms selection keyboard
export const roomsKeyboard = new InlineKeyboard()
  .text('Студия', 'rooms_0')
  .text('1', 'rooms_1')
  .text('2', 'rooms_2')
  .row()
  .text('3', 'rooms_3')
  .text('4', 'rooms_4')
  .text('5+', 'rooms_5')
  .row()
  .text('✅ Готово', 'rooms_done');

// Importance scale keyboard (1-10)
export function createImportanceKeyboard(factor: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  // First row: 1-5
  for (let i = 1; i <= 5; i++) {
    keyboard.text(i.toString(), `importance_${factor}_${i}`);
  }
  keyboard.row();
  
  // Second row: 6-10
  for (let i = 6; i <= 10; i++) {
    keyboard.text(i.toString(), `importance_${factor}_${i}`);
  }
  
  return keyboard;
}

// Result actions keyboard
export const resultActionsKeyboard = new InlineKeyboard()
  .text('👍 Подходит', 'result_like')
  .text('👎 Не подходит', 'result_dislike')
  .row()
  .text('➡️ Следующий', 'result_next')
  .text('📱 В приложении', 'result_app')
  .row()
  .text('🔔 Отслеживать', 'enable_monitoring')
  .text('↩️ В меню', 'back_to_menu');

// Feedback reasons keyboard
export const feedbackReasonsKeyboard = new InlineKeyboard()
  .text('💸 Дорого', 'feedback_expensive')
  .text('📍 Далеко', 'feedback_far')
  .row()
  .text('🏗 Стадия стройки', 'feedback_stage')
  .text('🏢 Этаж', 'feedback_floor')
  .row()
  .text('📐 Площадь', 'feedback_area')
  .text('🏘 Район', 'feedback_district')
  .row()
  .text('💬 Другое', 'feedback_other')
  .text('⏭ Пропустить', 'feedback_skip');

// Settings keyboard
export const settingsKeyboard = new InlineKeyboard()
  .text('🔄 Изменить предпочтения', 'edit_preferences')
  .row()
  .text('🔔 Уведомления', 'notification_settings')
  .row()
  .text('🗑 Удалить данные', 'delete_data')
  .row()
  .text('↩️ Назад', 'back_to_menu');

// Helper to create pagination keyboard
export function createPaginationKeyboard(current: number, total: number, prefix: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  if (current > 0) {
    keyboard.text('⬅️', `${prefix}_prev`);
  }
  
  keyboard.text(`${current + 1}/${total}`, `${prefix}_page`);
  
  if (current < total - 1) {
    keyboard.text('➡️', `${prefix}_next`);
  }
  
  return keyboard;
}