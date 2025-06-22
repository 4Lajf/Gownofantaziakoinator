import axios from 'axios';
import { fetchAnimeThemes } from './jikan.js';
import dotenv from 'dotenv';
dotenv.config();
const MAL_API_BASE_URL = 'https://api.myanimelist.net/v2';
const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || process.env.VITE_MAL_CLIENT_ID || 'your-client-id-here';

// OAuth2 URLs
const MAL_AUTH_URL = 'https://myanimelist.net/v1/oauth2/authorize';
const MAL_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';

/**
 * Add delay between requests to respect API rate limits
 * @param {number} ms - Milliseconds to wait
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate OAuth2 authorization URL for MyAnimeList
 * @param {string} redirectUri - Redirect URI after authorization
 * @param {string} state - State parameter for security
 * @returns {string} Authorization URL
 */
export function generateMALAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: MAL_CLIENT_ID,
    redirect_uri: redirectUri,
    state: state,
    scope: 'read'
  });

  return `${MAL_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code from OAuth callback
 * @param {string} redirectUri - Same redirect URI used in authorization
 * @returns {Promise<Object>} Token response
 */
export async function exchangeMALCode(code, redirectUri) {
  try {
    const response = await axios.post(MAL_TOKEN_URL, {
      client_id: MAL_CLIENT_ID,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error exchanging MAL code:', error);
    throw new Error(`Failed to exchange MAL code: ${error.message}`);
  }
}

/**
 * Fetch user's anime list from MyAnimeList using OAuth token
 * @param {string} accessToken - OAuth access token
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<import('../types.js').UserProfile>}
 */
export async function fetchMALUserWithToken(accessToken, progressCallback = null) {
  try {
    console.log('🔍 Starting MAL fetch with OAuth token');

    // Get user profile
    console.log('👤 Fetching MAL user profile...');
    const userResponse = await axios.get(`${MAL_API_BASE_URL}/users/@me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const userInfo = userResponse.data;

    console.log('✅ MAL user profile retrieved:', {
      id: userInfo.id,
      name: userInfo.name
    });

    await delay(1000); // Rate limit delay

    // Get user's completed anime list
    let allAnimeList = [];
    let nextUrl = `${MAL_API_BASE_URL}/users/@me/animelist?status=completed&limit=1000&fields=list_status,anime{id,title,main_picture,genres,num_episodes,media_type,start_date,synopsis}`;
    let currentPage = 1;
    let estimatedTotalPages = null;

    while (nextUrl) {
      try {
        console.log(`📄 Fetching MAL page ${currentPage}...`);

        // Send progress update if callback provided
        if (progressCallback) {
          const message = estimatedTotalPages
            ? `Pobieranie strony ${currentPage} z ~${estimatedTotalPages} z MyAnimeList...`
            : `Pobieranie strony ${currentPage} z MyAnimeList...`;
          progressCallback(currentPage, estimatedTotalPages, message);
        }

        const listResponse = await axios.get(nextUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        const pageData = listResponse.data;
        const pageItems = pageData.data || [];
        allAnimeList = allAnimeList.concat(pageItems);

        // Get next page URL from paging
        nextUrl = pageData.paging?.next || null;

        console.log(`✅ MAL page ${currentPage} fetched:`, {
          itemsOnPage: pageItems.length,
          totalItems: allAnimeList.length,
          hasNextPage: !!nextUrl
        });

        // Send progress update
        if (progressCallback) {
          const progressMessage = `Pobrano ${currentPage} stron z MyAnimeList (${allAnimeList.length} anime)`;
          progressCallback(currentPage, null, progressMessage);
        }

        currentPage++;
        await delay(1000); // Rate limit delay

      } catch (error) {
        if (error.response?.status === 429) {
          // Rate limited, wait longer
          console.log(`⏳ MAL rate limited on page ${currentPage}, waiting 5 seconds...`);
          await delay(5000);
          continue;
        }
        console.error(`❌ Error fetching MAL page ${currentPage}:`, error.message);
        throw error;
      }
    }

    console.log('🔍 Filtering for completed fantasy anime from', allAnimeList.length, 'completed MAL entries...');

    // Filter for completed fantasy anime and map to our format
    const fantasyAnime = [];

    for (const entry of allAnimeList) {
      // Check if anime has fantasy genre
      const hasFantasy = entry.node.genres?.some(genre => genre.name.toLowerCase().includes('fantasy'));

      if (hasFantasy) {
        fantasyAnime.push({
          id: entry.node.id,
          title: entry.node.title,
          score: entry.list_status.score || null,
          status: 'completed',
          genres: entry.node.genres?.map(g => g.name) || [],
          coverImage: entry.node.main_picture?.large || entry.node.main_picture?.medium,
          episodes: entry.node.num_episodes,
          source: 'mal',
          format: entry.node.media_type,
          year: entry.node.start_date ? new Date(entry.node.start_date).getFullYear() : null,
          description: entry.node.synopsis
        });
      }
    }

    console.log('✅ MAL fantasy filtering complete:', {
      totalEntries: allAnimeList.length,
      fantasyEntries: fantasyAnime.length,
      percentage: Math.round((fantasyAnime.length / allAnimeList.length) * 100) + '%'
    });

    const result = {
      username: userInfo.name,
      platform: 'mal',
      avatar: userInfo.picture || null,
      animeCount: allAnimeList.length,
      meanScore: 0, // We'll calculate this from the scores
      fantasyAnime
    };

    // Calculate mean score from completed anime
    const scoredAnime = allAnimeList.filter(entry => entry.list_status.score > 0);
    if (scoredAnime.length > 0) {
      const totalScore = scoredAnime.reduce((sum, entry) => sum + entry.list_status.score, 0);
      result.meanScore = Math.round((totalScore / scoredAnime.length) * 100) / 100;
    }

    console.log('🎉 MAL user fetch completed:', {
      username: result.username,
      totalAnime: result.animeCount,
      fantasyAnime: result.fantasyAnime.length,
      meanScore: result.meanScore
    });

    return result;

  } catch (error) {
    console.error('Error fetching MAL user with token:', error);
    throw new Error(`Failed to fetch MAL user: ${error.message}`);
  }
}

