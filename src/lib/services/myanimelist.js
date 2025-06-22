import axios from 'axios';
import { GraphQLClient } from 'graphql-request';
import dotenv from 'dotenv';
dotenv.config();
const MAL_API_BASE_URL = 'https://api.myanimelist.net/v2';
const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || process.env.VITE_MAL_CLIENT_ID || 'your-client-id-here';

// OAuth2 URLs
const MAL_AUTH_URL = 'https://myanimelist.net/v1/oauth2/authorize';
const MAL_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';

// AniList GraphQL client for isekai detection
const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const anilistClient = new GraphQLClient(ANILIST_ENDPOINT);

/**
 * Add delay between requests to respect API rate limits
 * @param {number} ms - Milliseconds to wait
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch isekai detection from AniList using malIds
 * @param {number[]} malIds - Array of MyAnimeList IDs
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Object>} Object mapping malId to isekai detection result
 */
async function fetchIsekaiFromAniList(malIds, progressCallback = null) {
  const isekaiMap = {};
  const batchSize = 10; // Process in batches to avoid overwhelming the API

  console.log(`🔍 Fetching isekai detection from AniList for ${malIds.length} anime...`);

  for (let i = 0; i < malIds.length; i += batchSize) {
    const batch = malIds.slice(i, i + batchSize);

    if (progressCallback) {
      progressCallback(
        Math.floor(i / batchSize) + 1,
        Math.ceil(malIds.length / batchSize),
        `Sprawdzanie tagów isekai: ${i + 1}-${Math.min(i + batchSize, malIds.length)}/${malIds.length}`
      );
    }

    // GraphQL query to fetch anime by malIds
    const query = `
      query ($malIds: [Int]) {
        Page(page: 1, perPage: ${batchSize}) {
          media(idMal_in: $malIds, type: ANIME) {
            id
            idMal
            title {
              romaji
              english
              native
            }
            tags {
              name
              rank
            }
            genres
          }
        }
      }
    `;

    try {
      const data = await anilistClient.request(query, { malIds: batch });

      if (data.Page && data.Page.media) {
        for (const anime of data.Page.media) {
          if (anime.idMal) {
            // Check for isekai tag with >80% rank
            const hasIsekaiTag = anime.tags?.some(tag =>
              tag.name.toLowerCase() === 'isekai' && tag.rank >= 80
            );

            // Check for fantasy genre
            const hasFantasy = anime.genres?.includes('Fantasy');

            isekaiMap[anime.idMal] = {
              hasIsekai: hasIsekaiTag,
              hasFantasy: hasFantasy,
              title: anime.title.english || anime.title.romaji || anime.title.native,
              isekaiRank: hasIsekaiTag ? anime.tags.find(t => t.name.toLowerCase() === 'isekai')?.rank : null
            };

            if (hasIsekaiTag) {
              console.log(`🌍 Found isekai anime via AniList: "${isekaiMap[anime.idMal].title}" (rank: ${isekaiMap[anime.idMal].isekaiRank}%)`);
            } else if (hasFantasy) {
              console.log(`🎭 Found fantasy anime via AniList: "${isekaiMap[anime.idMal].title}"`);
            }
          }
        }
      }

      // Rate limiting for AniList API (2 seconds as requested)
      await delay(2000);

    } catch (error) {
      console.error(`Error fetching AniList data for batch ${i}-${i + batchSize}:`, error.message);
      // Continue with next batch
    }
  }

  console.log(`✅ AniList isekai detection completed. Found ${Object.values(isekaiMap).filter(a => a.hasIsekai).length} isekai and ${Object.values(isekaiMap).filter(a => a.hasFantasy).length} fantasy anime.`);

  return isekaiMap;
}

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

    // Extract malIds for AniList isekai detection
    const malIds = allAnimeList.map(entry => entry.node.id);

    // Fetch isekai detection from AniList using malIds
    console.log(`🔍 Fetching isekai/fantasy classification from AniList for ${malIds.length} anime...`);
    const isekaiMap = await fetchIsekaiFromAniList(malIds, progressCallback);

    // Process each anime entry using AniList classification
    console.log(`🔍 Processing ${allAnimeList.length} anime entries with AniList classification...`);

    const fantasyAnime = [];
    const isekaiAnime = [];

    for (const entry of allAnimeList) {
      try {
        const malId = entry.node.id;
        const classification = isekaiMap[malId];

        // Create anime object if it matches either filter
        if (classification?.hasIsekai || classification?.hasFantasy) {
          const animeObject = {
            id: entry.node.id,
            malId: entry.node.id, // For MAL entries, malId is the same as id
            title: entry.node.title,
            score: entry.list_status.score || null,
            status: 'completed',
            genres: [], // Will be populated from AniList if available
            themes: [], // Not using themes anymore, using AniList tags
            coverImage: entry.node.main_picture?.large || entry.node.main_picture?.medium,
            episodes: entry.node.num_episodes,
            source: 'mal',
            format: entry.node.media_type,
            year: entry.node.start_date ? new Date(entry.node.start_date).getFullYear() : null,
            description: entry.node.synopsis
          };

          // Classify anime using AniList data (fantasy and isekai can overlap)
          if (classification.hasIsekai) {
            console.log(`🌍 Classified as isekai via AniList: "${entry.node.title}" (rank: ${classification.isekaiRank}%)`);
            isekaiAnime.push(animeObject);
          }
          if (classification.hasFantasy) {
            console.log(`🎭 Classified as fantasy via AniList: "${entry.node.title}"`);
            fantasyAnime.push(animeObject);
          }
        }

      } catch (error) {
        console.error(`❌ Error processing anime "${entry.node.title}":`, error.message);
        // Continue with next anime
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

    // Extract malIds for AniList isekai detection
    const malIds = allAnimeList.map(entry => entry.node.id);

    // Fetch isekai detection from AniList using malIds
    console.log(`🔍 Fetching isekai/fantasy classification from AniList for ${malIds.length} anime...`);
    const isekaiMap = await fetchIsekaiFromAniList(malIds, progressCallback);

    // Process each anime entry using AniList classification
    console.log(`🔍 Processing ${allAnimeList.length} anime entries with AniList classification...`);

    const fantasyAnime = [];
    const isekaiAnime = [];

    for (const entry of allAnimeList) {
      try {
        const malId = entry.node.id;
        const classification = isekaiMap[malId];

        // Create anime object if it matches either filter
        if (classification?.hasIsekai || classification?.hasFantasy) {
          const animeObject = {
            id: entry.node.id,
            malId: entry.node.id, // For MAL entries, malId is the same as id
            title: entry.node.title,
            score: entry.list_status.score || null,
            status: 'completed',
            genres: [], // Will be populated from AniList if available
            themes: [], // Not using themes anymore, using AniList tags
            coverImage: entry.node.main_picture?.large || entry.node.main_picture?.medium,
            episodes: entry.node.num_episodes,
            source: 'mal',
            format: entry.node.media_type,
            year: entry.node.start_date ? new Date(entry.node.start_date).getFullYear() : null,
            description: entry.node.synopsis
          };

          // Classify anime using AniList data (fantasy and isekai can overlap)
          if (classification.hasIsekai) {
            console.log(`🌍 Classified as isekai via AniList: "${entry.node.title}" (rank: ${classification.isekaiRank}%)`);
            isekaiAnime.push(animeObject);
          }
          if (classification.hasFantasy) {
            console.log(`🎭 Classified as fantasy via AniList: "${entry.node.title}"`);
            fantasyAnime.push(animeObject);
          }
        }

      } catch (error) {
        console.error(`❌ Error processing anime "${entry.node.title}":`, error.message);
        // Continue with next anime
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
 * Search for anime by title on AniList (since we're using AniList for classification)
 * @param {string} title - Anime title to search for
 * @returns {Promise<Object|null>}
 */
export async function searchMALAnime(title) {
  try {
    const query = `
      query ($search: String!) {
        Media(search: $search, type: ANIME) {
          id
          idMal
          title {
            romaji
            english
            native
          }
          genres
          coverImage {
            large
          }
          episodes
          format
          startDate {
            year
          }
          description
        }
      }
    `;

    const data = await anilistClient.request(query, { search: title });

    if (!data.Media) return null;

    const anime = data.Media;
    return {
      id: anime.idMal || anime.id,
      title: anime.title.english || anime.title.romaji || anime.title.native,
      genres: anime.genres || [],
      coverImage: anime.coverImage?.large || '',
      episodes: anime.episodes || 0,
      format: anime.format || 'unknown',
      year: anime.startDate?.year || null,
      description: anime.description || ''
    };
  } catch (error) {
    console.error('Error searching anime via AniList:', error);
    return null;
  }
}

/**
 * Get detailed anime information from AniList using malId
 * @param {number} malId - MyAnimeList anime ID
 * @returns {Promise<Object|null>}
 */
export async function getMALAnimeDetails(malId) {
  try {
    const query = `
      query ($malId: Int!) {
        Media(idMal: $malId, type: ANIME) {
          id
          idMal
          title {
            romaji
            english
            native
          }
          genres
          tags {
            name
            rank
          }
          coverImage {
            large
          }
          episodes
          format
          startDate {
            year
          }
          description
          averageScore
          popularity
        }
      }
    `;

    const data = await anilistClient.request(query, { malId });

    if (!data.Media) return null;

    const anime = data.Media;
    return {
      id: anime.idMal || anime.id,
      title: anime.title.english || anime.title.romaji || anime.title.native,
      genres: anime.genres || [],
      coverImage: anime.coverImage?.large || '',
      episodes: anime.episodes || 0,
      format: anime.format || 'unknown',
      year: anime.startDate?.year || null,
      description: anime.description || '',
      score: anime.averageScore ? anime.averageScore / 10 : null, // Convert from 0-100 to 0-10 scale
      popularity: anime.popularity || null,
      rank: null // AniList doesn't provide rank in the same way
    };
  } catch (error) {
    console.error('Error getting anime details via AniList:', error);
    return null;
  }
}
