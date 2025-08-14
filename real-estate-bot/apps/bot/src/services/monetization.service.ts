import { prisma } from '@real-estate-bot/database';

export class MonetizationService {
  // Трекинг клика с генерацией партнерской ссылки
  async trackPartnerClick(
    userId: string,
    listingId: string,
    _partnerId: string,
    source: 'bot' | 'webapp'
  ): Promise<string> {
    // Сохраняем клик в БД (без meta — схема Click не содержит дополнительных полей)
    const click = await prisma.click.create({
      data: {
        userId,
        listingId,
        source,
        url: `/listing/${listingId}`,
      }
    });

    // Генерируем tracking ID для партнера (возвращаем клиенту)
    const trackingId = this.generateTrackingId(click.id);

    // В текущей схеме не сохраняем pending conversion; партнёр будет дергать постбэк на API
    return trackingId;
  }

  // Проверка статуса конверсий (заглушка)
  async checkConversions(): Promise<void> {
    // Нет хранилища конверсий в схеме — ничего не делаем
    return;
  }

  // Генерация уникального tracking ID
  private generateTrackingId(clickId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `${timestamp}-${random}-${clickId.substring(0, 8)}`;
  }

  // Получение статистики по монетизации (по кликам)
  async getMonetizationStats(period: 'day' | 'week' | 'month' | 'all'): Promise<{
    totalClicks: number;
    totalConversions: number;
    conversionRate: number;
    totalRevenue: number;
    averageCommission: number;
    byPartner: Record<string, {
      clicks: number;
      conversions: number;
      revenue: number;
    }>;
  }> {
    const dateFilter = this.getDateFilter(period);

    const clicks = await prisma.click.findMany({
      where: dateFilter
    });

    const stats = {
      totalClicks: clicks.length,
      totalConversions: 0,
      conversionRate: 0,
      totalRevenue: 0,
      averageCommission: 0,
      byPartner: {} as Record<string, any>
    };

    // В текущей схеме нет partnerId/commission — группируем по source
    for (const click of clicks) {
      const key = click.source || 'unknown';
      if (!stats.byPartner[key]) {
        stats.byPartner[key] = { clicks: 0, conversions: 0, revenue: 0 };
      }
      stats.byPartner[key].clicks++;
    }

    return stats as any;
  }

  // Получение фильтра по дате
  private getDateFilter(period: 'day' | 'week' | 'month' | 'all') {
    if (period === 'all') return {} as any;

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    return {
      timestamp: {
        gte: startDate!
      }
    } as any;
  }

  // Топ карточек по кликам
  async getTopConvertingListings(limit: number = 10): Promise<Array<{
    listingId: string;
    clicks: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
  }>> {
    const clicks = await prisma.click.findMany();

    const listingStats: Record<string, any> = {};

    for (const click of clicks) {
      const listingId = click.listingId;

      if (!listingStats[listingId]) {
        listingStats[listingId] = {
          listingId,
          clicks: 0,
          conversions: 0,
          revenue: 0
        };
      }

      listingStats[listingId].clicks++;
    }

    const listings = Object.values(listingStats)
      .map((stat: any) => ({
        ...stat,
        conversionRate: 0
      }))
      .sort((a: any, b: any) => b.clicks - a.clicks)
      .slice(0, limit);

    return listings as any;
  }
}

export const monetizationService = new MonetizationService();