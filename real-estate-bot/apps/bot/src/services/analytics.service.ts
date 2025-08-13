import { prisma } from '@real-estate-bot/database';

export interface AnalyticsEvent {
  event: string;
  userId?: string;
  properties?: Record<string, any>;
  timestamp: Date;
}

class AnalyticsService {
  private events: AnalyticsEvent[] = [];

  track(event: string, userId?: string, properties?: Record<string, any>) {
    const analyticsEvent: AnalyticsEvent = {
      event,
      userId,
      properties,
      timestamp: new Date(),
    };

    this.events.push(analyticsEvent);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Analytics:', {
        event,
        userId: userId?.substring(0, 8) + '...',
        ...properties,
      });
    }

    // In production, would send to analytics service (Amplitude, Mixpanel, etc.)
    // this.sendToAnalyticsProvider(analyticsEvent);
  }

  // Key metrics for MVP
  trackBotStart(userId: string) {
    this.track('bot_started', userId);
  }

  trackInterviewStarted(userId: string, type: 'quick' | 'detailed') {
    this.track('interview_started', userId, { type });
  }

  trackInterviewCompleted(userId: string, type: 'quick' | 'detailed', durationSeconds: number) {
    this.track('interview_completed', userId, { type, durationSeconds });
  }

  trackSearchCompleted(userId: string, resultsCount: number, topScore: number) {
    this.track('search_completed', userId, { resultsCount, topScore });
  }

  trackListingViewed(userId: string, listingId: string, matchScore: number) {
    this.track('listing_viewed', userId, { listingId, matchScore });
  }

  trackListingClicked(userId: string, listingId: string, source: 'bot' | 'webapp') {
    this.track('listing_clicked', userId, { listingId, source });
  }

  trackFeedbackGiven(userId: string, action: string, listingId: string) {
    this.track('feedback_given', userId, { action, listingId });
  }

  trackNotificationEnabled(userId: string) {
    this.track('notification_enabled', userId);
  }

  trackUserReturned(userId: string, daysSinceLastVisit: number) {
    this.track('user_returned', userId, { daysSinceLastVisit });
  }

  // Get basic metrics
  async getMetrics() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Count users
    const totalUsers = await prisma.user.count();
    const activeUsersToday = await prisma.user.count({
      where: { updatedAt: { gte: oneDayAgo } },
    });
    const activeUsersWeek = await prisma.user.count({
      where: { updatedAt: { gte: oneWeekAgo } },
    });

    // Count searches
    const searchesToday = await prisma.recommendation.count({
      where: { createdAt: { gte: oneDayAgo } },
    });

    // Count clicks
    const clicksToday = await prisma.click.count({
      where: { createdAt: { gte: oneDayAgo } },
    });

    // Average match score
    const avgScore = await prisma.recommendation.aggregate({
      _avg: { score: true },
      where: { createdAt: { gte: oneWeekAgo } },
    });

    return {
      users: {
        total: totalUsers,
        activeToday: activeUsersToday,
        activeWeek: activeUsersWeek,
      },
      engagement: {
        searchesToday,
        clicksToday,
        avgMatchScore: avgScore._avg.score || 0,
      },
      retention: {
        d1: this.calculateRetention(1),
        d7: this.calculateRetention(7),
        d30: this.calculateRetention(30),
      },
    };
  }

  private calculateRetention(days: number): number {
    // Simplified retention calculation for MVP
    // In production, would track cohorts properly
    return 100 - (days * 2); // Mock decay
  }
}

export const analytics = new AnalyticsService();