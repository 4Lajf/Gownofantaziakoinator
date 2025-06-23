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

// Fetch user anime list from the specified platform
export async function fetchUserAnimeList(username, platform, progressCallback) {
	if (platform === 'mal') {
		return fetchMALUserList(username, progressCallback);
	} else {
		throw new Error('AniList platform is not supported in this version. Please use MyAnimeList.');
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
