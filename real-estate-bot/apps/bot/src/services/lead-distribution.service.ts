import { Lead, LeadBuyer, LeadQuality } from '@real-estate-bot/shared';
import { leadService } from './lead.service';
import axios from 'axios';

// Примеры покупателей лидов (в реальности - из БД)
const LEAD_BUYERS: LeadBuyer[] = [
  {
    id: 'etazhi',
    name: 'Этажи',
    type: 'agency',
    budgetRange: { min: 3000000, max: 50000000 },
    locations: ['Москва', 'МО'],
    leadTypes: ['new', 'secondary'],
    minQuality: 'warm',
    pricePerLead: {
      hot: 5000,
      warm: 2000,
      cold: 500
    },
    dailyLimit: 50,
    monthlyLimit: 1000,
    currentDaily: 0,
    currentMonthly: 0,
    webhookUrl: 'https://api.etazhi.com/leads',
    active: true,
    createdAt: new Date()
  },
  {
    id: 'incom',
    name: 'Инком-Недвижимость',
    type: 'agency',
    budgetRange: { min: 5000000, max: 100000000 },
    minQuality: 'hot',
    pricePerLead: {
      hot: 7000,
      warm: 3000,
      cold: 0 // не покупают холодные
    },
    dailyLimit: 30,
    monthlyLimit: 500,
    currentDaily: 0,
    currentMonthly: 0,
    webhookUrl: 'https://partners.incom.ru/api/leads',
    active: true,
    createdAt: new Date()
  },
  {
    id: 'pik_leads',
    name: 'ПИК (лиды)',
    type: 'developer',
    budgetRange: { min: 7000000 },
    leadTypes: ['new'], // только новостройки
    minQuality: 'warm',
    pricePerLead: {
      hot: 8000,
      warm: 4000,
      cold: 0
    },
    dailyLimit: 100,
    monthlyLimit: 2000,
    currentDaily: 0,
    currentMonthly: 0,
    webhookUrl: 'https://api.pik.ru/partners/leads',
    active: true,
    createdAt: new Date()
  }
];

export class LeadDistributionService {
  private buyers: LeadBuyer[] = LEAD_BUYERS;

  // Автоматическое распределение нового лида
  async distributeLead(lead: Lead): Promise<{
    distributed: boolean;
    buyer?: LeadBuyer;
    price?: number;
    reason?: string;
  }> {
    // Находим подходящих покупателей
    const eligibleBuyers = this.findEligibleBuyers(lead);
    
    if (eligibleBuyers.length === 0) {
      return {
        distributed: false,
        reason: 'No eligible buyers found'
      };
    }

    // Сортируем по цене (кто больше платит)
    eligibleBuyers.sort((a, b) => {
      const priceA = a.pricePerLead[lead.quality];
      const priceB = b.pricePerLead[lead.quality];
      return priceB - priceA;
    });

    // Пробуем отправить первому подходящему
    for (const buyer of eligibleBuyers) {
      const price = buyer.pricePerLead[lead.quality];
      
      try {
        const sent = await this.sendLeadToBuyer(lead, buyer);
        
        if (sent) {
          // Обновляем статус лида
          await leadService.sellLead(lead.id, buyer.id, price);
          
          // Обновляем лимиты покупателя
          this.updateBuyerLimits(buyer.id);
          
          return {
            distributed: true,
            buyer,
            price
          };
        }
      } catch (error) {
        console.error(`Failed to send lead to ${buyer.name}:`, error);
        continue;
      }
    }

    return {
      distributed: false,
      reason: 'All buyers rejected the lead'
    };
  }

  // Поиск подходящих покупателей
  private findEligibleBuyers(lead: Lead): LeadBuyer[] {
    return this.buyers.filter(buyer => {
      // Проверяем активность
      if (!buyer.active) return false;

      // Проверяем качество
      const qualityScore = { hot: 3, warm: 2, cold: 1 };
      const minQualityScore = qualityScore[buyer.minQuality || 'cold'];
      const leadQualityScore = qualityScore[lead.quality];
      if (leadQualityScore < minQualityScore) return false;

      // Проверяем цену (покупатель готов платить)
      if (buyer.pricePerLead[lead.quality] === 0) return false;

      // Проверяем бюджет
      if (buyer.budgetRange) {
        if (buyer.budgetRange.min && lead.budget.max && lead.budget.max < buyer.budgetRange.min) {
          return false;
        }
        if (buyer.budgetRange.max && lead.budget.min && lead.budget.min > buyer.budgetRange.max) {
          return false;
        }
      }

      // Проверяем локацию
      if (buyer.locations && buyer.locations.length > 0) {
        const hasMatchingLocation = lead.locations.some(loc => 
          buyer.locations!.some(buyerLoc => 
            loc.toLowerCase().includes(buyerLoc.toLowerCase()) ||
            buyerLoc.toLowerCase().includes(loc.toLowerCase())
          )
        );
        if (!hasMatchingLocation) return false;
      }

      // Проверяем тип недвижимости
      if (buyer.leadTypes && buyer.leadTypes.length > 0) {
        if (!buyer.leadTypes.includes(lead.type as any)) return false;
      }

      // Проверяем лимиты
      if (buyer.dailyLimit && buyer.currentDaily >= buyer.dailyLimit) return false;
      if (buyer.monthlyLimit && buyer.currentMonthly >= buyer.monthlyLimit) return false;

      return true;
    });
  }

