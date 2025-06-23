import { json } from '@sveltejs/kit';

// MAL API Client ID
const MAL_CLIENT_ID = '7f24090fc4335cf45b5c338e512395b3';

// Rate limiting utilities
const rateLimiter = {
	mal: { lastRequest: 0, minInterval: 1000 } // 1 second between MAL requests
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



export async function GET({ params }) {
	const { username } = params;
	
	try {
		await waitForRateLimit('mal');
		
		// First, get the user's anime list from official MAL API
		const response = await fetch(`https://api.myanimelist.net/v2/users/${username}/animelist?fields=list_status,node(id,title,main_picture,num_episodes,media_type,start_date,synopsis)&limit=1000`, {
			headers: {
				'X-MAL-CLIENT-ID': MAL_CLIENT_ID
			}
		});
		
		if (!response.ok) {
			if (response.status === 404) {
				return json({ error: `User "${username}" not found on MyAnimeList. Please check the username spelling and make sure the profile exists.` }, { status: 404 });
			}
			if (response.status === 403) {
				return json({ error: `User "${username}" has a private anime list on MyAnimeList. Only public anime lists can be analyzed.` }, { status: 403 });
			}
			if (response.status === 401) {
				return json({ error: `Access denied for user "${username}" on MyAnimeList. The profile may have restricted access.` }, { status: 401 });
			}
			return json({ error: `Failed to fetch data for user "${username}" from MyAnimeList: ${response.status} ${response.statusText}. Please try again or check if the username is correct.` }, { status: response.status });
		}
		
		const data = await response.json();
		
		if (!data.data || !Array.isArray(data.data)) {
			return json({ error: 'Invalid response format from MyAnimeList API' }, { status: 500 });
		}
		
		// Filter for rated anime and get basic info
		const ratedEntries = data.data.filter((entry) => entry.list_status.score > 0);

		// Process each anime entry with basic MAL data only
		const animeList = ratedEntries.map(entry => ({
			id: entry.node.id,
			malId: entry.node.id,
			title: entry.node.title,
			score: entry.list_status.score,
			status: entry.list_status.status || 'unknown',
			genres: [], // Will be populated from AniList on client side
			themes: [], // Will be populated from AniList on client side
			coverImage: entry.node.main_picture?.large || entry.node.main_picture?.medium || '',
			episodes: entry.node.num_episodes || 0,
			source: 'mal',
			format: entry.node.media_type || 'unknown',
			year: entry.node.start_date ? new Date(entry.node.start_date).getFullYear() : null,
			description: entry.node.synopsis || '',
			// Classification will be added on client side
			hasIsekai: null,
			hasFantasy: null,
			isekaiRank: null
		}));
		
		const totalScore = animeList.reduce((sum, anime) => sum + anime.score, 0);
		const meanScore = animeList.length > 0 ? totalScore / animeList.length : 0;
		
		return json({
			username,
			platform: 'mal',
			animeList,
			meanScore,
			animeCount: animeList.length
		});
		
	} catch (error) {
		console.error('Error fetching MAL data:', error);
		return json({ error: 'Unknown error occurred while fetching MAL data' }, { status: 500 });
	}
}
