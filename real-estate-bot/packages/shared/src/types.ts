// User types
export interface User {
  id: string;
  tgId: number;
  phone?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Preference types
export type PreferenceMode = 'life' | 'invest';

export interface PreferenceWeights {
  transport?: number;
  metro?: number;
  schools?: number;
  parks?: number;
  parking?: number;
  noise?: number;
  price?: number;
  liquidity?: number;
  constructionStage?: number;
  ecology?: number;
  infrastructure?: number;
  [key: string]: number | undefined;
}

export interface CommutePoint {
  name: string;
  lat: number;
  lng: number;
  timeImportance: number;
}

export interface Preferences {
  id: string;
  userId: string;
  mode: PreferenceMode;
  weights: PreferenceWeights;
  budgetMin?: number;
  budgetMax?: number;
  locations: string[];
  commutePoints: CommutePoint[];
  transportMode?: 'car' | 'public' | 'walk';
  rooms?: number[];
  areaMin?: number;
  areaMax?: number;
  newBuilding?: boolean;
  parkingRequired?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Query types
export interface QueryDTO {
  mode: PreferenceMode;
  budget: {
    min?: number;
    max?: number;
  };
  geo: {
    city: string;
    districts?: string[];
    commutePoints?: CommutePoint[];
  };
  filters: {
    rooms?: number[];
    areaMin?: number;
    areaMax?: number;
    newBuilding?: boolean;
    stage?: string;
    parking?: boolean;
    schoolsImportance?: number;
    parksImportance?: number;
    noiseTolerance?: number;
  };
  weights: PreferenceWeights;
}

// Listing types
export interface Listing {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
  rooms: number;
  area: number;
  floor: number;
  totalFloors: number;
  year?: number;
  stage?: string;
  photos: string[];
  provider: string;
  partnerDeeplinkTemplate?: string;
  description?: string;
  hasParking?: boolean;
  isNewBuilding?: boolean;
  developer?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Match result types
export interface MatchBreakdown {
  transport?: number;
  metro?: number;
  schools?: number;
  parks?: number;
  parking?: number;
  noise?: number;
  price?: number;
  liquidity?: number;
  constructionStage?: number;
  ecology?: number;
  infrastructure?: number;
  [key: string]: number | undefined;
}

export interface MatchResult {
  listingId: string;
  listing?: Listing;
  matchScore: number;
  breakdown: MatchBreakdown;
  explanation: string;
}

// Saved query types
export type SavedQueryStatus = 'active' | 'paused';

export interface SavedQuery {
  id: string;
  userId: string;
  preferencesId: string;
  status: SavedQueryStatus;
  thresholdMatch: number;
  createdAt: Date;
  updatedAt: Date;
}

// Recommendation types
export interface Recommendation {
  id: string;
  userId: string;
  listingId: string;
  matchScore: number;
  breakdown: MatchBreakdown;
  explanation: string;
  createdAt: Date;
}

// Feedback types
export type FeedbackAction = 'like' | 'dislike' | 'hide';

export interface Feedback {
  id: string;
  userId: string;
  recommendationId: string;
  action: FeedbackAction;
  reason?: string;
  weightsDelta?: Partial<PreferenceWeights>;
  createdAt: Date;
}

// Click tracking types
export interface Click {
  id: string;
  userId: string;
  listingId: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  sessionId: string;
  createdAt: Date;
}

// Knowledge document types (for RAG)
export interface KnowledgeDocument {
  id: string;
  type: 'pdf' | 'url' | 'text' | 'faq' | 'guide';
  title: string;
  content: string;
  sourceUrl?: string;
  metadata: {
    source?: string;
    category?: string;
    tags?: string[];
    author?: string;
    pageNumber?: number;
    url?: string;
    [key: string]: any;
  };
  embedding?: number[]; // Vector embedding
  chunkIndex?: number; // Position in original document
  parentId?: string; // Reference to parent document
  createdAt: Date;
  updatedAt: Date;
}

// Document chunk for retrieval
export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  metadata: {
    startIndex: number;
    endIndex: number;
    pageNumber?: number;
    section?: string;
  };
  similarity?: number; // Similarity score when retrieved
}

// RAG Query types
export interface RAGQuery {
  query: string;
  context?: string;
  topK?: number;
  threshold?: number;
  filters?: {
    type?: KnowledgeDocument['type'][];
    category?: string[];
    tags?: string[];
  };
}

// RAG Response
export interface RAGResponse {
  chunks: DocumentChunk[];
  answer?: string;
  sources: Array<{
    title: string;
    url?: string;
    pageNumber?: number;
  }>;
}

// Provider types
export interface ListingsProvider {
  name: string;
  searchListings(query: QueryDTO): Promise<Listing[]>;
  getListing(id: string): Promise<Listing | null>;
  supportsFilters: string[];
  linkTemplate?: string;
}