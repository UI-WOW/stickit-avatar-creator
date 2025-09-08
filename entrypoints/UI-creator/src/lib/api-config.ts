/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

export const API_CONFIG = {
  BASE_URL: 'https://stickit-avatar-creator-api.ui-wow-enabler-account.workers.dev',
  
  // API Endpoints
  ENDPOINTS: {
    CHAT: '/chat',
    GENERATE_AVATAR: '/generate-avatar',
    GENERATE_STICKER: '/generate-sticker',
    REFERENCE_IMAGES: '/reference-images',
    STICKER_GROUPS: '/sticker-groups',
    HEALTH: '/health'
  }
} as const;

// Helper function to get full API URL
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function to get session ID from URL parameters
export const getSessionId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('sessionId');
};

// Helper function to add session parameter to URL
export const addSessionParam = (url: string, sessionId?: string): string => {
  const session = sessionId || getSessionId();
  if (!session) return url;
  
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}sessionId=${encodeURIComponent(session)}`;
};

// Helper function to create fetch options with session parameter
export const createApiOptions = (method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: any, sessionId?: string): RequestInit => {
  const session = sessionId || getSessionId();
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // For GET requests, session will be added to URL
  // For POST/DELETE requests, add session to body if present
  if (method === 'GET') {
    // Session will be added to URL when calling the API
  } else if (body && session) {
    // Add session to request body for POST/DELETE
    options.body = JSON.stringify({ ...body, sessionId: session });
  } else if (session) {
    // If no body but we have session, create body with session
    options.body = JSON.stringify({ sessionId: session });
  } else if (body) {
    options.body = JSON.stringify(body);
  }

  return options;
};

// Export the base URL for direct use
export const API_BASE = API_CONFIG.BASE_URL;
