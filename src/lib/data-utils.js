import fantasyData from '../data/base-users-fantasy.json';
import isekaiData from '../data/base-users-isekai.json';
import fantasyData2 from '../data2/base-users-fantasy.json';
import isekaiData2 from '../data2/base-users-isekai.json';

// Load base users data for the specified mode and comparison type
export function loadBaseUsersData(mode, comparisonMode = '2-user') {
	if (comparisonMode === '4-user') {
		return mode === 'fantasy' ? fantasyData2 : isekaiData2;
	}
	return mode === 'fantasy' ? fantasyData : isekaiData;
}

// Get anime list for a specific base user and mode
export function getBaseUserAnimeList(username, mode, comparisonMode = '2-user') {
	const data = loadBaseUsersData(mode, comparisonMode);
	const user = data.baseUsers[username];

	if (!user) {
		return [];
	}

	let animeList;
	if (mode === 'fantasy') {
		animeList = user.fantasyAnime || [];
	} else {
		animeList = user.isekaiAnime || [];
	}

	// Apply score translation if needed (pass user data for scoreFormat detection)
	return applyScoreTranslation(animeList, username, user);
}

// Filter anime list based on mode criteria
export function filterAnimeByMode(animeList, mode) {
	if (mode === 'fantasy') {
		return animeList.filter(anime => 
			anime.genres.includes('Fantasy') ||
			anime.themes.some(theme => theme.toLowerCase().includes('fantasy'))
		);
	} else if (mode === 'isekai') {
		return animeList.filter(anime => 
			anime.themes.includes('Isekai') ||
			anime.themes.some(theme => theme.toLowerCase().includes('isekai'))
		);
	}
	return animeList;
}

// Find common anime between user and base users
export function findCommonAnime(userAnimeList, pastafarianinList, kodjaxList) {
	const comparisons = [];

	for (const userAnime of userAnimeList) {
		// Prioritize malId for matching since base users are on different platforms
		const pastafarianinAnime = pastafarianinList.find(anime => {
			// First try malId matching (most reliable for cross-platform)
			if (anime.malId && userAnime.malId && anime.malId === userAnime.malId) {
				return true;
			}
			// Fallback to platform-specific ID matching
			if (anime.id === userAnime.id) {
				return true;
			}
			// Last resort: title matching (case-insensitive, trimmed)
			const animeTitle = anime.title.toLowerCase().trim();
			const userTitle = userAnime.title.toLowerCase().trim();
			return animeTitle === userTitle;
		});

		const kodjaxAnime = kodjaxList.find(anime => {
			// First try malId matching (most reliable for cross-platform)
			if (anime.malId && userAnime.malId && anime.malId === userAnime.malId) {
				return true;
			}
			// Fallback to platform-specific ID matching
			if (anime.id === userAnime.id) {
				return true;
			}
			// Last resort: title matching (case-insensitive, trimmed)
			const animeTitle = anime.title.toLowerCase().trim();
			const userTitle = userAnime.title.toLowerCase().trim();
			return animeTitle === userTitle;
		});

		if (pastafarianinAnime || kodjaxAnime) {
			const comparison = {
				anime: userAnime,
				userScore: userAnime.score,
				pastafarianinScore: pastafarianinAnime?.score,
				kodjaxScore: kodjaxAnime?.score,
				pastafarianinDeviation: pastafarianinAnime ? Math.abs(userAnime.score - pastafarianinAnime.score) : undefined,
				kodjaxDeviation: kodjaxAnime ? Math.abs(userAnime.score - kodjaxAnime.score) : undefined
			};

			comparisons.push(comparison);
		}
	}

	return comparisons;
}

// Calculate spectrum position based on score deviations
export function calculateSpectrumPosition(comparisons) {
	const validComparisons = comparisons.filter(c =>
		c.pastafarianinDeviation !== undefined && c.kodjaxDeviation !== undefined
	);

	if (validComparisons.length === 0) {
		return 50; // Default to middle if no valid comparisons
	}

	let totalDeviationFromKodjax = 0;
	let totalDeviationFromPastafarianin = 0;

	for (const comparison of validComparisons) {
		totalDeviationFromKodjax += comparison.kodjaxDeviation || 0;
		totalDeviationFromPastafarianin += comparison.pastafarianinDeviation || 0;
	}

	const avgDeviationFromKodjax = totalDeviationFromKodjax / validComparisons.length;
	const avgDeviationFromPastafarianin = totalDeviationFromPastafarianin / validComparisons.length;

	// Calculate position on spectrum (0 = Kodjax side, 100 = MrBall side)
	// Lower deviation means closer alignment
	// If deviation from Kodjax is lower, position should be closer to 0
	// If deviation from MrBall is lower, position should be closer to 100

	const totalDeviation = avgDeviationFromKodjax + avgDeviationFromPastafarianin;

	if (totalDeviation === 0) {
		return 50; // Perfect alignment with both (unlikely)
	}

	// Invert the logic: higher deviation from Kodjax means further from Kodjax (higher position)
	return (avgDeviationFromKodjax / totalDeviation) * 100;
}

