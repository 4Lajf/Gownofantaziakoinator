// Rate limiting utilities for AniList
const rateLimiter = {
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

// Fetch user anime list from MyAnimeList using server-side API with progress updates
export async function fetchMALUserList(username, progressCallback) {
	return new Promise((resolve, reject) => {
		const eventSource = new EventSource(`/api/mal/${username}/stream`);

		eventSource.onmessage = function(event) {
			// Handle generic messages if needed
		};

		eventSource.addEventListener('progress', function(event) {
			if (progressCallback) {
				const progressData = JSON.parse(event.data);
				progressCallback({
					stage: progressData.stage,
					message: progressData.message,
					progress: progressData.progress,
					current: progressData.current,
					total: progressData.total
				});
			}
		});

		eventSource.addEventListener('complete', function(event) {
			const data = JSON.parse(event.data);
			eventSource.close();
			resolve(data);
		});

		eventSource.addEventListener('error', function(event) {
			const errorData = JSON.parse(event.data);
			eventSource.close();
			reject(new Error(errorData.error));
		});

		eventSource.onerror = function(event) {
			eventSource.close();
			reject(new Error('Connection error while fetching MAL data'));
		};
	});
}

// Fetch user anime list from AniList using GraphQL API
export async function fetchAniListUserList(username) {
	await waitForRateLimit('anilist');
	
	const query = `
		query ($username: String) {
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
			MediaListCollection(userName: $username, type: ANIME) {
				lists {
					entries {
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
							genres
							tags {
								name
								rank
							}
							coverImage {
								large
								medium
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
		}
	`;
	
	try {
		const response = await fetch('https://graphql.anilist.co', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query,
				variables: { username }
			})
		});
		
		if (!response.ok) {
			throw new Error(`Failed to fetch AniList data: ${response.status} ${response.statusText}`);
		}
		
		const data = await response.json();
		
		if (data.errors) {
			const errorMessage = data.errors[0].message;
			if (errorMessage.includes('User not found') || errorMessage.includes('Not Found')) {
				throw new Error(`User "${username}" not found on AniList. Please check the username spelling and make sure the profile exists.`);
			}
			if (errorMessage.includes('Private') || errorMessage.includes('private')) {
				throw new Error(`User "${username}" has a private profile on AniList. Only public profiles can be analyzed.`);
			}
			if (errorMessage.includes('Forbidden') || errorMessage.includes('forbidden')) {
				throw new Error(`Access to user "${username}" is restricted on AniList. The profile may be private or have restricted access.`);
			}
			throw new Error(`AniList API error: ${errorMessage}. Please try again or check if the username is correct.`);
		}
		
		if (!data.data?.MediaListCollection?.lists) {
			throw new Error('Invalid response format from AniList API');
		}
		
		const allEntries = data.data.MediaListCollection.lists.flatMap((list) => list.entries);

		const animeList = allEntries
			.filter((entry) => entry.score > 0) // Only include rated anime
			.map((entry) => ({
				id: entry.media.id,
				malId: entry.media.idMal,
				title: entry.media.title.romaji || entry.media.title.english || entry.media.title.native,
				score: entry.score,
				status: entry.status?.toLowerCase() || 'unknown',
				genres: entry.media.genres || [],
				themes: entry.media.tags?.filter((tag) => tag.rank >= 80).map((tag) => tag.name) || [],
				coverImage: entry.media.coverImage?.large || entry.media.coverImage?.medium || '',
				episodes: entry.media.episodes || 0,
				source: 'anilist',
				format: entry.media.format || 'unknown',
				year: entry.media.startDate?.year || null,
				description: entry.media.description || ''
			}));
		
		const userStats = data.data.User?.statistics?.anime;
		const meanScore = userStats?.meanScore || 0;
		const animeCount = userStats?.count || animeList.length;
		const scoreFormat = data.data.User?.mediaListOptions?.scoreFormat || 'POINT_10_DECIMAL';

		return {
			username,
			platform: 'anilist',
			animeList,
			meanScore,
			animeCount,
			scoreFormat
		};
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		}
		throw new Error('Unknown error occurred while fetching AniList data');
	}
}

// Fetch user anime list from the specified platform
export async function fetchUserAnimeList(username, platform, progressCallback) {
	if (platform === 'mal') {
		return fetchMALUserList(username, progressCallback);
	} else {
		return fetchAniListUserList(username);
	}
}

// Validate username format for the specified platform
export function validateUsername(username, platform) {
	if (!username || username.trim().length === 0) {
		return { valid: false, error: 'Username cannot be empty' };
	}

	const trimmedUsername = username.trim();

	// Allow up to 200 characters for all platforms and let the API determine if the user exists
	if (trimmedUsername.length > 200) {
		return { valid: false, error: 'Username is too long (maximum 200 characters)' };
	}

	// Basic check for obviously invalid characters (control characters, etc.)
	if (/[\x00-\x1F\x7F]/.test(trimmedUsername)) {
		return { valid: false, error: 'Username contains invalid characters' };
	}

	return { valid: true };
}
