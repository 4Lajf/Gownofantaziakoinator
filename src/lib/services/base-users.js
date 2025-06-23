import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the base users data file
const BASE_USERS_FILE = join(__dirname, '..', 'data', 'base-users.json');

// Fallback mock data in case the file doesn't exist
const FALLBACK_BASE_USERS = {
	kodjax: {
		username: 'Kodjax',
		platform: 'anilist',
		avatar: 'https://s4.anilist.co/file/anilistcdn/user/avatar/large/b5358-kmKgbWjhHSNs.png',
		animeCount: 850,
		meanScore: 8.2,
		isekaiAnime: [
			{
				id: 101922,
				title: 'That Time I Got Reincarnated as a Slime',
				score: 9,
				status: 'completed',
				genres: ['Fantasy', 'Adventure'],
				tags: [{ name: 'Isekai', rank: 95 }],
				coverImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-PEn1CTc93blC.png',
				episodes: 24,
				source: 'anilist',
				format: 'TV',
				year: 2018
			},
			{
				id: 21049,
				title: 'Re:Zero - Starting Life in Another World',
				score: 8,
				status: 'completed',
				genres: ['Drama', 'Fantasy', 'Psychological', 'Romance', 'Supernatural', 'Thriller'],
				tags: [{ name: 'Isekai', rank: 92 }],
				coverImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21049-NMgczz0iBRuO.png',
				episodes: 25,
				source: 'anilist',
				format: 'TV',
				year: 2016
			}
		]
	},
	pastafarianin: {
		username: 'Pastafarianin',
		platform: 'mal',
		avatar: 'https://cdn.myanimelist.net/images/userimages/default_userimages/default1.jpg',
		animeCount: 720,
		meanScore: 7.8,
		isekaiAnime: [
			{
				id: 39468,
				title: "Konosuba: God's Blessing on This Wonderful World!",
				score: 9,
				status: 'completed',
				genres: ['Adventure', 'Comedy', 'Fantasy'],
				themes: ['Isekai', 'Parody'],
				coverImage: 'https://cdn.myanimelist.net/images/anime/8/77831l.jpg',
				episodes: 10,
				source: 'mal',
				format: 'TV',
				year: 2016
			},
			{
				id: 40748,
				title: 'Overlord',
				score: 8,
				status: 'completed',
				genres: ['Action', 'Adventure', 'Fantasy'],
				themes: ['Isekai'],
				coverImage: 'https://cdn.myanimelist.net/images/anime/7/88019l.jpg',
				episodes: 13,
				source: 'mal',
				format: 'TV',
				year: 2015
			}
		]
	}
};

/**
 * Load base users data from file for specific filter type
 * @param {string} filterType - 'fantasy' or 'isekai'
 * @returns {Object} Base users data
 */
export function loadBaseUsers(filterType = 'fantasy') {
	try {
		const filePath = join(__dirname, '..', 'data', `base-users-${filterType}.json`);
		console.log(`📂 Loading base users (${filterType}) from file:`, filePath);
		const fileContent = readFileSync(filePath, 'utf8');
		const data = JSON.parse(fileContent);

		console.log(`✅ Base users (${filterType}) loaded from file:`, {
			users: Object.keys(data.baseUsers),
			downloadedAt: data.metadata?.downloadedAt,
			totalAnime: data.metadata?.totalAnime,
			filterType: data.metadata?.filterType
		});

		return data.baseUsers;
	} catch (error) {
		console.warn(`⚠️ Could not load base users (${filterType}) from file, using fallback data:`, error.message);
		return FALLBACK_BASE_USERS;
	}
}

/**
 * Get Kodjax profile for specific filter type
 * @param {string} filterType - 'fantasy' or 'isekai'
 * @returns {import('../types.js').UserProfile}
 */
export function getKodjaxProfile(filterType = 'fantasy') {
	const baseUsers = loadBaseUsers(filterType);
	return baseUsers.kodjax || FALLBACK_BASE_USERS.kodjax;
}

/**
 * Get Pastafarianin (MrBall) profile for specific filter type
 * @param {string} filterType - 'fantasy' or 'isekai'
 * @returns {import('../types.js').UserProfile}
 */
export function getPastafarianinProfile(filterType = 'fantasy') {
	const baseUsers = loadBaseUsers(filterType);
	return baseUsers.pastafarianin || FALLBACK_BASE_USERS.pastafarianin;
}

/**
 * Get all base users for specific filter type
 * @param {string} filterType - 'fantasy' or 'isekai'
 * @returns {Object} Object with kodjax and pastafarianin profiles
 */
export function getAllBaseUsers(filterType = 'fantasy') {
	return {
		kodjax: getKodjaxProfile(filterType),
		pastafarianin: getPastafarianinProfile(filterType)
	};
}

/**
 * Check if base users data is available and fresh
 * @returns {Object} Status information
 */
export function getBaseUsersStatus() {
	try {
		const fileContent = readFileSync(BASE_USERS_FILE, 'utf8');
		const data = JSON.parse(fileContent);

		const downloadedAt = new Date(data.metadata?.downloadedAt);
		const now = new Date();
		const ageInHours = (now - downloadedAt) / (1000 * 60 * 60);

		return {
			available: true,
			fromFile: true,
			downloadedAt: downloadedAt.toISOString(),
			ageInHours: Math.round(ageInHours * 100) / 100,
			totalUsers: Object.keys(data.baseUsers).length,
			totalIsekaiAnime: data.metadata?.totalIsekaiAnime || 0,
			users: Object.keys(data.baseUsers).map(key => ({
				username: data.baseUsers[key].username,
				platform: data.baseUsers[key].platform,
				isekaiCount: data.baseUsers[key].isekaiAnime?.length || 0
			}))
		};
	} catch (error) {
		return {
			available: true,
			fromFile: false,
			fallback: true,
			error: error.message,
			totalUsers: Object.keys(FALLBACK_BASE_USERS).length,
			users: Object.keys(FALLBACK_BASE_USERS).map(key => ({
				username: FALLBACK_BASE_USERS[key].username,
				platform: FALLBACK_BASE_USERS[key].platform,
				isekaiCount: FALLBACK_BASE_USERS[key].isekaiAnime?.length || 0
			}))
		};
	}
}
