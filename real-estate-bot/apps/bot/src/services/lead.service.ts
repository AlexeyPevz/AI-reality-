import { prisma } from '@real-estate-bot/database';
import { Lead, LeadQuality, LeadStatus } from '@real-estate-bot/shared';

export class LeadService {
  // Создание или обновление лида
  async createOrUpdateLead(userId: string): Promise<Lead> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        clicks: {
          orderBy: { timestamp: 'desc' },
          take: 10
        },
        recommendations: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!user) throw new Error('User not found');

    // Собираем данные для лида
    const preferences = user.preferences[0];
    const leadData = this.buildLeadData(user, preferences);
    
    // Рассчитываем скоринг
    const score = this.calculateLeadScore(user, preferences);
    const quality = this.determineQuality(score);

    // Создаем или обновляем лид в БД
    const existingLead = await this.findLeadByUserId(userId);
    
    if (existingLead) {
      return this.updateLead(existingLead.id, {
        ...leadData,
        score,
        quality,
        lastActivity: new Date()
      });
    } else {
      return this.createLead({
        userId,
        ...leadData,
        score,
        quality,
        status: 'new'
      });
    }
  }

  // Построение данных лида
  private buildLeadData(user: any, preferences: any): Partial<Lead> {
    return {
      phone: user.phone,
      name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      telegramUsername: user.username,
      budget: preferences ? {
        min: preferences.budgetMin,
        max: preferences.budgetMax
      } : {},
      locations: preferences?.districts || [],
      rooms: preferences?.rooms || [],
      area: preferences ? {
        min: preferences.areaMin,
        max: preferences.areaMax
      } : undefined,
      type: preferences?.propertyType || 'any',
      purpose: preferences?.mode || 'life',
      searchesCount: user.recommendations?.length || 0,
      viewedListings: user.clicks?.map((c: any) => c.listingId) || [],
      engagementScore: this.calculateEngagement(user)
    };
  }

  // Скоринг качества лида (0-100)
  private calculateLeadScore(user: any, preferences: any): number {
    let score = 0;

    // 1. Наличие контактов (20 баллов)
    if (user.phone) score += 15;
    if (user.firstName) score += 5;

    // 2. Четкость требований (30 баллов)
    if (preferences) {
      if (preferences.budgetMin && preferences.budgetMax) score += 10;
      if (preferences.districts?.length > 0) score += 10;
      if (preferences.rooms?.length > 0) score += 5;
      if (preferences.commutePoints?.length > 0) score += 5;
    }

    // 3. Активность (30 баллов)
    const daysSinceRegistration = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const searches = user.recommendations?.length || 0;
    const clicks = user.clicks?.length || 0;
    
    // Недавняя регистрация - хороший знак
    if (daysSinceRegistration <= 1) score += 10;
    else if (daysSinceRegistration <= 7) score += 5;
    
    // Количество поисков
    if (searches >= 3) score += 10;
    else if (searches >= 1) score += 5;
    
    // Клики по объявлениям
    if (clicks >= 5) score += 10;
    else if (clicks >= 2) score += 5;

    // 4. Бюджет (20 баллов)
    if (preferences?.budgetMax) {
      if (preferences.budgetMax >= 20000000) score += 20; // > 20 млн
      else if (preferences.budgetMax >= 10000000) score += 15; // > 10 млн
      else if (preferences.budgetMax >= 7000000) score += 10; // > 7 млн
      else if (preferences.budgetMax >= 5000000) score += 5; // > 5 млн
    }

    return Math.min(100, score);
  }

  // Определение качества лида
  private determineQuality(score: number): LeadQuality {
    if (score >= 70) return 'hot';
    if (score >= 40) return 'warm';
    return 'cold';
  }

  // Расчет вовлеченности
  private calculateEngagement(user: any): number {
    const clicks = user.clicks?.length || 0;
    const searches = user.recommendations?.length || 0;
    const hasPhone = user.phone ? 20 : 0;
    
    return Math.min(100, (clicks * 10) + (searches * 15) + hasPhone);
  }

  // Квалификация лида (проверка контактов)
  async qualifyLead(leadId: string): Promise<Lead> {
    const lead = await this.getLead(leadId);
    if (!lead) throw new Error('Lead not found');

    // Проверяем наличие минимальных данных
    const isQualified = !!(
      lead.phone && 
      lead.budget.max && 
      lead.locations.length > 0
    );

    return this.updateLead(leadId, {
      status: isQualified ? 'qualified' : 'rejected'
    });
  }

  // Получение "горячих" лидов для продажи
  async getHotLeads(limit: number = 50): Promise<Lead[]> {
    const leads = await prisma.$queryRaw<any[]>`
      SELECT 
        u.id as "userId",
        u."tgId",
        u.phone,
        u."firstName",
        u."lastName",
        u.username,
        u."createdAt",
        COUNT(DISTINCT r.id) as "searchesCount",
        COUNT(DISTINCT c.id) as "clicksCount",
        MAX(r."createdAt") as "lastActivity"
      FROM "User" u
      LEFT JOIN "Recommendation" r ON r."userId" = u.id
      LEFT JOIN "Click" c ON c."userId" = u.id
      WHERE u.phone IS NOT NULL
      GROUP BY u.id
      HAVING COUNT(DISTINCT r.id) >= 2
      ORDER BY MAX(r."createdAt") DESC
      LIMIT ${limit}
    `;

    // Преобразуем в формат Lead
    const hotLeads: Lead[] = [];
    
    for (const data of leads) {
      const lead = await this.createOrUpdateLead(data.userId);
      if (lead.quality === 'hot' && lead.status !== 'sold') {
        hotLeads.push(lead);
      }
    }

    return hotLeads;
  }

  // Продажа лида партнеру
  async sellLead(leadId: string, buyerId: string, price: number): Promise<Lead> {
    const lead = await this.getLead(leadId);
    if (!lead) throw new Error('Lead not found');
    if (lead.status === 'sold') throw new Error('Lead already sold');

    // Обновляем статус
    const updatedLead = await this.updateLead(leadId, {
      status: 'sold',
      soldTo: buyerId,
      soldAt: new Date(),
      price
    });

    // Отправляем лид покупателю
    await this.sendLeadToBuyer(updatedLead, buyerId);

    return updatedLead;
  }

  // Отправка лида покупателю через webhook
  private async sendLeadToBuyer(lead: Lead, buyerId: string): Promise<void> {
    // Здесь должна быть интеграция с API покупателя
    // Для примера - просто логируем
    console.log(`Sending lead ${lead.id} to buyer ${buyerId}`);
    
    // В реальности:
    // const buyer = await this.getBuyer(buyerId);
    // await axios.post(buyer.webhookUrl, {
    //   lead: this.sanitizeLead(lead),
    //   apiKey: buyer.apiKey
    // });
  }

  // CRUD операции
  private async createLead(data: Partial<Lead>): Promise<Lead> {
    // В реальной БД создаем запись
    // Сейчас сохраняем в meta пользователя
    const user = await prisma.user.update({
      where: { id: data.userId },
      data: {
        meta: {
          lead: {
            ...data,
            id: `lead_${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        } as any
      }
    });

    return (user.meta as any)?.lead as Lead;
  }

  private async updateLead(leadId: string, data: Partial<Lead>): Promise<Lead> {
    // Обновляем в meta пользователя
    const users = await prisma.user.findMany({
      where: {
        meta: {
          path: ['lead', 'id'],
          equals: leadId
        } as any
      }
    });

    if (users.length === 0) throw new Error('Lead not found');

    const user = await prisma.user.update({
      where: { id: users[0].id },
      data: {
        meta: {
          lead: {
            ...((users[0].meta as any)?.lead),
            ...data,
            updatedAt: new Date()
          }
        } as any
      }
    });

    return (user.meta as any)?.lead as Lead;
  }

  private async getLead(leadId: string): Promise<Lead | null> {
    const users = await prisma.user.findMany({
      where: {
        meta: {
          path: ['lead', 'id'],
          equals: leadId
        } as any
      }
    });

    return users.length > 0 ? (users[0].meta as any)?.lead as Lead : null;
  }

  private async findLeadByUserId(userId: string): Promise<Lead | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    return (user?.meta as any)?.lead as Lead || null;
  }

  // Статистика по лидам
  async getLeadStats(): Promise<{
    total: number;
    byQuality: Record<LeadQuality, number>;
    byStatus: Record<LeadStatus, number>;
    totalRevenue: number;
    avgLeadPrice: number;
  }> {
    const users = await prisma.user.findMany({
      where: {
        meta: {
          path: ['lead'],
          not: null
        } as any
      }
    });

    const stats = {
      total: 0,
      byQuality: { hot: 0, warm: 0, cold: 0 } as Record<LeadQuality, number>,
      byStatus: { new: 0, qualified: 0, contacted: 0, sold: 0, rejected: 0 } as Record<LeadStatus, number>,
      totalRevenue: 0,
      avgLeadPrice: 0
    };

    let soldCount = 0;

    for (const user of users) {
      const lead = (user.meta as any)?.lead as Lead;
      if (!lead) continue;

      stats.total++;
      stats.byQuality[lead.quality]++;
      stats.byStatus[lead.status]++;

      if (lead.status === 'sold' && lead.price) {
        stats.totalRevenue += lead.price;
        soldCount++;
      }
    }

    stats.avgLeadPrice = soldCount > 0 ? stats.totalRevenue / soldCount : 0;

    return stats;
  }
}

export const leadService = new LeadService();