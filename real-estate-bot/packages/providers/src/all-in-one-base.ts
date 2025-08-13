import { PartnerListingsProvider, PartnerConfig } from './partner-base';
import { Listing, QueryDTO, Lead } from '@real-estate-bot/shared';
import axios from 'axios';

export interface AllInOneConfig extends PartnerConfig {
  // Настройки для лидов
  leadWebhookUrl: string;
  leadPricing: {
    base: number;          // Базовая цена за лид
    qualified: number;     // За квалифицированный лид (с телефоном)
    exclusive: number;     // За эксклюзивный лид (не продавался другим)
  };
  leadRequirements?: {
    minBudget?: number;
    regions?: string[];
    propertyTypes?: string[];
  };
}

export interface LeadSubmissionResponse {
  success: boolean;
  leadId?: string;
  price?: number;
  message?: string;
  requiresVerification?: boolean;
}

export abstract class AllInOneProvider extends PartnerListingsProvider {
  protected leadConfig: AllInOneConfig;

  constructor(config: AllInOneConfig & { name: string; baseURL: string; supportsFilters: string[] }) {
    super(config.name, { ...config, baseUrl: config.baseURL }, config.supportsFilters);
    this.leadConfig = config;
  }

  // Упрощённый помощник для добавления partnerData и ссылки
  protected enrichListing(listing: Listing, userId?: string): Listing {
    return this.enrichListingWithPartnerData(this.enrichListingWithLeadInfo(listing), userId);
  }

  // Отправка лида партнеру
  async submitLead(lead: Lead): Promise<LeadSubmissionResponse> {
    try {
      // Проверяем соответствие требованиям
      if (!this.isLeadEligible(lead)) {
        return {
          success: false,
          message: 'Lead does not meet requirements'
        };
      }

      // Подготавливаем данные для отправки
      const leadData = this.prepareLead(lead);
      
      // Отправляем через API
      const response = await axios.post(
        this.leadConfig.leadWebhookUrl,
        leadData,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'X-Partner-ID': this.config.partnerId
          },
          timeout: 10000
        }
      );

      // Обрабатываем ответ
      return this.processLeadResponse(response.data, lead);
    } catch (error) {
      console.error(`Failed to submit lead to ${this.name}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Проверка соответствия лида требованиям
  protected isLeadEligible(lead: Lead): boolean {
    const reqs = this.leadConfig.leadRequirements;
    if (!reqs) return true;

    // Проверка минимального бюджета
    if (reqs.minBudget && lead.budget.max && lead.budget.max < reqs.minBudget) {
      return false;
    }

    // Проверка регионов
    if (reqs.regions && reqs.regions.length > 0) {
      const hasMatchingRegion = lead.locations.some(loc =>
        reqs.regions!.some(region =>
          loc.toLowerCase().includes(region.toLowerCase())
        )
      );
      if (!hasMatchingRegion) return false;
    }

    // Проверка типов недвижимости
    if (reqs.propertyTypes && reqs.propertyTypes.length > 0) {
      if (!reqs.propertyTypes.includes(lead.type)) return false;
    }

    return true;
  }

  // Подготовка лида для отправки (может быть переопределен)
  protected prepareLead(lead: Lead): any {
    return {
      id: lead.id,
      timestamp: new Date().toISOString(),
      source: 'smart_realty_bot',
      
      // Контактные данные
      contact: {
        phone: lead.phone,
        name: lead.name,
        telegram: lead.telegramUsername,
        email: lead.email
      },
      
      // Требования
      requirements: {
        budget: {
          min: lead.budget.min,
          max: lead.budget.max
        },
        locations: lead.locations,
        rooms: lead.rooms,
        area: lead.area,
        propertyType: lead.type,
        purpose: lead.purpose
      },
      
      // Метрики
      metrics: {
        quality: lead.quality,
        score: lead.score,
        searchesCount: lead.searchesCount,
        viewedListings: lead.viewedListings.length,
        engagementScore: lead.engagementScore
      },
      
      // UTM метки
      utm: lead.utmParams
    };
  }

  // Обработка ответа от партнера
  protected processLeadResponse(response: any, lead: Lead): LeadSubmissionResponse {
    // Базовая обработка, может быть переопределена
    const price = this.calculateLeadPrice(lead, response);
    
    return {
      success: true,
      leadId: response.lead_id || response.id,
      price: price,
      message: response.message,
      requiresVerification: response.requires_verification
    };
  }

  // Расчет цены за лид
  protected calculateLeadPrice(lead: Lead, response?: any): number {
    // Если партнер вернул цену - используем её
    if (response?.price) {
      return response.price;
    }

    // Иначе считаем по нашим правилам
    const pricing = this.leadConfig.leadPricing;
    let price = pricing.base;

    // Доплата за квалифицированный лид
    if (lead.phone && lead.quality !== 'cold') {
      price = pricing.qualified;
    }

    // Доплата за эксклюзив (если не продавался другим)
    if (!lead.soldTo && lead.quality === 'hot') {
      price = pricing.exclusive;
    }

    return price;
  }

  // Получение статистики по лидам
  async getLeadStats(): Promise<{
    submitted: number;
    accepted: number;
    rejected: number;
    totalRevenue: number;
  }> {
    // Базовая реализация - может быть переопределена
    return {
      submitted: 0,
      accepted: 0,
      rejected: 0,
      totalRevenue: 0
    };
  }

  // Проверка статуса лида
  async checkLeadStatus(leadId: string): Promise<{
    status: 'pending' | 'accepted' | 'rejected' | 'paid';
    price?: number;
    reason?: string;
  }> {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}/leads/${leadId}/status`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`
          }
        }
      );

      return response.data;
    } catch (error) {
      return {
        status: 'pending',
        reason: 'Failed to check status'
      };
    }
  }

  // Обогащение объекта информацией о комиссии за лид
  protected enrichListingWithLeadInfo(listing: Listing): Listing {
    // Добавляем информацию о потенциальной комиссии
    const enriched = { ...listing } as any;
    
    // Расчет потенциальной комиссии за лид по этому объекту
    const estimatedLeadPrice = this.estimateLeadPriceForListing(listing);
    
    if (!enriched.partnerData) {
      enriched.partnerData = {};
    }
    
    enriched.partnerData.estimatedLeadRevenue = estimatedLeadPrice;
    enriched.partnerData.leadProgramActive = true;
    
    return enriched as Listing;
  }

  // Оценка стоимости лида для конкретного объекта
  protected estimateLeadPriceForListing(listing: Listing): number {
    const pricing = this.leadConfig.leadPricing;
    
    // Премиум объекты генерируют более дорогие лиды
    if (listing.price && listing.price > 20000000) {
      return pricing.exclusive;
    } else if (listing.price && listing.price > 10000000) {
      return pricing.qualified;
    }
    
    return pricing.base;
  }
}

export type { LeadSubmissionResponse, AllInOneConfig };