import axios from 'axios';
import { Listing, MatchResult, Preferences, SavedQuery, User } from '@real-estate-bot/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth header if we have initData
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
    config.headers['X-Telegram-Init-Data'] = window.Telegram.WebApp.initData;
  }
  return config;
});

export const apiClient = {
  // User
  getProfile: () => api.get<User>('/user/profile').then(r => r.data),
  
  // Preferences
  getPreferences: () => api.get<Preferences[]>('/preferences').then(r => r.data),
  updatePreferences: (id: string, data: Partial<Preferences>) => 
    api.patch<Preferences>(`/preferences/${id}`, data).then(r => r.data),
  
  // Search
  search: (preferencesId: string) => 
    api.post<MatchResult[]>('/search', { preferencesId }).then(r => r.data),
  
  // Listings
  getListing: (id: string) => 
    api.get<Listing>(`/listings/${id}`).then(r => r.data),
  
  // Saved queries
  getSavedQueries: () => 
    api.get<SavedQuery[]>('/saved-queries').then(r => r.data),
  createSavedQuery: (data: { preferencesId: string; threshold: number }) => 
    api.post<SavedQuery>('/saved-queries', data).then(r => r.data),
  updateSavedQuery: (id: string, data: Partial<SavedQuery>) => 
    api.patch<SavedQuery>(`/saved-queries/${id}`, data).then(r => r.data),
  deleteSavedQuery: (id: string) => 
    api.delete(`/saved-queries/${id}`),
  
  // Feedback
  sendFeedback: (data: {
    recommendationId: string;
    action: 'like' | 'dislike' | 'hide';
    reason?: string;
  }) => api.post('/feedback', data).then(r => r.data),
  
  // Analytics
  trackClick: (listingId: string) => 
    api.post('/analytics/click', { listingId }).then(r => r.data),
};