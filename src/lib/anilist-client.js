// Client-side AniList GraphQL utilities

// Rate limiting utilities for AniList
const rateLimiter = {
	anilist: { lastRequest: 0, minInterval: 4000 } // 2 seconds between AniList requests
};

async function waitForRateLimit(platform) {
	const now = Date.now();
	const limiter = rateLimiter[platform];
	const timeSinceLastRequest = now - limiter.lastRequest;

	if (timeSinceLastRequest < limiter.minInterval) {
		await new Promise(resolve => setTimeout(resolve, limiter.minInterval - timeSinceLastRequest));
	}

	limiter.lastRequest = Date.now();
}

// Fetch anime classification from AniList using malIds in batches
export async function fetchAnimeClassification(malIds, progressCallback) {
	const classificationMap = {};
	const batchSize = 50; // Process in batches to avoid overwhelming the API
	const totalBatches = Math.ceil(malIds.length / batchSize);

	console.log(`🔍 Fetching anime classification from AniList for ${malIds.length} anime...`);

	for (let i = 0; i < malIds.length; i += batchSize) {
		const batch = malIds.slice(i, i + batchSize);
		const currentBatch = Math.floor(i / batchSize) + 1;

		// Send progress update
		if (progressCallback) {
			const progress = Math.floor((currentBatch / totalBatches) * 100);
			progressCallback({
				stage: 'classifying',
				message: `Classifying anime (${currentBatch}/${totalBatches} batches)...`,
				progress,
				current: currentBatch,
				total: totalBatches
			});
		}

		await waitForRateLimit('anilist');

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
			const response = await fetch('https://graphql.anilist.co', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					query,
					variables: { malIds: batch }
				})
			});

			if (!response.ok) {
				console.error(`AniList API error for batch ${currentBatch}: ${response.status} ${response.statusText}`);
				continue;
			}

			const data = await response.json();

			if (data.errors) {
				console.error(`AniList GraphQL errors for batch ${currentBatch}:`, data.errors);
				continue;
			}

			if (data.data?.Page?.media) {
				for (const anime of data.data.Page.media) {
					if (anime.idMal) {
						// Check for isekai tag with >80% rank
						const hasIsekaiTag = anime.tags?.some(tag => tag.name.toLowerCase() === 'isekai' && tag.rank >= 80);

						// Check for fantasy genre
						const hasFantasy = anime.genres?.includes('Fantasy');

						classificationMap[anime.idMal] = {
							hasIsekai: hasIsekaiTag,
							hasFantasy: hasFantasy,
							title: anime.title.english || anime.title.romaji || anime.title.native,
							isekaiRank: hasIsekaiTag ? anime.tags.find(t => t.name.toLowerCase() === 'isekai')?.rank : null,
							genres: anime.genres || [],
							tags: anime.tags?.filter(tag => tag.rank >= 80).map(tag => tag.name) || []
						};

						if (hasIsekaiTag) {
							console.log(`🌍 Found isekai anime: "${classificationMap[anime.idMal].title}" (rank: ${classificationMap[anime.idMal].isekaiRank}%)`);
						} else if (hasFantasy) {
							console.log(`🎭 Found fantasy anime: "${classificationMap[anime.idMal].title}"`);
						}
					}
				}
			}
		} catch (error) {
			console.error(`Error fetching AniList data for batch ${currentBatch}:`, error.message);
			// Continue with next batch
		}
	}

	console.log(
		`✅ AniList classification completed. Found ${Object.values(classificationMap).filter(a => a.hasIsekai).length} isekai and ${Object.values(classificationMap).filter(a => a.hasFantasy).length} fantasy anime.`
	);

	return classificationMap;
}

// Apply classification to anime list
export function applyClassificationToAnimeList(animeList, classificationMap) {
	return animeList.map(anime => {
		const classification = classificationMap[anime.malId];

		if (classification) {
			return {
				...anime,
				hasIsekai: classification.hasIsekai,
				hasFantasy: classification.hasFantasy,
				isekaiRank: classification.isekaiRank,
				genres: classification.genres,
				themes: classification.tags
			};
		}

		// If no classification found, set defaults
		return {
			...anime,
			hasIsekai: false,
			hasFantasy: false,
			isekaiRank: null,
			genres: anime.genres || [],
			themes: anime.themes || []
		};
	});
}
