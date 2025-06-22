import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { fetchAniListUserBoth } from '../src/lib/services/anilist.js';
import { fetchMALUser, fetchMALUserBoth } from '../src/lib/services/myanimelist.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base users configuration
const BASE_USERS = [
  {
    name: 'Pastafarianin', // MrBall
    platform: 'mal',
    username: 'Pastafarianin'
  },
  {
    name: 'Kodjax',
    platform: 'anilist',
    username: 'Kodjax'
  },
  {
    name: 'MaYxS',
    platform: 'anilist',
    username: 'MaYxS'
  },
  {
    name: 'Blonzej',
    platform: 'anilist',
    username: 'Blonzej'
  },
];

/**
 * Download user data for both fantasy and isekai simultaneously
 */
async function downloadUserDataBoth(userConfig) {
  const { name, platform, username } = userConfig;

  console.log(`\n🔄 Pobieranie danych Fantasy i Isekai dla: ${name} (${platform})`);

  const progressCallback = (page, totalPages, message) => {
    if (totalPages) {
      console.log(`📄 ${message} [${page}/${totalPages}]`);
    } else {
      console.log(`📄 ${message}`);
    }
  };

  try {
    let fantasyData, isekaiData;

    if (platform === 'anilist') {
      // For AniList, use optimized function that fetches both fantasy and isekai in one pass
      console.log(`🎭🌍 Pobieranie anime fantasy i isekai jednocześnie dla ${name} (optymalizowane)...`);

      const bothData = await fetchAniListUserBoth(username, progressCallback);
      fantasyData = bothData.fantasy;
      isekaiData = bothData.isekai;
    } else if (platform === 'mal') {
      // For MAL, we can get both in one optimized pass using AniList API for classification
      console.log(`🎭🌍 Pobieranie anime fantasy i isekai jednocześnie dla ${name} (optymalizowane)...`);

      const bothData = await fetchMALUserBoth(username, progressCallback);
      fantasyData = bothData.fantasy;
      isekaiData = bothData.isekai;
    } else {
      throw new Error(`Nieobsługiwana platforma: ${platform}`);
    }

    console.log(`✅ Pobrano dane dla ${name}:`, {
      username: fantasyData.username,
      platform: fantasyData.platform,
      totalAnime: fantasyData.animeCount,
      fantasyAnime: fantasyData.fantasyAnime?.length || 0,
      isekaiAnime: isekaiData.isekaiAnime?.length || 0,
      meanScore: fantasyData.meanScore
    });

    return {
      fantasy: fantasyData,
      isekai: isekaiData
    };

  } catch (error) {
    console.error(`❌ Błąd podczas pobierania danych dla ${name}:`, error.message);
    throw error;
  }
}

/**
 * Save user data to file
 */
function saveUserData(userData, filterType, outputDir) {
  const filename = `${userData.username.toLowerCase()}-${userData.platform}-${filterType}.json`;
  const filepath = join(outputDir, filename);

  const animeArray = userData[filterType === 'fantasy' ? 'fantasyAnime' : 'isekaiAnime'] || [];

  // Create a clean version without circular references
  const cleanData = {
    username: userData.username,
    platform: userData.platform,
    avatar: userData.avatar,
    animeCount: userData.animeCount,
    meanScore: userData.meanScore,
    filterType: filterType,
    [filterType === 'fantasy' ? 'fantasyAnime' : 'isekaiAnime']: animeArray.map(anime => ({
      id: anime.id,
      malId: anime.malId, // Include MAL ID for better matching
      title: anime.title,
      score: anime.score,
      status: anime.status,
      genres: anime.genres || [],
      tags: anime.tags || [],
      themes: anime.themes || [],
      coverImage: anime.coverImage,
      episodes: anime.episodes,
      source: anime.source,
      format: anime.format,
      year: anime.year,
      description: anime.description ? anime.description.substring(0, 500) : null
    })),
    downloadedAt: new Date().toISOString()
  };

  writeFileSync(filepath, JSON.stringify(cleanData, null, 2), 'utf8');
  console.log(`💾 Zapisano dane ${filterType} do: ${filepath}`);

  return filepath;
}

/**
 * Create combined base users file for specific filter type
 */