/**
 * Fetch user's anime list from MyAnimeList using public API with Client ID
 * @param {string} username - MyAnimeList username
 * @param {string} filterType - 'fantasy' or 'isekai'
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<import('../types.js').UserProfile>}
 */
/**
 * Fetch user's anime list from MyAnimeList for both fantasy and isekai simultaneously
 * @param {string} username - MyAnimeList username
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<{fantasy: Object, isekai: Object}>}
 */
export async function fetchMALUserBoth(username, progressCallback = null) {
  try {
    console.log('🔍 Starting MAL fetch for both fantasy and isekai for user:', username);

    // Get user's completed anime list using official MAL API with pagination
    let allAnimeList = [];
    let offset = 0;
    const limit = 1000; // Maximum allowed by API
    let hasMoreData = true;
    let currentPage = 1;

    console.log(`📡 Fetching completed anime list for ${username}...`);

    while (hasMoreData) {
      try {
        console.log(`📄 Fetching MAL page ${currentPage} for ${username} (offset: ${offset})...`);

        // Send progress update if callback provided
        if (progressCallback) {
          progressCallback(currentPage, null, `Pobieranie strony ${currentPage} z MyAnimeList...`);
        }

        const response = await axios.get(`${MAL_API_BASE_URL}/users/${username}/animelist`, {
          headers: {
            'X-MAL-CLIENT-ID': MAL_CLIENT_ID
          },
          params: {
            status: 'completed',
            limit: limit,
            offset: offset,
            fields: 'list_status,node{id,title,main_picture,num_episodes,media_type,start_date,synopsis}'
          }
        });

        const pageData = response.data;
        const pageItems = pageData.data || [];
        allAnimeList = allAnimeList.concat(pageItems);

        // Check if we have more data
        hasMoreData = pageItems.length === limit;
        offset += limit;

        console.log(`✅ MAL page ${currentPage} fetched:`, {
          itemsOnPage: pageItems.length,
          totalItems: allAnimeList.length,
          hasMoreData,
          nextOffset: offset
        });

        // Send progress update
        if (progressCallback) {
          const progressMessage = `Pobrano ${currentPage} stron z MyAnimeList (${allAnimeList.length} anime)`;
          progressCallback(currentPage, null, progressMessage);
        }

        currentPage++;
        await delay(1000); // Rate limit delay

      } catch (error) {
        if (error.response?.status === 429) {
          // Rate limited, wait longer
          console.log(`⏳ MAL rate limited on page ${currentPage}, waiting 5 seconds...`);
          await delay(5000);
          continue;
        }
        console.error(`❌ Error fetching MAL page ${currentPage}:`, error.message);
        throw error;
      }
    }

    console.log(`🔍 Filtering for both Fantasy and Isekai anime from ${allAnimeList.length} completed anime entries using Jikan API`);

    const fantasyAnime = [];
    const isekaiAnime = [];
    let processedCount = 0;

    // Use Jikan API to filter for both fantasy and isekai simultaneously
    for (const entry of allAnimeList) {
      try {
        processedCount++;

        // Send progress update
        if (progressCallback && processedCount % 10 === 0) {
          const progressPercent = Math.round((processedCount / allAnimeList.length) * 100);
          progressCallback(null, null, `Sprawdzanie anime: ${processedCount}/${allAnimeList.length} (${progressPercent}%)`);
        }

        console.log(`🔍 [${processedCount}/${allAnimeList.length}] Fetching Jikan data for: "${entry.node.title}"`);

        // Fetch detailed anime information from Jikan API (includes both genres and themes)
        const jikanData = await fetchAnimeThemes(entry.node.id);

        // Check for fantasy genre
        const genres = jikanData.genres || [];
        const hasFantasy = genres.some(genre =>
          genre.name.toLowerCase().includes('fantasy')
        );

        // Check for isekai theme
        const themes = jikanData.themes || [];
        const hasIsekai = themes.some(theme =>
          theme.name.toLowerCase().includes('isekai')
        );

        // Create anime object if it matches either filter
        if (hasFantasy || hasIsekai) {
          const animeObject = {
            id: jikanData.mal_id,
            malId: jikanData.mal_id, // For MAL entries, malId is the same as id
            title: jikanData.title,
            score: entry.list_status.score || null,
            status: 'completed',
            genres: jikanData.genres?.map(g => g.name) || [],
            themes: jikanData.themes?.map(t => t.name) || [],
            coverImage: jikanData.images?.jpg?.large_image_url || entry.node.main_picture?.large || entry.node.main_picture?.medium,
            episodes: jikanData.episodes || entry.node.num_episodes,
            source: 'mal',
            format: jikanData.type || entry.node.media_type,
            year: jikanData.year || (entry.node.start_date ? new Date(entry.node.start_date).getFullYear() : null),
            description: jikanData.synopsis || entry.node.synopsis
          };

          if (hasFantasy) {
            console.log(`🎭 Found fantasy anime: "${jikanData.title}" with genres: [${genres.map(g => g.name).join(', ')}]`);
            fantasyAnime.push(animeObject);
          }

          if (hasIsekai) {
            console.log(`🌍 Found isekai anime: "${jikanData.title}" with themes: [${themes.map(t => t.name).join(', ')}]`);
            isekaiAnime.push(animeObject);
          }
        }

        // Rate limiting for Jikan API (1 request per second)
        await delay(1000);

      } catch (error) {
        console.error(`❌ Error fetching Jikan data for anime ID ${entry.node.id}:`, error.message);
        // Continue with next anime
        continue;
      }
    }

    console.log(`✅ Processed ${processedCount} anime entries`);

    // Send final progress update
    if (progressCallback) {
      progressCallback(null, null, `Zakończono sprawdzanie: ${fantasyAnime.length} fantasy, ${isekaiAnime.length} isekai`);
    }

    console.log(`✅ MAL dual filtering complete:`, {
      totalEntries: allAnimeList.length,
      fantasyEntries: fantasyAnime.length,
      isekaiEntries: isekaiAnime.length,
      fantasyPercentage: Math.round((fantasyAnime.length / allAnimeList.length) * 100) + '%',
      isekaiPercentage: Math.round((isekaiAnime.length / allAnimeList.length) * 100) + '%'
    });

    // Calculate mean score from completed anime
    const scoredAnime = allAnimeList.filter(entry => entry.list_status.score > 0);
    const meanScore = scoredAnime.length > 0
      ? Math.round((scoredAnime.reduce((sum, entry) => sum + entry.list_status.score, 0) / scoredAnime.length) * 100) / 100
      : 0;

    const fantasyResult = {
      username: username,
      platform: 'mal',
      avatar: null,
      animeCount: allAnimeList.length,
      meanScore: meanScore,
      fantasyAnime
    };

    const isekaiResult = {
      username: username,
      platform: 'mal',
      avatar: null,
      animeCount: allAnimeList.length,
      meanScore: meanScore,
      isekaiAnime
    };

    console.log('🎉 MAL dual user fetch completed:', {
      username: username,
      totalAnime: allAnimeList.length,
      fantasyAnime: fantasyAnime.length,
      isekaiAnime: isekaiAnime.length,
      meanScore: meanScore
    });

    return {
      fantasy: fantasyResult,
      isekai: isekaiResult
    };

  } catch (error) {
    console.error('Error fetching MAL user (both):', error);
    throw new Error(`Failed to fetch MAL user: ${error.message}`);
  }
}

