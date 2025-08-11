interface MarketInsights {
  trends: string[];
  imageUrl?: string;
  priceChange?: number;
  newListingsCount?: number;
  hotDistricts?: string[];
}

export async function getMarketInsights(): Promise<MarketInsights> {
  // В production здесь будет реальный API или аналитика
  // Сейчас возвращаем динамические mock данные
  
  const trends = [];
  const month = new Date().toLocaleDateString('ru-RU', { month: 'long' });
  const priceChange = Math.floor(Math.random() * 10) - 5; // -5% до +5%
  
  // Генерируем тренды
  if (priceChange < 0) {
    trends.push(`🔻 Цены снизились на ${Math.abs(priceChange)}% за ${month}`);
    trends.push(`⏰ Отличное время для покупки!`);
  } else if (priceChange > 0) {
    trends.push(`🔺 Цены выросли на ${priceChange}% за ${month}`);
    trends.push(`📈 Рынок активно растет`);
  } else {
    trends.push(`➡️ Цены стабильны в ${month}`);
  }
  
  // Добавляем сезонные тренды
  const currentMonth = new Date().getMonth();
  if (currentMonth >= 2 && currentMonth <= 4) { // Весна
    trends.push(`🌸 Весенний сезон - больше предложений`);
  } else if (currentMonth >= 5 && currentMonth <= 7) { // Лето
    trends.push(`☀️ Летний сезон - время сделок`);
  } else if (currentMonth >= 8 && currentMonth <= 10) { // Осень
    trends.push(`🍂 Осенний пик активности`);
  } else { // Зима
    trends.push(`❄️ Зимние скидки от застройщиков`);
  }
  
  // Случайный горячий район
  const hotDistricts = ['Москва-Сити', 'Юго-Запад', 'Хорошево-Мневники', 'Раменки', 'Хамовники'];
  const randomDistrict = hotDistricts[Math.floor(Math.random() * hotDistricts.length)];
  trends.push(`🔥 ${randomDistrict} - самый популярный район`);
  
  return {
    trends,
    priceChange,
    newListingsCount: 150 + Math.floor(Math.random() * 100),
    hotDistricts: [randomDistrict],
  };
}