// Calculate average deviation from a base user
export function calculateAverageDeviation(comparisons, baseUser) {
	const deviations = comparisons
		.map(c => baseUser === 'kodjax' ? c.kodjaxDeviation : c.pastafarianinDeviation)
		.filter(d => d !== undefined);

	if (deviations.length === 0) return 0;

	return deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;
}

// Calculate confidence score based on number of common anime
export function calculateConfidence(commonAnimeCount) {
	// Confidence increases with more common anime, capped at 100%
	// 50+ common anime = 100% confidence
	return Math.min(100, (commonAnimeCount / 50) * 100);
}

// Generate spectrum result for a user
export function generateSpectrumResult(userAnimeList, mode, comparisonMode = '2-user') {
	if (comparisonMode === '4-user') {
		return generate4UserCompassResult(userAnimeList, mode);
	}

	const pastafarianinList = getBaseUserAnimeList('pastafarianin', mode, comparisonMode);
	const kodjaxList = getBaseUserAnimeList('kodjax', mode, comparisonMode);

	// Apply score translation to user's anime list if needed
	const filteredUserList = filterAnimeByMode(userAnimeList.animeList, mode);
	const translatedUserList = applyScoreTranslation(filteredUserList, userAnimeList.username, userAnimeList);
	const commonAnime = findCommonAnime(translatedUserList, pastafarianinList, kodjaxList);

	const spectrumPosition = calculateSpectrumPosition(commonAnime);
	const avgDeviationFromKodjax = calculateAverageDeviation(commonAnime, 'kodjax');
	const avgDeviationFromPastafarianin = calculateAverageDeviation(commonAnime, 'pastafarianin');
	const confidence = calculateConfidence(commonAnime.length);

	const resultData = {
		username: userAnimeList.username,
		platform: userAnimeList.platform,
		mode,
		comparisonMode,
		spectrumPosition,
		commonAnime,
		totalCommonAnime: commonAnime.length,
		averageDeviationFromKodjax: avgDeviationFromKodjax,
		averageDeviationFromPastafarianin: avgDeviationFromPastafarianin,
		confidence,
		scoreFormat: userAnimeList.scoreFormat // Pass through scoreFormat
	};

	console.log('📈 Generated 2-user result:', {
		username: resultData.username,
		platform: resultData.platform,
		scoreFormat: resultData.scoreFormat
	});

	return resultData;
}

// Find common anime between user and all 4 base users
export function findCommonAnime4Users(userAnimeList, pastafarianinList, kodjaxList, mayxsList, blonzejList) {
	const comparisons = [];

	for (const userAnime of userAnimeList) {
		const baseUsers = {
			pastafarianin: pastafarianinList.find(anime => matchAnime(anime, userAnime)),
			kodjax: kodjaxList.find(anime => matchAnime(anime, userAnime)),
			mayxs: mayxsList.find(anime => matchAnime(anime, userAnime)),
			blonzej: blonzejList.find(anime => matchAnime(anime, userAnime))
		};

		// Only include if at least one base user has this anime
		if (Object.values(baseUsers).some(anime => anime)) {
			const comparison = {
				anime: userAnime,
				userScore: userAnime.score,
				pastafarianinScore: baseUsers.pastafarianin?.score,
				kodjaxScore: baseUsers.kodjax?.score,
				mayxsScore: baseUsers.mayxs?.score,
				blonzejScore: baseUsers.blonzej?.score,
				// Keep original scores and scoring systems for display
				pastafarianinOriginalScore: baseUsers.pastafarianin?.originalScore,
				kodjaxOriginalScore: baseUsers.kodjax?.originalScore,
				mayxsOriginalScore: baseUsers.mayxs?.originalScore,
				blonzejOriginalScore: baseUsers.blonzej?.originalScore,
				pastafarianinScoringSystem: baseUsers.pastafarianin?.scoringSystem,
				kodjaxScoringSystem: baseUsers.kodjax?.scoringSystem,
				mayxsScoringSystem: baseUsers.mayxs?.scoringSystem,
				blonzejScoringSystem: baseUsers.blonzej?.scoringSystem,
				pastafarianinDeviation: baseUsers.pastafarianin ? Math.abs(userAnime.score - baseUsers.pastafarianin.score) : undefined,
				kodjaxDeviation: baseUsers.kodjax ? Math.abs(userAnime.score - baseUsers.kodjax.score) : undefined,
				mayxsDeviation: baseUsers.mayxs ? Math.abs(userAnime.score - baseUsers.mayxs.score) : undefined,
				blonzejDeviation: baseUsers.blonzej ? Math.abs(userAnime.score - baseUsers.blonzej.score) : undefined
			};

			comparisons.push(comparison);
		}
	}

	return comparisons;
}