export async function fetchMALUser(username, filterType = 'fantasy', progressCallback = null) {
  try {
    console.log('🔍 Starting MAL fetch for user:', username);

    if (!MAL_CLIENT_ID || MAL_CLIENT_ID === 'your-client-id-here') {
      throw new Error('MyAnimeList Client ID is not configured. Please set MAL_CLIENT_ID in environment variables.');
    }

    // Get user's completed anime list using official MAL API with pagination
    let allAnimeList = [];
    let offset = 0;
    const limit = 1000; // Maximum allowed by API
    let hasMoreData = true;
    let currentPage = 1;

    console.log(`📡 Fetching completed anime list for ${username}...`);

    while (hasMoreData) {
      try {
        console.log(`📄 Fetching MAL page ${currentPage} for ${username} (offset: ${offset})...`);

        // Send progress update if callback provided
        if (progressCallback) {
          progressCallback(currentPage, null, `Pobieranie strony ${currentPage} z MyAnimeList...`);
        }

        const response = await axios.get(`${MAL_API_BASE_URL}/users/${username}/animelist`, {
          headers: {
            'X-MAL-CLIENT-ID': MAL_CLIENT_ID
          },
          params: {
            status: 'completed',
            limit: limit,
            offset: offset,
            fields: 'list_status,node{id,title,main_picture,genres,num_episodes,media_type,start_date,synopsis}'
          }
        });

        const pageData = response.data;
        const pageItems = pageData.data || [];
        allAnimeList = allAnimeList.concat(pageItems);

        // Check if we have more data
        hasMoreData = pageItems.length === limit;
        offset += limit;

        console.log(`✅ MAL page ${currentPage} fetched:`, {
          itemsOnPage: pageItems.length,
          totalItems: allAnimeList.length,
          hasMoreData,
          nextOffset: offset
        });

        // Send progress update
        if (progressCallback) {
          const progressMessage = `Pobrano ${currentPage} stron z MyAnimeList (${allAnimeList.length} anime)`;
          progressCallback(currentPage, null, progressMessage);
        }

        currentPage++;
        await delay(1000); // Rate limit delay

      } catch (error) {
        if (error.response?.status === 429) {
          // Rate limited, wait longer
          console.log(`⏳ MAL rate limited on page ${currentPage}, waiting 5 seconds...`);
          await delay(5000);
          continue;
        }
        console.error(`❌ Error fetching MAL page ${currentPage}:`, error.message);
        throw error;
      }
    }

    console.log(`🔍 Filtering for both Fantasy and Isekai anime from ${allAnimeList.length} completed anime entries using Jikan API`);

    const fantasyAnime = [];
    const isekaiAnime = [];
    let processedCount = 0;

    // Use Jikan API to filter for both fantasy and isekai simultaneously
    for (const entry of allAnimeList) {
      try {
        processedCount++;

        // Send progress update
        if (progressCallback && processedCount % 10 === 0) {
          const progressPercent = Math.round((processedCount / allAnimeList.length) * 100);
          progressCallback(null, null, `Sprawdzanie anime: ${processedCount}/${allAnimeList.length} (${progressPercent}%)`);
        }

        console.log(`🔍 [${processedCount}/${allAnimeList.length}] Fetching Jikan data for: "${entry.node.title}"`);

        // Fetch detailed anime information from Jikan API (includes both genres and themes)
        const jikanData = await fetchAnimeThemes(entry.node.id);

        // Check for fantasy genre
        const genres = jikanData.genres || [];
        const hasFantasy = genres.some(genre =>
          genre.name.toLowerCase().includes('fantasy')
        );

        // Check for isekai theme
        const themes = jikanData.themes || [];
        const hasIsekai = themes.some(theme =>
          theme.name.toLowerCase().includes('isekai')
        );

        // Create anime object if it matches either filter
        if (hasFantasy || hasIsekai) {
          const animeObject = {
            id: jikanData.mal_id,
            malId: jikanData.mal_id, // For MAL entries, malId is the same as id
            title: jikanData.title,
            score: entry.list_status.score || null,
            status: 'completed',
            genres: jikanData.genres?.map(g => g.name) || [],
            themes: jikanData.themes?.map(t => t.name) || [],
            coverImage: jikanData.images?.jpg?.large_image_url || entry.node.main_picture?.large || entry.node.main_picture?.medium,
            episodes: jikanData.episodes || entry.node.num_episodes,
            source: 'mal',
            format: jikanData.type || entry.node.media_type,
            year: jikanData.year || (entry.node.start_date ? new Date(entry.node.start_date).getFullYear() : null),
            description: jikanData.synopsis || entry.node.synopsis
          };

          if (hasFantasy) {
            console.log(`🎭 Found fantasy anime: "${jikanData.title}" with genres: [${genres.map(g => g.name).join(', ')}]`);
            fantasyAnime.push(animeObject);
          }

          if (hasIsekai) {
            console.log(`🌍 Found isekai anime: "${jikanData.title}" with themes: [${themes.map(t => t.name).join(', ')}]`);
            isekaiAnime.push(animeObject);
          }
        }

        // Rate limiting for Jikan API (1 request per second)
        await delay(1000);

      } catch (error) {
        console.error(`❌ Error fetching Jikan data for anime ID ${entry.node.id}:`, error.message);
        // Continue with next anime
        continue;
      }
    }

    // Return the requested filter type
    const filteredAnime = filterType === 'fantasy' ? fantasyAnime : isekaiAnime;

    console.log(`✅ Processed ${processedCount} anime entries`);

    // Send final progress update
    if (progressCallback) {
      progressCallback(null, null, `Zakończono sprawdzanie: ${filteredAnime.length} anime ${filterType} znaleziono`);
    }

    console.log(`✅ MAL dual filtering complete:`, {
      totalEntries: allAnimeList.length,
      fantasyEntries: fantasyAnime.length,
      isekaiEntries: isekaiAnime.length,
      requestedFilter: filterType,
      returnedEntries: filteredAnime.length,
      fantasyPercentage: Math.round((fantasyAnime.length / allAnimeList.length) * 100) + '%',
      isekaiPercentage: Math.round((isekaiAnime.length / allAnimeList.length) * 100) + '%'
    });

    // Calculate mean score from completed anime
    const scoredAnime = allAnimeList.filter(entry => entry.list_status.score > 0);
    const meanScore = scoredAnime.length > 0
      ? Math.round((scoredAnime.reduce((sum, entry) => sum + entry.list_status.score, 0) / scoredAnime.length) * 100) / 100
      : 0;

    const result = {
      username: username, // Use provided username since API doesn't return user info
      platform: 'mal',
      avatar: null, // Not available from this API endpoint
      animeCount: allAnimeList.length,
      meanScore: meanScore,
      [filterType === 'fantasy' ? 'fantasyAnime' : 'isekaiAnime']: filteredAnime
    };

    console.log('🎉 MAL user fetch completed:', {
      username: result.username,
      totalAnime: result.animeCount,
      [filterType + 'Anime']: filteredAnime.length,
      meanScore: result.meanScore
    });

    return result;
  } catch (error) {
    console.error('Error fetching MAL user:', error);
    throw new Error(`Failed to fetch MAL user: ${error.message}`);
  }
}

