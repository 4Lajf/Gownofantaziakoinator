/**
 * Find common anime between two users based on MAL ID or title matching
 * @param {import('../types.js').UserProfile} user1
 * @param {import('../types.js').UserProfile} user2
 * @param {string} filterType - 'fantasy' or 'isekai'
 * @returns {import('../types.js').AnimeEntry[]}
 */
export function findCommonAnime(user1, user2, filterType = 'fantasy') {
  const commonAnime = [];

  const user1Anime = user1[filterType === 'fantasy' ? 'fantasyAnime' : 'isekaiAnime'] || [];
  const user2Anime = user2[filterType === 'fantasy' ? 'fantasyAnime' : 'isekaiAnime'] || [];

  console.log(`🔍 Finding common ${filterType} anime between:`, {
    user1: user1.username,
    user1Count: user1Anime.length,
    user2: user2.username,
    user2Count: user2Anime.length
  });

  for (const anime1 of user1Anime) {
    for (const anime2 of user2Anime) {
      let isMatch = false;
      let matchType = '';

      // Use only MAL ID matching for accuracy (no title matching)
      if (anime1.malId && anime2.id && anime1.malId === anime2.id) {
        isMatch = true;
        matchType = 'MAL ID (AniList->MAL)';
      } else if (anime1.id && anime2.id && anime1.id === anime2.id && anime1.source === anime2.source) {
        isMatch = true;
        matchType = 'Same platform ID';
      } else if (anime1.malId && anime2.malId && anime1.malId === anime2.malId) {
        isMatch = true;
        matchType = 'MAL ID';
      }
      // Removed title matching to prevent incorrect matches

      if (isMatch) {
        console.log(`✅ Match found (${matchType}):`, {
          anime1: { id: anime1.id, malId: anime1.malId, title: anime1.title, source: anime1.source },
          anime2: { id: anime2.id, malId: anime2.malId, title: anime2.title, source: anime2.source }
        });

        // Create a combined entry with both users' scores
        commonAnime.push({
          ...anime1,
          user1Score: anime1.score,
          user2Score: anime2.score,
          user1Status: anime1.status,
          user2Status: anime2.status,
          // Use the better quality image if available
          coverImage: anime1.coverImage || anime2.coverImage,
          // Combine genres from both sources
          genres: [...new Set([...anime1.genres, ...anime2.genres])],
          matchType // For debugging
        });
        break;
      }
    }
  }

  console.log(`🎯 Found ${commonAnime.length} common ${filterType} anime`);
  return commonAnime;
}

/**
 * Check if two anime titles refer to the same anime
 * @param {string} title1 
 * @param {string} title2 
 * @returns {boolean}
 */
function isSameAnime(title1, title2) {
  if (!title1 || !title2) return false;
  
  // Normalize titles for comparison
  const normalize = (title) => title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  const norm1 = normalize(title1);
  const norm2 = normalize(title2);
  
  // Exact match
  if (norm1 === norm2) return true;
  
  // Check if one title contains the other (for cases like "Title" vs "Title: Subtitle")
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    // Make sure it's not a very short match
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    return shorter.length > 3;
  }
  
  // Calculate similarity ratio for fuzzy matching
  const similarity = calculateSimilarity(norm1, norm2);
  return similarity > 0.85; // 85% similarity threshold
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} Similarity ratio between 0 and 1
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number}
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate detailed anime impact analysis based on score deviations
 * @param {import('../types.js').AnimeEntry[]} commonAnime
 * @returns {Object} Detailed analysis with score deviations
 */
export function calculateAnimeImpact(commonAnime) {
  if (commonAnime.length === 0) return { animeDetails: [], averageDeviation: 0 };

  const animeDetails = commonAnime
    .filter(anime => anime.user1Score && anime.user2Score) // Only include anime both users scored
    .map(anime => {
      const score1 = normalizeScore(anime.user1Score, 10);
      const score2 = normalizeScore(anime.user2Score, 10);
      const deviation = score1 - score2; // Positive = user1 scored higher, negative = user2 scored higher
      const absoluteDeviation = Math.abs(deviation);

      return {
        ...anime,
        user1NormalizedScore: Math.round(score1 * 10) / 10,
        user2NormalizedScore: Math.round(score2 * 10) / 10,
        scoreDeviation: Math.round(deviation * 10) / 10,
        absoluteDeviation: Math.round(absoluteDeviation * 10) / 10,
        agreement: Math.round(Math.max(0, (10 - absoluteDeviation) / 10 * 100))
      };
    });

  // Sort by absolute deviation (highest differences first)
  animeDetails.sort((a, b) => b.absoluteDeviation - a.absoluteDeviation);

  const averageDeviation = animeDetails.length > 0
    ? animeDetails.reduce((sum, anime) => sum + anime.absoluteDeviation, 0) / animeDetails.length
    : 0;

  return {
    animeDetails,
    averageDeviation: Math.round(averageDeviation * 10) / 10,
    totalJointAnime: animeDetails.length
  };
}

