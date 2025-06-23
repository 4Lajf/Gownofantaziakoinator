/**
 * Centralized user color system for consistent theming across the application
 */

// User color definitions
export const userColors = {
	pastafarianin: { 
		bg: 'bg-red-500', 
		text: 'text-red-400', 
		dot: 'bg-red-500' 
	},
	kodjax: { 
		bg: 'bg-yellow-500', 
		text: 'text-yellow-400', 
		dot: 'bg-yellow-500' 
	},
	mayxs: { 
		bg: 'bg-green-500', 
		text: 'text-green-400', 
		dot: 'bg-green-500' 
	},
	blonzej: { 
		bg: 'bg-blue-500', 
		text: 'text-blue-400', 
		dot: 'bg-blue-500' 
	}
};

// Helper functions for getting user colors
export function getUserBackgroundColor(user) {
	return userColors[user]?.bg || 'bg-gray-500';
}

export function getUserTextColor(user) {
	return userColors[user]?.text || 'text-gray-400';
}

export function getUserDotColor(user) {
	return userColors[user]?.dot || 'bg-gray-500';
}

// User display names mapping
export const userDisplayNames = {
	pastafarianin: 'MrBall',
	kodjax: 'Kodjax',
	mayxs: 'MaYxS',
	blonzej: 'Blonzej'
};