/**
 * Search for anime by title on MyAnimeList via Jikan API
 * @param {string} title - Anime title to search for
 * @returns {Promise<Object|null>}
 */
export async function searchMALAnime(title) {
  try {
    const response = await axios.get(`${JIKAN_BASE_URL}/anime`, {
      params: {
        q: title,
        limit: 1
      }
    });

    const results = response.data.data;
    if (results.length === 0) return null;

    const anime = results[0];
    return {
      id: anime.mal_id,
      title: anime.title,
      genres: anime.genres.map(g => g.name),
      coverImage: anime.images.jpg.large_image_url,
      episodes: anime.episodes,
      format: anime.type,
      year: anime.year,
      description: anime.synopsis
    };
  } catch (error) {
    console.error('Error searching MAL anime:', error);
    return null;
  }
}

/**
 * Get detailed anime information from MAL
 * @param {number} malId - MyAnimeList anime ID
 * @returns {Promise<Object|null>}
 */
export async function getMALAnimeDetails(malId) {
  try {
    const response = await axios.get(`${JIKAN_BASE_URL}/anime/${malId}`);
    const anime = response.data.data;

    return {
      id: anime.mal_id,
      title: anime.title,
      genres: anime.genres.map(g => g.name),
      coverImage: anime.images.jpg.large_image_url,
      episodes: anime.episodes,
      format: anime.type,
      year: anime.year,
      description: anime.synopsis,
      score: anime.score,
      popularity: anime.popularity,
      rank: anime.rank
    };
  } catch (error) {
    console.error('Error getting MAL anime details:', error);
    return null;
  }
}
