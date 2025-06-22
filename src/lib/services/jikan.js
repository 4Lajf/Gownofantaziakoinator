import axios from 'axios';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

/**
 * Add delay between requests to respect Jikan API rate limits
 * @param {number} ms - Milliseconds to wait
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch anime details from Jikan API including themes
 * @param {number} malId - MyAnimeList anime ID
 * @returns {Promise<Object>} Anime details with themes
 */
export async function fetchAnimeThemes(malId) {
  try {
    const response = await axios.get(`${JIKAN_BASE_URL}/anime/${malId}`);
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching anime themes for ID ${malId}:`, error.message);
    throw error;
  }
}

/**
 * Check if anime has specific genre or theme using Jikan API
 * @param {number} malId - MyAnimeList anime ID
 * @param {string} filterType - 'fantasy' or 'isekai'
 * @returns {Promise<boolean>} True if anime matches the filter
 */
export async function checkAnimeFilter(malId, filterType) {
  try {
    const animeData = await fetchAnimeThemes(malId);

    if (filterType === 'fantasy') {
      const genres = animeData.genres || [];
      return genres.some(genre =>
        genre.name.toLowerCase().includes('fantasy')
      );
    } else if (filterType === 'isekai') {
      const themes = animeData.themes || [];
      return themes.some(theme =>
        theme.name.toLowerCase().includes('isekai')
      );
    }

    return false;
  } catch (error) {
    console.error(`Error checking ${filterType} for ID ${malId}:`, error.message);
    return false;
  }
}

/**
 * Fetch anime details with themes for multiple anime IDs
 * @param {Array<number>} malIds - Array of MyAnimeList anime IDs
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Promise<Array>} Array of anime with theme information
 */
export async function fetchMultipleAnimeThemes(malIds, progressCallback = null) {
  const results = [];
  
  for (let i = 0; i < malIds.length; i++) {
    try {
      if (progressCallback) {
        progressCallback(i + 1, malIds.length, `Sprawdzanie tematów anime: ${i + 1}/${malIds.length}`);
      }
      
      const animeData = await fetchAnimeThemes(malIds[i]);
      results.push(animeData);
      
      // Rate limiting for Jikan API
      await delay(1000);
      
    } catch (error) {
      console.error(`Failed to fetch themes for anime ID ${malIds[i]}:`, error.message);
      // Continue with next anime
    }
  }
  
  return results;
}
