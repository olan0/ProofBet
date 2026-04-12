// API client for REST endpoints
import axios from 'axios';

const API_BASE_URL = typeof window !== 'undefined' && window.ENV?.API_BASE_URL
  ? window.ENV.API_BASE_URL
  : (import.meta.env?.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'));

const API_HEADERS = {
  'Content-Type': 'application/json',
  ...(import.meta.env?.VITE_API_KEY ? { 'x-api-key': import.meta.env.VITE_API_KEY } : {}),
};

// Pre-configured axios instance with API key — use this instead of raw axios
export const apiAxios = axios.create({ headers: API_HEADERS });

/**
 * Fetch bets from REST API with filters, sorting, and pagination
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number (default: 1)
 * @param {number} params.limit - Results per page (default: 20)
 * @param {string} params.sort - Sort format: "field:asc" or "field:desc"
 * @param {string} params.contains_title - Search term for title
 * @param {string} params.status - Status filter (0-4)
 * @param {string} params.category - Category filter
 * @param {number} params.min_yesVotes - Minimum yes votes
 * @param {number} params.max_yesVotes - Maximum yes votes
 * @param {number} params.min_noVotes - Minimum no votes
 * @param {number} params.max_noVotes - Maximum no votes
 * @returns {Promise<Object>} Response with bets array and pagination info
 */
export async function fetchBets(params = {}) {
  // Remove undefined values
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
  );

  const queryString = new URLSearchParams(cleanParams).toString();
  const url = `${API_BASE_URL}/api/bets${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, { headers: API_HEADERS });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching bets from API:', error);
    throw error;
  }
}

/**
 * Fetch a single bet by ID or address
 * @param {string} id - Bet ID or address
 * @returns {Promise<Object>} Bet data
 */
export async function fetchBet(id) {
  const url = `${API_BASE_URL}/api/bets/${id}`;
  
  try {
    const response = await fetch(url, { headers: API_HEADERS });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching bet from API:', error);
    throw error;
  }
}

/**
 * Fetch user activity (bets where user was creator, bettor, or voter)
 * @param {Object} params - Query parameters
 * @param {string} params.actor - User wallet address
 * @param {string} params.type - Activity type filter: "creator", "bettor", "voter" (optional)
 * @param {number} params.limit - Results per page (default: 20)
 * @param {string} params.cursor - Pagination cursor
 * @returns {Promise<Object>} Response with items array, nextCursor, and appliedRoles
 */
export async function fetchActivity(params = {}) {
  // Map 'user' to 'actor' for backward compatibility
  if (params.user) {
    params.actor = params.user;
    delete params.user;
  }

  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
  );

  const queryString = new URLSearchParams(cleanParams).toString();
  const url = `${API_BASE_URL}/api/activity${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, { headers: API_HEADERS });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching activity from API:', error);
    throw error;
  }
}

export async function fetchPlatformStats() {
  const response = await fetch(`${API_BASE_URL}/api/stats/platform`, { headers: API_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch platform stats: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchTopActive(limit = 5) {
  const response = await fetch(`${API_BASE_URL}/api/stats/top-active?limit=${limit}`, { headers: API_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch top active: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchTopVolume(limit = 5) {
  const response = await fetch(`${API_BASE_URL}/api/stats/top-volume?limit=${limit}`, { headers: API_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch top volume: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchRecent(limit = 5) {
  const response = await fetch(`${API_BASE_URL}/api/stats/recent?limit=${limit}`, { headers: API_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch recent: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchTopCreators(limit = 5) {
  const response = await fetch(`${API_BASE_URL}/api/stats/top-creators?limit=${limit}`, { headers: API_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch top creators: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchUserStats(walletAddress) {
  const response = await fetch(`${API_BASE_URL}/api/stats/user/${walletAddress}`, { headers: API_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch user stats: ${response.statusText}`);
  }
  return response.json();
}

// Expose API_BASE_URL for configuration
export { API_BASE_URL };