import { Context as BaseContext, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import { User, Preferences, SavedQuery, PreferenceMode, CommutePoint, PreferenceWeights } from '@real-estate-bot/shared';

// Session data structure
export interface SessionData {
  userId?: string;
  user?: User;
  currentState?: string;
  
  // Interview data
  interviewMode?: PreferenceMode;
  budget?: {
    min?: number;
    max?: number;
  };
  locations?: string[];
  commutePoints?: CommutePoint[];
  transportMode?: 'car' | 'public' | 'walk';
  rooms?: number[];
  areaMin?: number;
  areaMax?: number;
  newBuilding?: boolean;
  parkingRequired?: boolean;
  
  // Weights (collected during interview)
  weights?: PreferenceWeights;
  
  // Current preferences being edited
  currentPreferencesId?: string;
  
  // Search results
  lastSearchResults?: string[]; // listing IDs
  currentViewingIndex?: number;
  
  // Feedback collection
  awaitingFeedback?: {
    recommendationId: string;
    action: 'like' | 'dislike' | 'hide';
  };
  
  // Input waiting state
  waitingFor?: 'faq_input' | 'url_input' | 'kb_query' | 'feedback' | 'question';
}

// Bot context type
export type BotContext = BaseContext & SessionFlavor<SessionData> & ConversationFlavor;

// Conversation names
export const CONVERSATIONS = {
  MAIN_INTERVIEW: 'mainInterview',
  LIFE_MODE: 'lifeModeInterview',
  INVEST_MODE: 'investModeInterview',
  FEEDBACK: 'feedbackCollection',
  PREFERENCES_EDIT: 'preferencesEdit',
} as const;