// Fetch user anime list from MyAnimeList using server-side API
export async function fetchMALUserList(username, progressCallback) {
	try {
		if (progressCallback) {
			progressCallback({
				stage: 'fetching',
				message: 'Fetching anime list from MyAnimeList...',
				progress: 10
			});
		}

		const response = await fetch(`/api/mal/${username}`);

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();

		if (progressCallback) {
			progressCallback({
				stage: 'fetched',
				message: 'Anime list fetched successfully',
				progress: 30
			});
		}

		return data;
	} catch (error) {
		throw new Error(error.message || 'Failed to fetch MAL data');
	}
}

// Fetch user anime list from AniList using GraphQL API
export async function fetchAniListUserList(username) {
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
			.map((entry) => {
				// Check for isekai tag with >80% rank
				const hasIsekaiTag = entry.media.tags?.some(tag =>
					tag.name.toLowerCase() === 'isekai' && tag.rank >= 80
				);

				// Check for fantasy genre
				const hasFantasy = entry.media.genres?.includes('Fantasy');

				return {
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
					description: entry.media.description || '',
					// Add classification info directly from AniList data
					hasIsekai: hasIsekaiTag,
					hasFantasy: hasFantasy,
					isekaiRank: hasIsekaiTag ? entry.media.tags.find(t => t.name.toLowerCase() === 'isekai')?.rank : null
				};
			});

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
