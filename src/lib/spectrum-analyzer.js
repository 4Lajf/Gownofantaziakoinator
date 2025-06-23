import { fetchUserAnimeList, validateUsername } from './api-utils.js';
import { generateSpectrumResult } from './data-utils.js';
import { fetchAnimeClassification, applyClassificationToAnimeList } from './anilist-client.js';

// Main spectrum analyzer class
export class SpectrumAnalyzer {
	constructor(progressCallback) {
		this.progressCallback = progressCallback;
	}

	updateProgress(stage, message, progress) {
		if (this.progressCallback) {
			this.progressCallback({ stage, message, progress });
		}
	}

	// Analyze a user's position on the autism spectrum
	async analyzeUser(username, platform, mode, comparisonMode = '2-user') {
		try {
			// Stage 1: Validation
			this.updateProgress('validating', 'Validating username...', 10);

			const validation = validateUsername(username, platform);
			if (!validation.valid) {
				throw new AnalysisError('VALIDATION_ERROR', validation.error || 'Invalid username');
			}

			// Stage 2: Fetching user data
			this.updateProgress('fetching', `Fetching anime list from ${platform.toUpperCase()}...`, 20);

			let userAnimeList;
			try {
				// Create a progress callback that updates the main progress
				const fetchProgressCallback = fetchProgress => {
					if (fetchProgress.stage === 'fetching') {
						this.updateProgress('fetching', fetchProgress.message, 20);
					} else if (fetchProgress.stage === 'fetched') {
						this.updateProgress('fetching', fetchProgress.message, 30);
					}
				};

				userAnimeList = await fetchUserAnimeList(username, platform, fetchProgressCallback);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error';
				throw new AnalysisError('FETCH_ERROR', errorMessage);
			}

			// Check if user has any rated anime
			if (userAnimeList.animeList.length === 0) {
				throw new AnalysisError('ANALYSIS_ERROR', 'No rated anime found for this user');
			}

			// Stage 3: Classify anime (only for MAL users, AniList already has classification)
			if (platform === 'mal') {
				this.updateProgress('classifying', 'Classifying anime from AniList...', 40);

				try {
					// Extract malIds for classification
					const malIds = userAnimeList.animeList.filter(anime => anime.malId).map(anime => anime.malId);

					// Create a progress callback for classification
					const classificationProgressCallback = classificationProgress => {
						// Map classification progress to analysis progress (40-70% range)
						const mappedProgress = 40 + Math.floor((classificationProgress.progress / 100) * 30);
						this.updateProgress('classifying', classificationProgress.message, mappedProgress);
					};

					// Fetch classification from AniList
					const classificationMap = await fetchAnimeClassification(malIds, classificationProgressCallback);

					// Apply classification to anime list
					userAnimeList.animeList = applyClassificationToAnimeList(userAnimeList.animeList, classificationMap);
				} catch (error) {
					console.warn('Failed to classify anime, proceeding with basic data:', error.message);
					// Continue with unclassified data
				}
			} else {
				// AniList users already have classification data, skip to analysis
				this.updateProgress('classifying', 'Using AniList classification data...', 70);
			}

			// Stage 4: Analyzing spectrum position
			this.updateProgress('analyzing', 'Calculating spectrum position...', 80);

			let result;
			try {
				result = generateSpectrumResult(userAnimeList, mode, comparisonMode);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown analysis error';
				throw new AnalysisError('ANALYSIS_ERROR', errorMessage);
			}

			// Check if we have enough data for a meaningful analysis
			if (result.totalCommonAnime === 0) {
				throw new AnalysisError('ANALYSIS_ERROR', `No common ${mode} anime found with base users. Try the other mode or a different user.`);
			}

			// Stage 5: Complete
			this.updateProgress('complete', 'Analysis complete!', 100);

			return result;
		} catch (error) {
			if (error instanceof AnalysisError) {
				this.updateProgress('error', error.message, 0);
				throw error;
			}

			const unknownError = new AnalysisError('UNKNOWN_ERROR', 'An unexpected error occurred during analysis');
			this.updateProgress('error', unknownError.message, 0);
			throw unknownError;
		}
	}

	// Get spectrum position description
	static getSpectrumDescription(position) {
		if (position < 10) {
			return 'Extremely Kodjax-aligned - You have very similar taste to Kodjax';
		} else if (position < 25) {
			return "Strongly Kodjax-aligned - Your preferences lean heavily toward Kodjax's taste";
		} else if (position < 40) {
			return "Moderately Kodjax-aligned - You share some similarities with Kodjax's preferences";
		} else if (position < 60) {
			return 'Balanced - Your taste falls somewhere between both base users';
		} else if (position < 75) {
			return "Moderately MrBall-aligned - You share some similarities with MrBall's preferences";
		} else if (position < 90) {
			return "Strongly MrBall-aligned - Your preferences lean heavily toward MrBall's taste";
		} else {
			return 'Extremely MrBall-aligned - You have very similar taste to MrBall';
		}
	}

	// Get confidence level description
	static getConfidenceDescription(confidence) {
		if (confidence < 20) {
			return 'Very Low - Based on very few common anime';
		} else if (confidence < 40) {
			return 'Low - Based on limited common anime';
		} else if (confidence < 60) {
			return 'Moderate - Based on a reasonable number of common anime';
		} else if (confidence < 80) {
			return 'High - Based on many common anime';
		} else {
			return 'Very High - Based on extensive common anime data';
		}
	}

	// Get quadrant description for 4-user compass
	static getQuadrantDescription(quadrant) {
		const descriptions = {
			pastafarianin: "MrBall Quadrant - You align most closely with MrBall's taste",
			kodjax: "Kodjax Quadrant - You align most closely with Kodjax's taste",
			mayxs: "MaYxS Quadrant - You align most closely with MaYxS's taste",
			blonzej: "Blonzej Quadrant - You align most closely with Blonzej's taste"
		};
		return descriptions[quadrant] || 'Unknown quadrant';
	}

	// Get 2D position description
	static get2DPositionDescription(x, y) {
		const horizontal = x < 25 ? 'Far Left' : x < 50 ? 'Left' : x < 75 ? 'Right' : 'Far Right';
		const vertical = y < 25 ? 'Top' : y < 50 ? 'Upper' : y < 75 ? 'Lower' : 'Bottom';
		return `${vertical} ${horizontal}`;
	}
}

// Custom error class for analysis errors
export class AnalysisError extends Error {
	constructor(code, message, details) {
		super(message);
		this.name = 'AnalysisError';
		this.code = code;
		this.details = details;
	}
}

// Convenience function for quick analysis
export async function analyzeUserSpectrum(username, platform, mode, comparisonMode = '2-user', progressCallback) {
	const analyzer = new SpectrumAnalyzer(progressCallback);
	return analyzer.analyzeUser(username, platform, mode, comparisonMode);
}