function createCombinedFile(usersData, filterType, outputDir) {
  const combinedData = {
    baseUsers: usersData.reduce((acc, userData) => {
      const key = userData.username.toLowerCase();
      acc[key] = userData;
      return acc;
    }, {}),
    metadata: {
      downloadedAt: new Date().toISOString(),
      filterType: filterType,
      totalUsers: usersData.length,
      totalAnime: usersData.reduce((sum, user) => {
        const animeArray = user[filterType === 'fantasy' ? 'fantasyAnime' : 'isekaiAnime'] || [];
        return sum + animeArray.length;
      }, 0)
    }
  };

  const filepath = join(outputDir, `base-users-${filterType}.json`);
  writeFileSync(filepath, JSON.stringify(combinedData, null, 2), 'utf8');
  console.log(`📦 Utworzono plik zbiorczy ${filterType}: ${filepath}`);

  return filepath;
}

/**
 * Check if MAL Client ID is configured
 */
function checkMALClientID() {
  const clientId = process.env.MAL_CLIENT_ID;

  if (!clientId || clientId === 'your-mal-client-id-here') {
    console.error('❌ MAL_CLIENT_ID nie jest skonfigurowane!');
    console.error('📋 Aby pobrać dane z MyAnimeList:');
    console.error('   1. Przejdź do: https://myanimelist.net/apiconfig');
    console.error('   2. Utwórz nową aplikację');
    console.error('   3. Skopiuj Client ID');
    console.error('   4. Utwórz plik .env i dodaj: MAL_CLIENT_ID=twoj-client-id');
    console.error('   5. Uruchom skrypt ponownie');
    return false;
  }

  return true;
}

/**
 * Main function
 */
async function main() {
  console.log('🏮 Karczma Kompas - Pobieranie danych Fantasy i Isekai');
  console.log('='.repeat(60));

  // Check MAL configuration
  const hasMALUsers = BASE_USERS.some(user => user.platform === 'mal');
  const clientIdConfigured = checkMALClientID();

  if (hasMALUsers && !clientIdConfigured) {
    console.log('\n⚠️ Pomijanie użytkowników MyAnimeList z powodu braku konfiguracji');
    console.log('📝 Tylko użytkownicy AniList zostaną pobrani');
  }

  // Create output directory
  const outputDir = join(__dirname, '..', 'src', 'lib', 'data');
  try {
    mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Utworzono katalog: ${outputDir}`);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }

  // Download data for both fantasy and isekai (optimized for MAL)
  const downloadedUsersData = { fantasy: [], isekai: [] };

  for (const userConfig of BASE_USERS) {
    // Skip MAL users if Client ID is not configured
    if (userConfig.platform === 'mal' && !clientIdConfigured) {
      console.log(`⏭️ Pomijanie ${userConfig.name} (MAL) - brak konfiguracji Client ID`);
      continue;
    }

    try {
      const userData = await downloadUserDataBoth(userConfig);

      // Save both fantasy and isekai data
      saveUserData(userData.fantasy, 'fantasy', outputDir);
      saveUserData(userData.isekai, 'isekai', outputDir);

      downloadedUsersData.fantasy.push(userData.fantasy);
      downloadedUsersData.isekai.push(userData.isekai);

      // Add delay between users to respect rate limits
      if (BASE_USERS.indexOf(userConfig) < BASE_USERS.length - 1) {
        const delayTime = userConfig.platform === 'mal' ? 30000 : 10000; // 30s for MAL (uses AniList for classification), 10s for AniList
        console.log(`⏳ Oczekiwanie ${delayTime / 1000} sekund przed następnym użytkownikiem...`);
        await new Promise(resolve => setTimeout(resolve, delayTime));
      }

    } catch (error) {
      console.error(`💥 Nie udało się pobrać danych dla ${userConfig.name}`);
      // Continue with other users
    }
  }

  // Create combined files for both filter types
  const filterTypes = ['fantasy', 'isekai'];

  for (const filterType of filterTypes) {
    const downloadedUsers = downloadedUsersData[filterType];

    if (downloadedUsers.length > 0) {
      createCombinedFile(downloadedUsers, filterType, outputDir);

      console.log(`\n🎉 Plik ${filterType} utworzony!`);
      console.log(`✅ Dane dla ${downloadedUsers.length} użytkowników`);
      console.log('📊 Podsumowanie:');

      downloadedUsers.forEach(user => {
        const animeCount = user[filterType === 'fantasy' ? 'fantasyAnime' : 'isekaiAnime']?.length || 0;
        console.log(`  • ${user.username} (${user.platform}): ${animeCount} anime ${filterType}`);
      });

    } else {
      console.log(`\n❌ Nie udało się pobrać danych ${filterType} dla żadnego użytkownika`);
    }
  }

  console.log('\n🏁 Wszystkie pobierania zakończone!');
}

// Run the script directly
main().catch(error => {
  console.error('💥 Krytyczny błąd:', error);
  process.exit(1);
});