/**
 * Calculate taste similarity based purely on score deviations of joint anime
 * @param {import('../types.js').AnimeEntry[]} commonAnime
 * @returns {number} Similarity score between 0 and 100
 */
export function calculateSimilarityScore(commonAnime) {
  // Filter to only anime that both users have scored
  const jointAnime = commonAnime.filter(anime => anime.user1Score && anime.user2Score);

  if (jointAnime.length === 0) return 0;

  let totalDeviation = 0;

  for (const anime of jointAnime) {
    // Normalize scores to 0-10 scale
    const score1 = normalizeScore(anime.user1Score, 10);
    const score2 = normalizeScore(anime.user2Score, 10);

    const deviation = Math.abs(score1 - score2);
    totalDeviation += deviation;
  }

  const averageDeviation = totalDeviation / jointAnime.length;

  // Convert average deviation to similarity percentage
  // 0 deviation = 100% similarity, 10 deviation = 0% similarity
  const similarity = Math.max(0, (10 - averageDeviation) / 10 * 100);

  return Math.round(similarity);
}

/**
 * Normalize score to a standard scale
 * @param {number} score 
 * @param {number} maxScale 
 * @returns {number}
 */
function normalizeScore(score, maxScale = 10) {
  if (!score) return 0;
  
  // Assume input scores are on 0-10 scale, but handle other scales
  if (score <= 1) return score * maxScale; // 0-1 scale
  if (score <= 5) return (score / 5) * maxScale; // 0-5 scale
  if (score <= 10) return score; // 0-10 scale
  if (score <= 100) return (score / 100) * maxScale; // 0-100 scale
  
  return Math.min(score, maxScale);
}

/**
 * Generate scatter plot data from common anime
 * @param {import('../types.js').AnimeEntry[]} commonAnime 
 * @returns {import('../types.js').ScatterPlotPoint[]}
 */
export function generateScatterPlotData(commonAnime) {
  return commonAnime
    .filter(anime => anime.user1Score && anime.user2Score)
    .map(anime => ({
      x: normalizeScore(anime.user1Score),
      y: normalizeScore(anime.user2Score),
      title: anime.title,
      id: anime.id,
      coverImage: anime.coverImage,
      genres: anime.genres
    }));
}

/**
 * Create a complete comparison between two users
 * @param {import('../types.js').UserProfile} user1
 * @param {import('../types.js').UserProfile} user2
 * @param {string} filterType - 'fantasy' or 'isekai'
 * @returns {import('../types.js').ComparisonData}
 */
export function createComparison(user1, user2, filterType = 'fantasy') {
  const animeCountKey = filterType === 'fantasy' ? 'fantasyAnime' : 'isekaiAnime';

  console.log('🔄 Creating comparison between:', {
    user1: user1.username,
    user1Platform: user1.platform,
    user1Count: user1[animeCountKey]?.length,
    user2: user2.username,
    user2Platform: user2.platform,
    user2Count: user2[animeCountKey]?.length,
    filterType
  });

  const commonAnime = findCommonAnime(user1, user2, filterType);
  console.log('🎯 Common anime found:', {
    count: commonAnime.length,
    titles: commonAnime.slice(0, 5).map(a => a.title) // Show first 5 titles
  });

  const similarityScore = calculateSimilarityScore(commonAnime);
  const animeImpactAnalysis = calculateAnimeImpact(commonAnime);

  console.log('📊 Similarity calculated:', {
    score: similarityScore,
    commonAnimeCount: commonAnime.length,
    averageImpact: animeImpactAnalysis.averageImpact
  });

  const result = {
    user1,
    user2,
    commonAnime: animeImpactAnalysis.animeDetails, // Use enhanced anime details
    similarityScore,
    animeImpactAnalysis
  };

  console.log('✅ Comparison completed:', {
    user1: result.user1.username,
    user2: result.user2.username,
    commonCount: result.commonAnime.length,
    similarity: result.similarityScore,
    topImpactAnime: result.commonAnime.slice(0, 3).map(a => ({ title: a.title, impact: a.impact }))
  });

  return result;
}
