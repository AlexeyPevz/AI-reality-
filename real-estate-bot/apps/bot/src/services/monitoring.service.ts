import { prisma } from '@real-estate-bot/database';
import { ProviderFactory } from '@real-estate-bot/providers';
import { Subscription, User, Preferences, Listing } from '@real-estate-bot/shared';
import { searchService } from './search.service';
import { Bot } from 'grammy';
import { formatPrice } from '@real-estate-bot/shared';

export class MonitoringService {
  constructor(private bot: Bot) {}

  // Проверка новых объектов для всех активных подписок
  async checkAllSubscriptions(): Promise<void> {
    console.log('Starting subscription check...');
    
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        active: true,
        notificationsEnabled: true
      },
      include: {
        user: true,
        preferences: true
      }
    });

    console.log(`Found ${activeSubscriptions.length} active subscriptions`);

    for (const subscription of activeSubscriptions) {
      try {
        await this.checkSubscription(subscription);
      } catch (error) {
        console.error(`Error checking subscription ${subscription.id}:`, error);
      }
    }
  }

  // Проверка новых объектов для одной подписки
  private async checkSubscription(subscription: any): Promise<void> {
    const { user, preferences } = subscription;
    
    if (!preferences) {
      console.log(`No preferences for subscription ${subscription.id}`);
      return;
    }

    // Получаем последнюю проверку
    const lastCheckKey = `last_check_${subscription.id}`;
    const lastCheck = subscription.lastChecked || new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Ищем новые объекты
    const results = await searchService.searchWithScore(
      preferences,
      user.id,
      20 // Максимум объектов для проверки
    );

    // Фильтруем только новые объекты с хорошим score
    const newListings = results.filter(result => {
      const isNew = result.listing.publishedAt > lastCheck;
      const hasGoodScore = result.matchScore >= (subscription.minScore || 7.0);
      return isNew && hasGoodScore;
    });

    if (newListings.length > 0) {
      await this.sendNotifications(user, newListings, subscription);
    }

    // Обновляем время последней проверки
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { lastChecked: new Date() }
    });
  }

  // Отправка уведомлений пользователю
  private async sendNotifications(
    user: User,
    listings: Array<{ listing: Listing; matchScore: number; explanation: string }>,
    subscription: Subscription
  ): Promise<void> {
    const count = Math.min(listings.length, 3); // Максимум 3 объекта в уведомлении
    const topListings = listings.slice(0, count);

    let message = `🔔 <b>Новые объекты по вашему запросу!</b>\n\n`;
    
    for (const { listing, matchScore, explanation } of topListings) {
      message += `🏠 <b>${listing.title}</b>\n`;
      message += `💰 ${formatPrice(listing.price)}\n`;
      message += `📍 ${listing.district}`;
      if (listing.metro) {
        message += ` • ${listing.metro}`;
      }
      message += `\n`;
      message += `⭐ Оценка: ${matchScore.toFixed(1)}/10\n`;
      
      // Краткое объяснение
      const shortExplanation = explanation.split('.')[0] + '.';
      message += `💡 ${shortExplanation}\n`;
      
      // Ссылка на объект
      if (listing.url) {
        message += `\n<a href="${listing.url}">Посмотреть объект</a>\n`;
      }
      message += '\n---\n\n';
    }

    if (listings.length > count) {
      message += `\nИ еще ${listings.length - count} объектов!\n`;
    }

    message += `\n<a href="${process.env.MINI_APP_URL}">Открыть все в Mini App</a>`;

    try {
      await this.bot.api.sendMessage(user.tgId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      // Сохраняем отправленные уведомления
      for (const { listing } of topListings) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            subscriptionId: subscription.id,
            listingId: listing.id,
            type: 'new_listing',
            message: message.substring(0, 500), // Сохраняем первые 500 символов
            sentAt: new Date()
          }
        });
      }
    } catch (error) {
      console.error(`Failed to send notification to user ${user.tgId}:`, error);
    }
  }

  // Создание подписки для пользователя
  async createSubscription(
    userId: string,
    preferencesId: string,
    settings?: {
      notificationsEnabled?: boolean;
      minScore?: number;
      maxPriceIncrease?: number;
    }
  ): Promise<Subscription> {
    return prisma.subscription.create({
      data: {
        userId,
        preferencesId,
        active: true,
        notificationsEnabled: settings?.notificationsEnabled ?? true,
        minScore: settings?.minScore ?? 7.0,
        maxPriceIncrease: settings?.maxPriceIncrease,
        createdAt: new Date()
      }
    });
  }

  // Обновление настроек подписки
  async updateSubscription(
    subscriptionId: string,
    settings: {
      active?: boolean;
      notificationsEnabled?: boolean;
      minScore?: number;
      maxPriceIncrease?: number;
    }
  ): Promise<Subscription> {
    return prisma.subscription.update({
      where: { id: subscriptionId },
      data: settings
    });
  }

  // Получение подписок пользователя
  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    return prisma.subscription.findMany({
      where: { userId },
      include: {
        preferences: true,
        notifications: {
          orderBy: { sentAt: 'desc' },
          take: 5
        }
      }
    });
  }

  // Удаление подписки
  async deleteSubscription(subscriptionId: string): Promise<void> {
    await prisma.subscription.delete({
      where: { id: subscriptionId }
    });
  }

  // Статистика по уведомлениям
  async getNotificationStats(userId: string): Promise<{
    totalSent: number;
    lastSent?: Date;
    byType: Record<string, number>;
  }> {
    const notifications = await prisma.notification.findMany({
      where: { userId }
    });

    const byType = notifications.reduce((acc, notif) => {
      acc[notif.type] = (acc[notif.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSent: notifications.length,
      lastSent: notifications[0]?.sentAt,
      byType
    };
  }
}

// Функция для запуска периодической проверки
export function startMonitoringJob(bot: Bot): void {
  const monitoringService = new MonitoringService(bot);
  
  // Проверяем каждые 2 часа
  const INTERVAL = 2 * 60 * 60 * 1000; // 2 hours
  
  // Первая проверка через 1 минуту после запуска
  setTimeout(() => {
    monitoringService.checkAllSubscriptions()
      .catch(error => console.error('Monitoring job error:', error));
  }, 60 * 1000);

  // Последующие проверки каждые 2 часа
  setInterval(() => {
    monitoringService.checkAllSubscriptions()
      .catch(error => console.error('Monitoring job error:', error));
  }, INTERVAL);

  console.log('Background monitoring started (checking every 2 hours)');
}