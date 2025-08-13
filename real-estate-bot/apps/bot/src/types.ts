import { Context as BaseContext, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import { PreferenceWeights } from '@real-estate-bot/shared';

// Session data structure
export interface SessionData {
	userId?: string;
	user?: any;
	interviewMode?: 'life' | 'invest';
	dealType?: 'sale' | 'rent';
	propertyType?: 'new' | 'secondary' | 'any';
	budget?: { min?: number; max?: number };
	locations?: string[];
	commutePoints?: any[];
	transportMode?: 'car' | 'public' | 'walk';
	rooms?: number[];
	areaMin?: number;
	areaMax?: number;
	newBuilding?: boolean;
	parkingRequired?: boolean;
	weights: PreferenceWeights;
	currentState?: string;
	lastSearchResults?: string[];
	currentViewingIndex?: number;
	waitingFor?: 'faq_input' | 'url_input' | 'kb_query' | undefined;
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