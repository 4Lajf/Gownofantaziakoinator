import { GraphQLClient } from 'graphql-request';

// MAL API Client ID
const MAL_CLIENT_ID = '7f24090fc4335cf45b5c338e512395b3';

// AniList GraphQL client for isekai detection
const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const anilistClient = new GraphQLClient(ANILIST_ENDPOINT);

// Rate limiting utilities
const rateLimiter = {
	mal: { lastRequest: 0, minInterval: 1000 }, // 1 second between MAL requests
	anilist: { lastRequest: 0, minInterval: 2000 } // 2 seconds between AniList requests
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

// Fetch isekai detection from AniList using malIds
async function fetchIsekaiFromAniList(malIds, sendEvent) {
	const isekaiMap = {};
	const batchSize = 10; // Process in batches to avoid overwhelming the API

	console.log(`🔍 Fetching isekai detection from AniList for ${malIds.length} anime...`);

	for (let i = 0; i < malIds.length; i += batchSize) {
		const batch = malIds.slice(i, i + batchSize);

		// Send progress update
		const progress = 30 + Math.floor((i / malIds.length) * 40);
		sendEvent('progress', {
			stage: 'anilist',
			message: `Fetching classification from AniList (${i + 1}-${Math.min(i + batchSize, malIds.length)}/${malIds.length})...`,
			progress,
			current: i + 1,
			total: malIds.length
		});

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

		} catch (error) {
			console.error(`Error fetching AniList data for batch ${i}-${i + batchSize}:`, error.message);
			// Continue with next batch
		}
	}

	console.log(`✅ AniList isekai detection completed. Found ${Object.values(isekaiMap).filter(a => a.hasIsekai).length} isekai and ${Object.values(isekaiMap).filter(a => a.hasFantasy).length} fantasy anime.`);

	return isekaiMap;
}

export async function GET({ params }) {
	const { username } = params;
	
	// Set up Server-Sent Events
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			
			const sendEvent = (type, data) => {
				const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
				controller.enqueue(encoder.encode(message));
			};
			
			const processMALData = async () => {
				try {
					sendEvent('progress', { stage: 'fetching', message: 'Fetching user anime list...', progress: 10 });
					
					await waitForRateLimit('mal');
					
					// First, get the user's anime list from official MAL API
					const response = await fetch(`https://api.myanimelist.net/v2/users/${username}/animelist?fields=list_status,node(id,title,main_picture,num_episodes,media_type,start_date,synopsis)&limit=1000`, {
						headers: {
							'X-MAL-CLIENT-ID': MAL_CLIENT_ID
						}
					});
					
					if (!response.ok) {
						if (response.status === 404) {
							sendEvent('error', { error: `User "${username}" not found on MyAnimeList. Please check the username spelling and make sure the profile exists.` });
							controller.close();
							return;
						}
						if (response.status === 403) {
							sendEvent('error', { error: `User "${username}" has a private anime list on MyAnimeList. Only public anime lists can be analyzed.` });
							controller.close();
							return;
						}
						if (response.status === 401) {
							sendEvent('error', { error: `Access denied for user "${username}" on MyAnimeList. The profile may have restricted access.` });
							controller.close();
							return;
						}
						sendEvent('error', { error: `Failed to fetch data for user "${username}" from MyAnimeList: ${response.status} ${response.statusText}. Please try again or check if the username is correct.` });
						controller.close();
						return;
					}
					
					const data = await response.json();
					
					if (!data.data || !Array.isArray(data.data)) {
						sendEvent('error', { error: 'Invalid response format from MyAnimeList API' });
						controller.close();
						return;
					}
					
					// Filter for rated anime and get basic info
					const ratedEntries = data.data.filter((entry) => entry.list_status.score > 0);

					sendEvent('progress', {
						stage: 'processing',
						message: `Processing ${ratedEntries.length} rated anime...`,
						progress: 20,
						total: ratedEntries.length
					});

					// Extract malIds for AniList isekai detection
					const malIds = ratedEntries.map(entry => entry.node.id);

					// Fetch isekai detection from AniList using malIds
					const isekaiMap = await fetchIsekaiFromAniList(malIds, sendEvent);

					sendEvent('progress', {
						stage: 'finalizing',
						message: 'Finalizing anime list...',
						progress: 80
					});

					// Process each anime entry using AniList classification
					const animeList = [];

					for (const entry of ratedEntries) {
						try {
							const malId = entry.node.id;
							const classification = isekaiMap[malId];

							const animeEntry = {
								id: entry.node.id,
								malId: entry.node.id,
								title: entry.node.title,
								score: entry.list_status.score,
								status: entry.list_status.status || 'unknown',
								genres: [], // Will be populated from AniList if available
								themes: [], // Not using themes anymore, using AniList tags
								coverImage: entry.node.main_picture?.large || entry.node.main_picture?.medium || '',
								episodes: entry.node.num_episodes || 0,
								source: 'mal',
								format: entry.node.media_type || 'unknown',
								year: entry.node.start_date ? new Date(entry.node.start_date).getFullYear() : null,
								description: entry.node.synopsis || '',
								// Add classification info for filtering
								hasIsekai: classification?.hasIsekai || false,
								hasFantasy: classification?.hasFantasy || false,
								isekaiRank: classification?.isekaiRank || null
							};

							animeList.push(animeEntry);

						} catch (error) {
							console.warn(`Failed to process anime ${entry.node.id} (${entry.node.title}):`, error.message);

							// Add anime with basic info even if classification fails
							const basicAnimeEntry = {
								id: entry.node.id,
								malId: entry.node.id,
								title: entry.node.title,
								score: entry.list_status.score,
								status: entry.list_status.status || 'unknown',
								genres: [],
								themes: [],
								coverImage: entry.node.main_picture?.large || entry.node.main_picture?.medium || '',
								episodes: entry.node.num_episodes || 0,
								source: 'mal',
								format: entry.node.media_type || 'unknown',
								year: entry.node.start_date ? new Date(entry.node.start_date).getFullYear() : null,
								description: entry.node.synopsis || '',
								hasIsekai: false,
								hasFantasy: false,
								isekaiRank: null
							};

							animeList.push(basicAnimeEntry);
						}
					}
					
					const totalScore = animeList.reduce((sum, anime) => sum + anime.score, 0);
					const meanScore = animeList.length > 0 ? totalScore / animeList.length : 0;
					
					// Send completion event with final data
					sendEvent('complete', {
						username,
						platform: 'mal',
						animeList,
						meanScore,
						animeCount: animeList.length
					});
					
					controller.close();
					
				} catch (error) {
					console.error('Error fetching MAL data:', error);
					sendEvent('error', { error: 'Unknown error occurred while fetching MAL data' });
					controller.close();
				}
			};
			
			// Start processing
			processMALData();
		}
	});
	
	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Cache-Control'
		}
	});
}