// Helper function to match anime between different platforms
function matchAnime(baseAnime, userAnime) {
	// First try malId matching (most reliable for cross-platform)
	if (baseAnime.malId && userAnime.malId && baseAnime.malId === userAnime.malId) {
		return true;
	}
	// Fallback to platform-specific ID matching
	if (baseAnime.id === userAnime.id) {
		return true;
	}
	// Last resort: title matching (case-insensitive, trimmed)
	const baseTitle = baseAnime.title.toLowerCase().trim();
	const userTitle = userAnime.title.toLowerCase().trim();
	return baseTitle === userTitle;
}

// Get scoring system from user data or fall back to detection
function getScoringSystem(userData, username) {
	// First check if we have scoreFormat from AniList API
	if (userData && userData.scoreFormat) {
		return userData.scoreFormat;
	}

	// Known users with specific scoring systems (fallback)
	const knownScoringUsers = {
		'blonzej': 'POINT_3' // Known to use smiley system
	};

	return knownScoringUsers[username.toLowerCase()] || 'POINT_10_DECIMAL';
}

// Translate scores based on AniList scoring system
function translateScore(score, scoringSystem) {
	switch (scoringSystem) {
		case 'POINT_3': // 3-point smiley system
			if (score === 1) return 3.5;
			if (score === 2) return 6.0;
			if (score === 3) return 8.5;
			return score;

		case 'POINT_5': // 5-star system (uses values 10, 30, 50, 70, 90)
			if (score === 10) return 1.0;  // 1 star
			if (score === 30) return 3.0;  // 2 stars
			if (score === 50) return 5.0;  // 3 stars
			if (score === 70) return 7.0;  // 4 stars
			if (score === 90) return 9.0;  // 5 stars
			return score;

		case 'POINT_100': // 100-point system
			return score / 10; // Convert to 10-point scale

		case 'POINT_10': // 10-point system (whole numbers)
		case 'POINT_10_DECIMAL': // 10-point decimal system
		default:
			return score; // No conversion needed
	}
}

// Apply score translation based on user's scoring system
function applyScoreTranslation(animeList, username, userData = null) {
	// Get the scoring system for this user
	const scoringSystem = getScoringSystem(userData, username);

	console.log('📊 Score translation for', username, ':', {
		scoringSystem,
		userData: userData ? { scoreFormat: userData.scoreFormat, platform: userData.platform } : 'null',
		sampleScores: animeList.slice(0, 3).map(a => a.score)
	});

	// Only apply translation if it's not the standard 10-point decimal system
	if (scoringSystem !== 'POINT_10_DECIMAL' && scoringSystem !== 'POINT_10') {
		const translatedList = animeList.map(anime => ({
			...anime,
			originalScore: anime.score,
			scoringSystem: scoringSystem,
			score: anime.score ? translateScore(anime.score, scoringSystem) : anime.score
		}));

		console.log('📊 Applied translation:', {
			originalSample: animeList.slice(0, 3).map(a => a.score),
			translatedSample: translatedList.slice(0, 3).map(a => a.score)
		});

		return translatedList;
	}

	return animeList;
}



