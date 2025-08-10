import { prisma } from '@real-estate-bot/database';
import { Click } from '@real-estate-bot/shared';

interface PartnerConversion {
  id: string;
  userId: string;
  listingId: string;
  partnerId: string;
  trackingId: string;
  status: 'pending' | 'approved' | 'rejected';
  amount?: number;
  commission?: number;
  clickedAt: Date;
  convertedAt?: Date;
  metadata?: Record<string, any>;
}

export class MonetizationService {
  // Трекинг клика с генерацией партнерской ссылки
  async trackPartnerClick(
    userId: string,
    listingId: string,
    partnerId: string,
    source: 'bot' | 'webapp'
  ): Promise<string> {
    // Сохраняем клик в БД
    const click = await prisma.click.create({
      data: {
        userId,
        listingId,
        source,
        meta: {
          partnerId,
          timestamp: new Date().toISOString()
        }
      }
    });

    // Генерируем tracking ID для партнера
    const trackingId = this.generateTrackingId(click.id);
    
    // Сохраняем конверсию в pending статусе
    await this.createPendingConversion({
      userId,
      listingId,
      partnerId,
      trackingId,
      clickId: click.id
    });

    return trackingId;
  }

  // Создание записи о потенциальной конверсии
  private async createPendingConversion(data: {
    userId: string;
    listingId: string;
    partnerId: string;
    trackingId: string;
    clickId: string;
  }): Promise<void> {
    // В реальной БД это была бы отдельная таблица
    // Сейчас сохраняем в meta данные клика
    await prisma.click.update({
      where: { id: data.clickId },
      data: {
        meta: {
          partnerId: data.partnerId,
          trackingId: data.trackingId,
          conversionStatus: 'pending',
          createdAt: new Date().toISOString()
        }
      }
    });
  }

  // Проверка статуса конверсий
  async checkConversions(): Promise<void> {
    const pendingClicks = await prisma.click.findMany({
      where: {
        meta: {
          path: ['conversionStatus'],
          equals: 'pending'
        }
      }
    });

    for (const click of pendingClicks) {
      const partnerId = click.meta?.partnerId as string;
      const trackingId = click.meta?.trackingId as string;
      
      if (!partnerId || !trackingId) continue;

      // Проверяем статус у партнера
      const status = await this.checkPartnerConversionStatus(partnerId, trackingId);
      
      if (status.status !== 'pending') {
        await this.updateConversionStatus(click.id, status);
      }
    }
  }

  // Проверка статуса у конкретного партнера
  private async checkPartnerConversionStatus(
    partnerId: string,
    trackingId: string
  ): Promise<{
    status: 'pending' | 'approved' | 'rejected';
    amount?: number;
    commission?: number;
  }> {
    // Здесь должна быть интеграция с API партнера
    // Для примера возвращаем mock данные
    
    // Симулируем проверку через случайное время
    const clickAge = Math.random() * 30; // дней
    
    if (clickAge < 7) {
      return { status: 'pending' };
    } else if (Math.random() > 0.3) {
      return {
        status: 'approved',
        amount: 10000000 + Math.random() * 20000000,
        commission: 50000 + Math.random() * 200000
      };
    } else {
      return { status: 'rejected' };
    }
  }

  // Обновление статуса конверсии
  private async updateConversionStatus(
    clickId: string,
    status: {
      status: 'approved' | 'rejected';
      amount?: number;
      commission?: number;
    }
  ): Promise<void> {
    await prisma.click.update({
      where: { id: clickId },
      data: {
        meta: {
          conversionStatus: status.status,
          amount: status.amount,
          commission: status.commission,
          updatedAt: new Date().toISOString()
        }
      }
    });

    // Если конверсия подтверждена, можно начислить бонусы пользователю
    if (status.status === 'approved' && status.commission) {
      const click = await prisma.click.findUnique({
        where: { id: clickId }
      });
      
      if (click) {
        await this.creditUserBonus(click.userId, status.commission);
      }
    }
  }

  // Начисление бонусов пользователю (если есть реферальная программа)
  private async creditUserBonus(userId: string, commission: number): Promise<void> {
    // Например, 10% от комиссии идет пользователю
    const userBonus = commission * 0.1;
    
    // Обновляем баланс пользователя
    await prisma.user.update({
      where: { id: userId },
      data: {
        meta: {
          balance: {
            increment: userBonus
          },
          totalEarned: {
            increment: userBonus
          }
        }
      }
    });
  }

  // Генерация уникального tracking ID
  private generateTrackingId(clickId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `${timestamp}-${random}-${clickId.substring(0, 8)}`;
  }

  // Получение статистики по монетизации
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

    for (const click of clicks) {
      const partnerId = click.meta?.partnerId as string;
      const status = click.meta?.conversionStatus as string;
      const commission = click.meta?.commission as number || 0;

      if (!stats.byPartner[partnerId]) {
        stats.byPartner[partnerId] = {
          clicks: 0,
          conversions: 0,
          revenue: 0
        };
      }

      stats.byPartner[partnerId].clicks++;

      if (status === 'approved') {
        stats.totalConversions++;
        stats.totalRevenue += commission;
        stats.byPartner[partnerId].conversions++;
        stats.byPartner[partnerId].revenue += commission;
      }
    }

    stats.conversionRate = stats.totalClicks > 0 
      ? (stats.totalConversions / stats.totalClicks) * 100 
      : 0;
    
    stats.averageCommission = stats.totalConversions > 0
      ? stats.totalRevenue / stats.totalConversions
      : 0;

    return stats;
  }

  // Получение фильтра по дате
  private getDateFilter(period: 'day' | 'week' | 'month' | 'all') {
    if (period === 'all') return {};

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
        gte: startDate
      }
    };
  }

  // Получение топ конвертирующих объектов
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

      if (click.meta?.conversionStatus === 'approved') {
        listingStats[listingId].conversions++;
        listingStats[listingId].revenue += click.meta?.commission || 0;
      }
    }

    // Считаем conversion rate и сортируем
    const listings = Object.values(listingStats)
      .map(stat => ({
        ...stat,
        conversionRate: stat.clicks > 0 
          ? (stat.conversions / stat.clicks) * 100 
          : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return listings;
  }
}

export const monetizationService = new MonetizationService();