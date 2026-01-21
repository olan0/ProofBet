// API client for REST endpoints
const API_BASE_URL = typeof window !== 'undefined' && window.ENV?.API_BASE_URL 
  ? window.ENV.API_BASE_URL 
  : 'http://localhost:3000';

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
    const response = await fetch(url);
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
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching bet from API:', error);
    throw error;
  }
}

// Expose API_BASE_URL for configuration
export { API_BASE_URL };