// Calculate 2D position for 4-user compass (political compass style)
export function calculate2DPosition(comparisons) {
	// Filter comparisons that have at least 2 base users with scores
	const validComparisons = comparisons.filter(c => {
		const scores = [c.pastafarianinDeviation, c.kodjaxDeviation, c.mayxsDeviation, c.blonzejDeviation];
		return scores.filter(s => s !== undefined).length >= 2;
	});

	if (validComparisons.length === 0) {
		return { x: 50, y: 50 }; // Default to center if no valid comparisons
	}

	// Calculate average deviations for each base user
	const avgDeviations = {
		pastafarianin: calculateAverageDeviationFor4User(validComparisons, 'pastafarianin'),
		kodjax: calculateAverageDeviationFor4User(validComparisons, 'kodjax'),
		mayxs: calculateAverageDeviationFor4User(validComparisons, 'mayxs'),
		blonzej: calculateAverageDeviationFor4User(validComparisons, 'blonzej')
	};

	// --- NEW NORMALIZATION LOGIC ---
	// This method makes the result more dynamic by "stretching" the scale.
	// It finds the best (min) and worst (max) deviation and maps all four
	// deviations to a 0-1 scale within that range. This exaggerates small
	// differences and prevents results from clustering in the center.

	const devValues = Object.values(avgDeviations);
	const minDev = Math.min(...devValues);
	const maxDev = Math.max(...devValues);
	const devRange = maxDev - minDev;

	// If all deviations are identical, the user is perfectly in the middle.
	if (devRange === 0) {
		return { x: 50, y: 50 };
	}

	// Calculate an "alikeness" score (1.0 for best match, 0.0 for worst match)
	const alikeness = {
		pastafarianin: 1 - ((avgDeviations.pastafarianin - minDev) / devRange),
		kodjax: 1 - ((avgDeviations.kodjax - minDev) / devRange),
		mayxs: 1 - ((avgDeviations.mayxs - minDev) / devRange),
		blonzej: 1 - ((avgDeviations.blonzej - minDev) / devRange)
	};
	
	// Use the "alikeness" scores to determine the pull on each axis
	const leftPull = alikeness.pastafarianin + alikeness.mayxs;
	const rightPull = alikeness.kodjax + alikeness.blonzej;
	const topPull = alikeness.pastafarianin + alikeness.kodjax;
	const bottomPull = alikeness.mayxs + alikeness.blonzej;

	const totalXPull = leftPull + rightPull;
	const totalYPull = topPull + bottomPull;
	
	const x = totalXPull > 0 ? (rightPull / totalXPull) * 100 : 50;
	const y = totalYPull > 0 ? (bottomPull / totalYPull) * 100 : 50;

	return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}


// Calculate average deviation for a specific base user in 4-user mode
function calculateAverageDeviationFor4User(comparisons, baseUser) {
	const deviationKey = `${baseUser}Deviation`;
	const deviations = comparisons
		.map(c => c[deviationKey])
		.filter(d => d !== undefined);

	if (deviations.length === 0) return 0;

	return deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;
}

// Generate 4-user compass result
export function generate4UserCompassResult(userAnimeList, mode) {
	const pastafarianinList = getBaseUserAnimeList('pastafarianin', mode, '4-user');
	const kodjaxList = getBaseUserAnimeList('kodjax', mode, '4-user');
	const mayxsList = getBaseUserAnimeList('mayxs', mode, '4-user');
	const blonzejList = getBaseUserAnimeList('blonzej', mode, '4-user');

	// Apply score translation to user's anime list if needed
	const filteredUserList = filterAnimeByMode(userAnimeList.animeList, mode);
	const translatedUserList = applyScoreTranslation(filteredUserList, userAnimeList.username, userAnimeList);
	const commonAnime = findCommonAnime4Users(translatedUserList, pastafarianinList, kodjaxList, mayxsList, blonzejList);

	const position2D = calculate2DPosition(commonAnime);
	const confidence = calculateConfidence(commonAnime.length);

	// Calculate individual deviations for detailed stats
	const avgDeviations = {
		pastafarianin: calculateAverageDeviationFor4User(commonAnime, 'pastafarianin'),
		kodjax: calculateAverageDeviationFor4User(commonAnime, 'kodjax'),
		mayxs: calculateAverageDeviationFor4User(commonAnime, 'mayxs'),
		blonzej: calculateAverageDeviationFor4User(commonAnime, 'blonzej')
	};

	const resultData = {
		username: userAnimeList.username,
		platform: userAnimeList.platform,
		mode,
		comparisonMode: '4-user',
		position2D,
		commonAnime,
		totalCommonAnime: commonAnime.length,
		averageDeviations: avgDeviations,
		confidence,
		scoreFormat: userAnimeList.scoreFormat, // Pass through scoreFormat
		// Determine which quadrant the user is in
		quadrant: getQuadrant(position2D.x, position2D.y)
	};

	console.log('🧭 Generated 4-user result:', {
		username: resultData.username,
		platform: resultData.platform,
		scoreFormat: resultData.scoreFormat
	});

	return resultData;
}

// Determine which quadrant the user falls into
function getQuadrant(x, y) {
	if (x < 50 && y < 50) return 'pastafarianin'; // Top-left
	if (x >= 50 && y < 50) return 'kodjax'; // Top-right
	if (x < 50 && y >= 50) return 'mayxs'; // Bottom-left
	return 'blonzej'; // Bottom-right
}