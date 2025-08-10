// Weight ranges
export const WEIGHT_MIN = 1;
export const WEIGHT_MAX = 10;

// Default weights for different modes
export const DEFAULT_LIFE_WEIGHTS = {
  transport: 9,
  metro: 8,
  schools: 7,
  parks: 7,
  parking: 5,
  noise: 6,
  price: 8,
  ecology: 6,
  infrastructure: 7,
};

export const DEFAULT_INVEST_WEIGHTS = {
  price: 10,
  liquidity: 9,
  constructionStage: 8,
  transport: 7,
  metro: 8,
  infrastructure: 7,
  parks: 5,
  ecology: 4,
};

// Match score thresholds
export const MATCH_SCORE_EXCELLENT = 8.5;
export const MATCH_SCORE_GOOD = 7.0;
export const MATCH_SCORE_ACCEPTABLE = 5.5;

// Notification settings
export const DEFAULT_NOTIFICATION_THRESHOLD = 7.0;
export const NOTIFICATION_CHECK_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours

// Dialog states
export const DIALOG_STATES = {
  START: 'start',
  SELECT_MODE: 'select_mode',
  BUDGET: 'budget',
  LOCATION: 'location',
  COMMUTE: 'commute',
  FAMILY: 'family',
  PREFERENCES: 'preferences',
  CONFIRM: 'confirm',
  SEARCHING: 'searching',
  RESULTS: 'results',
  FEEDBACK: 'feedback',
  BACKGROUND_SEARCH: 'background_search',
} as const;

// Construction stages
export const CONSTRUCTION_STAGES = {
  PIT: 'pit',
  FOUNDATION: 'foundation',
  FRAME: 'frame',
  FACADE: 'facade',
  FINISHING: 'finishing',
  READY: 'ready',
} as const;

// Transport modes
export const TRANSPORT_MODES = {
  CAR: 'car',
  PUBLIC: 'public',
  WALK: 'walk',
} as const;

// API limits
export const API_SEARCH_LIMIT = 50;
export const API_RATE_LIMIT = 60; // requests per minute

// Cache settings
export const LISTING_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
export const SEARCH_CACHE_TTL = 30 * 60 * 1000; // 30 minutes