  // Отправка лида покупателю
  private async sendLeadToBuyer(lead: Lead, buyer: LeadBuyer): Promise<boolean> {
    if (!buyer.webhookUrl) {
      console.log(`Mock sending lead ${lead.id} to ${buyer.name}`);
      return true; // В демо всегда успешно
    }

    try {
      const payload = {
        source: 'realestate_bot',
        lead_id: lead.id,
        quality: lead.quality,
        score: lead.score,
        contact: {
          phone: lead.phone,
          name: lead.name,
          telegram: lead.telegramUsername
        },
        requirements: {
          budget_min: lead.budget.min,
          budget_max: lead.budget.max,
          locations: lead.locations,
          rooms: lead.rooms,
          area_min: lead.area?.min,
          area_max: lead.area?.max,
          property_type: lead.type,
          purpose: lead.purpose
        },
        behavior: {
          searches_count: lead.searchesCount,
          viewed_listings: lead.viewedListings.length,
          engagement_score: lead.engagementScore,
          last_activity: lead.lastActivity
        },
        timestamp: new Date().toISOString()
      };

      const response = await axios.post(buyer.webhookUrl, payload, {
        headers: {
          'Authorization': `Bearer ${buyer.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      return response.status === 200;
    } catch (error) {
      console.error(`Failed to send lead to ${buyer.name}:`, error);
      return false;
    }
  }

  // Обновление лимитов покупателя
  private updateBuyerLimits(buyerId: string): void {
    const buyer = this.buyers.find(b => b.id === buyerId);
    if (buyer) {
      buyer.currentDaily++;
      buyer.currentMonthly++;
    }
  }

  // Сброс дневных лимитов (запускать в полночь)
  resetDailyLimits(): void {
    this.buyers.forEach(buyer => {
      buyer.currentDaily = 0;
    });
  }

  // Сброс месячных лимитов (запускать 1 числа)
  resetMonthlyLimits(): void {
    this.buyers.forEach(buyer => {
      buyer.currentMonthly = 0;
    });
  }

  // Получение статистики по покупателям
  getBuyerStats(): Array<{
    buyer: LeadBuyer;
    utilizationDaily: number;
    utilizationMonthly: number;
    canBuyMore: boolean;
  }> {
    return this.buyers.map(buyer => ({
      buyer,
      utilizationDaily: buyer.dailyLimit ? (buyer.currentDaily / buyer.dailyLimit) * 100 : 0,
      utilizationMonthly: buyer.monthlyLimit ? (buyer.currentMonthly / buyer.monthlyLimit) * 100 : 0,
      canBuyMore: (!buyer.dailyLimit || buyer.currentDaily < buyer.dailyLimit) &&
                  (!buyer.monthlyLimit || buyer.currentMonthly < buyer.monthlyLimit)
    }));
  }

  // Расчет потенциального дохода от лида
  calculatePotentialRevenue(lead: Lead): number {
    const eligibleBuyers = this.findEligibleBuyers(lead);
    
    if (eligibleBuyers.length === 0) return 0;
    
    // Возвращаем максимальную цену
    return Math.max(...eligibleBuyers.map(b => b.pricePerLead[lead.quality]));
  }

  // Добавление нового покупателя
  addBuyer(buyer: LeadBuyer): void {
    this.buyers.push(buyer);
  }

  // Обновление покупателя
  updateBuyer(buyerId: string, updates: Partial<LeadBuyer>): void {
    const index = this.buyers.findIndex(b => b.id === buyerId);
    if (index !== -1) {
      this.buyers[index] = { ...this.buyers[index], ...updates };
    }
  }
}

export const leadDistribution = new LeadDistributionService();