import { GraphQLClient } from 'graphql-request';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const client = new GraphQLClient(ANILIST_ENDPOINT);

/**
 * GraphQL query to get user's anime list with fantasy genre
 */
const USER_ANIME_LIST_QUERY = `
  query ($username: String!, $page: Int, $perPage: Int) {
    User(name: $username) {
      id
      name
      avatar {
        large
      }
      statistics {
        anime {
          count
          meanScore
        }
      }
      mediaListOptions {
        scoreFormat
      }
    }
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        hasNextPage
        currentPage
        lastPage
      }
      mediaList(userName: $username, type: ANIME, status_in: [COMPLETED]) {
        id
        score
        status
        media {
          id
          idMal
          title {
            romaji
            english
            native
          }
          coverImage {
            large
            medium
          }
          genres
          tags {
            name
            rank
          }
          episodes
          format
          startDate {
            year
          }
          description
        }
      }
    }
  }
`;

/**
 * Fetch user's anime list from AniList for both fantasy and isekai simultaneously
 * @param {string} username - AniList username
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<{fantasy: Object, isekai: Object}>}
 */
export async function fetchAniListUserBoth(username, progressCallback = null) {
  try {
    console.log('🔍 Starting AniList fetch for both fantasy and isekai for user:', username);
    let allMediaList = [];
    let currentPage = 1;
    let hasNextPage = true;
    let userInfo = null;
    let estimatedTotalPages = null;

    // Fetch all pages of the user's anime list
    while (hasNextPage) {
      try {
        console.log(`📄 Fetching AniList page ${currentPage} for ${username}...`);

        // Send progress update if callback provided
        if (progressCallback) {
          const message = estimatedTotalPages
            ? `Pobieranie strony ${currentPage} z ~${estimatedTotalPages} z AniList...`
            : `Pobieranie strony ${currentPage} z AniList...`;
          progressCallback(currentPage, estimatedTotalPages, message);
        }

        const data = await client.request(USER_ANIME_LIST_QUERY, {
          username,
          page: currentPage,
          perPage: 50
        });

        if (!data.User) {
          throw new Error(`User "${username}" not found on AniList`);
        }

        // Store user info from first page
        if (currentPage === 1) {
          userInfo = data.User;

          // Estimate total pages based on anime count
          const totalAnime = userInfo.statistics.anime.count;
          estimatedTotalPages = Math.ceil(totalAnime / 50);
          console.log(`📊 User has ${totalAnime} total anime, estimated ${estimatedTotalPages} pages`);
        }

        // Add media list entries from this page
        if (data.Page.mediaList) {
          allMediaList.push(...data.Page.mediaList);
          console.log(`📄 Page ${currentPage}: ${data.Page.mediaList.length} entries (total: ${allMediaList.length})`);
        }

        hasNextPage = data.Page.pageInfo.hasNextPage;
        currentPage++;

        // Add delay to respect rate limits (2 seconds as requested)
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        if (error.response?.status === 429) {
          // Rate limited, wait longer and retry
          console.log(`⏳ Rate limited on page ${currentPage}, waiting 60 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 60000));
          continue; // Retry the same page
        }
        console.error(`❌ Error fetching page ${currentPage}:`, error.message);
        throw error; // Re-throw other errors
      }
    }

    console.log(`🔍 Filtering for completed fantasy and isekai anime from`, allMediaList.length, 'total completed entries...');

    // Filter for completed fantasy anime (check for Fantasy genre)
    const fantasyAnime = allMediaList
      .filter(entry => {
        const isCompleted = entry.status === 'COMPLETED';
        const hasFantasy = entry.media.genres.includes('Fantasy');

        if (hasFantasy) {
          console.log(`🎭 Found fantasy anime: "${entry.media.title.english || entry.media.title.romaji}"`);
        }

        return isCompleted && hasFantasy;
      })
      .map(entry => ({
        id: entry.media.id,
        malId: entry.media.idMal,
        title: entry.media.title.english || entry.media.title.romaji || entry.media.title.native,
        score: entry.score || null,
        status: 'completed',
        genres: entry.media.genres,
        coverImage: entry.media.coverImage?.large || entry.media.coverImage?.medium,
        episodes: entry.media.episodes,
        source: 'anilist',
        format: entry.media.format,
        year: entry.media.startDate?.year,
        description: entry.media.description
      }));

    // Filter for completed isekai anime (check for Isekai tag with >80% rating)
    const isekaiAnime = allMediaList
      .filter(entry => {
        const isCompleted = entry.status === 'COMPLETED';
        const hasIsekaiTag = entry.media.tags?.some(tag =>
          tag.name.toLowerCase() === 'isekai' && tag.rank >= 80
        );

        if (hasIsekaiTag) {
          console.log(`🌍 Found isekai anime: "${entry.media.title.english || entry.media.title.romaji}" with Isekai tag rank: ${entry.media.tags.find(t => t.name.toLowerCase() === 'isekai')?.rank}%`);
        }

        return isCompleted && hasIsekaiTag;
      })
      .map(entry => ({
        id: entry.media.id,
        malId: entry.media.idMal,
        title: entry.media.title.english || entry.media.title.romaji || entry.media.title.native,
        score: entry.score || null,
        status: 'completed',
        genres: entry.media.genres,
        coverImage: entry.media.coverImage?.large || entry.media.coverImage?.medium,
        episodes: entry.media.episodes,
        source: 'anilist',
        format: entry.media.format,
        year: entry.media.startDate?.year,
        description: entry.media.description
      }));

    const fantasyResult = {
      username: userInfo.name,
      platform: 'anilist',
      avatar: userInfo.avatar?.large,
      animeCount: userInfo.statistics.anime.count,
      meanScore: userInfo.statistics.anime.meanScore,
      fantasyAnime: fantasyAnime
    };

    const isekaiResult = {
      username: userInfo.name,
      platform: 'anilist',
      avatar: userInfo.avatar?.large,
      animeCount: userInfo.statistics.anime.count,
      meanScore: userInfo.statistics.anime.meanScore,
      isekaiAnime: isekaiAnime
    };

    console.log('🎉 AniList dual user fetch completed:', {
      username: userInfo.name,
      totalAnime: userInfo.statistics.anime.count,
      fantasyAnime: fantasyAnime.length,
      isekaiAnime: isekaiAnime.length,
      meanScore: userInfo.statistics.anime.meanScore
    });

    return {
      fantasy: fantasyResult,
      isekai: isekaiResult
    };

  } catch (error) {
    console.error('Error fetching AniList user (both):', error);
    throw new Error(`Failed to fetch AniList user: ${error.message}`);
  }
}

/**
 * Fetch user's anime list from AniList
 * @param {string} username - AniList username
 * @param {string} filterType - 'fantasy' or 'isekai'
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<import('../types.js').UserProfile>}
 */
export async function fetchAniListUser(username, filterType = 'fantasy', progressCallback = null) {
  try {
    console.log('🔍 Starting AniList fetch for user:', username);
    let allMediaList = [];
    let currentPage = 1;
    let hasNextPage = true;
    let userInfo = null;
    let estimatedTotalPages = null;

    // Fetch all pages of the user's anime list
    while (hasNextPage) {
      try {
        console.log(`📄 Fetching AniList page ${currentPage} for ${username}...`);

        // Send progress update if callback provided
        if (progressCallback) {
          const message = estimatedTotalPages
            ? `Pobieranie strony ${currentPage} z ~${estimatedTotalPages} z AniList...`
            : `Pobieranie strony ${currentPage} z AniList...`;
          progressCallback(currentPage, estimatedTotalPages, message);
        }

        const data = await client.request(USER_ANIME_LIST_QUERY, {
          username,
          page: currentPage,
          perPage: 50
        });

        if (!userInfo) {
          userInfo = data.User;
          // Calculate estimated total pages based on completed anime count
          // We're only fetching completed anime, so we need to estimate
          const completedAnimeCount = userInfo.statistics.anime.count;
          estimatedTotalPages = Math.ceil(completedAnimeCount / 50);

          console.log('👤 User info retrieved:', {
            name: userInfo.name,
            totalAnimeCount: userInfo.statistics.anime.count,
            meanScore: userInfo.statistics.anime.meanScore,
            estimatedPages: estimatedTotalPages
          });
        }

        const pageMediaList = data.Page.mediaList || [];
        allMediaList = allMediaList.concat(pageMediaList);
        hasNextPage = data.Page.pageInfo.hasNextPage;

        console.log(`✅ Page ${currentPage} fetched:`, {
          itemsOnPage: pageMediaList.length,
          totalItems: allMediaList.length,
          hasNextPage,
          estimatedTotal: estimatedTotalPages
        });

        // Send progress update with estimated total pages
        if (progressCallback && estimatedTotalPages) {
          const progressMessage = `Pobrano ${currentPage} z ~${estimatedTotalPages} stron z AniList (${allMediaList.length} anime)`;
          progressCallback(currentPage, estimatedTotalPages, progressMessage);
        }

        currentPage++;

        // Add delay to respect rate limits (2 seconds as requested)
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        if (error.response?.status === 429) {
          // Rate limited, wait longer and retry
          console.log(`⏳ Rate limited on page ${currentPage}, waiting 60 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 60000));
          continue; // Retry the same page
        }
        console.error(`❌ Error fetching page ${currentPage}:`, error.message);
        throw error; // Re-throw other errors
      }
    }

    console.log(`🔍 Filtering for completed ${filterType} anime from`, allMediaList.length, 'total completed entries...');

    let filteredAnime;

    if (filterType === 'fantasy') {
      // Filter for completed fantasy anime (check for Fantasy genre)
      filteredAnime = allMediaList
        .filter(entry => {
          const isCompleted = entry.status === 'COMPLETED';
          const hasFantasy = entry.media.genres.includes('Fantasy');

          if (hasFantasy) {
            console.log(`🎭 Found fantasy anime: "${entry.media.title.english || entry.media.title.romaji}"`);
          }

          return isCompleted && hasFantasy;
        })
        .map(entry => ({
          id: entry.media.id,
          malId: entry.media.idMal,
          title: entry.media.title.english || entry.media.title.romaji,
          score: entry.score,
          status: 'completed',
          genres: entry.media.genres,
          tags: entry.media.tags?.filter(tag => tag.rank >= 80).map(tag => ({ name: tag.name, rank: tag.rank })) || [],
          coverImage: entry.media.coverImage.large,
          episodes: entry.media.episodes,
          source: 'anilist',
          format: entry.media.format,
          year: entry.media.startDate?.year,
          description: entry.media.description
        }));
    } else if (filterType === 'isekai') {
      // Filter for completed isekai anime (check for Isekai tag with >80% rating)
      filteredAnime = allMediaList
        .filter(entry => {
          const isCompleted = entry.status === 'COMPLETED';
          const hasIsekaiTag = entry.media.tags?.some(tag =>
            tag.name.toLowerCase() === 'isekai' && tag.rank >= 80
          );

          if (hasIsekaiTag) {
            console.log(`🌍 Found isekai anime: "${entry.media.title.english || entry.media.title.romaji}" with Isekai tag rank: ${entry.media.tags.find(t => t.name.toLowerCase() === 'isekai')?.rank}%`);
          }

          return isCompleted && hasIsekaiTag;
        })
        .map(entry => ({
          id: entry.media.id,
          title: entry.media.title.english || entry.media.title.romaji,
          score: entry.score,
          status: 'completed',
          genres: entry.media.genres,
          tags: entry.media.tags?.filter(tag => tag.rank >= 80).map(tag => ({ name: tag.name, rank: tag.rank })) || [],
          coverImage: entry.media.coverImage.large,
          episodes: entry.media.episodes,
          source: 'anilist',
          format: entry.media.format,
          year: entry.media.startDate?.year,
          description: entry.media.description
        }));
    }

    console.log(`✅ ${filterType} filtering complete:`, {
      totalEntries: allMediaList.length,
      filteredEntries: filteredAnime.length,
      percentage: Math.round((filteredAnime.length / allMediaList.length) * 100) + '%'
    });

    const result = {
      username: userInfo.name,
      platform: 'anilist',
      avatar: userInfo.avatar?.large,
      animeCount: userInfo.statistics.anime.count,
      meanScore: userInfo.statistics.anime.meanScore,
      [filterType === 'fantasy' ? 'fantasyAnime' : 'isekaiAnime']: filteredAnime
    };

    console.log('🎉 AniList user fetch completed:', {
      username: result.username,
      totalAnime: result.animeCount,
      [filterType + 'Anime']: filteredAnime.length,
      meanScore: result.meanScore
    });

    return result;
  } catch (error) {
    console.error('Error fetching AniList user:', error);
    throw new Error(`Failed to fetch AniList user: ${error.message}`);
  }
}

/**
 * Search for anime by title on AniList
 * @param {string} title - Anime title to search for
 * @returns {Promise<Object|null>}
 */
export async function searchAniListAnime(title) {
  const SEARCH_QUERY = `
    query ($search: String!) {
      Media(search: $search, type: ANIME) {
        id
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

  try {
    const data = await client.request(SEARCH_QUERY, { search: title });
    return data.Media;
  } catch (error) {
    console.error('Error searching AniList anime:', error);
    return null;
  }
}
