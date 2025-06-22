<script>
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { SpectrumAnalyzer } from '$lib/spectrum-analyzer';

	let { result } = $props();
	
	let quadrantDescription = $derived(SpectrumAnalyzer.getQuadrantDescription(result.quadrant));
	let positionDescription = $derived(SpectrumAnalyzer.get2DPositionDescription(result.position2D.x, result.position2D.y));
	let confidenceDescription = $derived(SpectrumAnalyzer.getConfidenceDescription(result.confidence));

	// Get color based on quadrant
	function getQuadrantColor(quadrant) {
		const colors = {
			pastafarianin: 'bg-red-500',
			kodjax: 'bg-yellow-500', // Swapped: Kodjax now gets yellow (was blue)
			mayxs: 'bg-green-500',
			blonzej: 'bg-blue-500' // Swapped: Blonzej now gets blue (was yellow)
		};
		return colors[quadrant] || 'bg-gray-500';
	}

	// Get confidence color
	function getConfidenceColor(confidence) {
		if (confidence < 40) return 'bg-red-500';
		if (confidence < 70) return 'bg-yellow-500';
		return 'bg-green-500';
	}

	// User names for display (with MrBall preference)
	const userDisplayNames = {
		pastafarianin: 'MrBall',
		kodjax: 'Kodjax',
		mayxs: 'MaYxS',
		blonzej: 'Blonzej'
	};

	// Check if user has smiley scoring system
	let userHasSmileySystem = $derived.by(() => {
		console.log('🧭 Compass - Checking user scoring system:', {
			platform: result.platform,
			scoreFormat: result.scoreFormat,
			username: result.username,
			sampleScores: result.commonAnime?.slice(0, 5).map(a => a.userScore)
		});

		const hasSmileyFormat = result.scoreFormat === 'POINT_3';
		const isAniList = result.platform === 'anilist';

		console.log('🧭 Compass - Smiley system check:', {
			hasSmileyFormat,
			isAniList,
			shouldShow: isAniList && hasSmileyFormat
		});

		// Only show warning if user actually has POINT_3 scoring system
		return isAniList && hasSmileyFormat;
	});
</script>

<Card class="bg-gray-900 border-gray-800">
	<CardHeader>
		<CardTitle class="text-white text-2xl">4-User Compass Analysis</CardTitle>
		<CardDescription class="text-gray-400">
			Based on {result.totalCommonAnime} common {result.mode} anime with all 4 base users
		</CardDescription>
	</CardHeader>
	<CardContent class="space-y-6">
		<!-- Scoring System Warning -->
		{#if userHasSmileySystem}
			<Alert class="border-yellow-600 bg-yellow-900/20">
				<AlertDescription class="text-yellow-200">
					⚠️ <strong>Scoring System Notice:</strong> You're using a 3-point smiley system (😞😐😊), which may result in artificially lower deviations with Blonzej who also uses the same 3-point scale. Your position may be biased toward the Blonzej quadrant due to this scoring system compatibility.
				</AlertDescription>
			</Alert>
		{/if}

		<!-- Compass Visualization -->
		<div class="space-y-4">
			<div class="text-center">
				<h3 class="text-lg font-semibold text-white mb-2">Your Position on the Compass</h3>
				<p class="text-gray-300 text-sm mb-4">{quadrantDescription}</p>
				<p class="text-gray-400 text-xs">{positionDescription}</p>
			</div>
			
			<!-- 2D Compass Grid -->
			<div class="relative mx-auto" style="width: 400px; height: 400px;">
				<!-- Background grid -->
				<div class="absolute inset-0 bg-gray-800 rounded-lg border border-gray-700">
					<!-- Quadrant backgrounds -->
					<div class="absolute top-0 left-0 w-1/2 h-1/2 bg-red-900/20 border-r border-b border-gray-600"></div>
					<div class="absolute top-0 right-0 w-1/2 h-1/2 bg-blue-900/20 border-l border-b border-gray-600"></div>
					<div class="absolute bottom-0 left-0 w-1/2 h-1/2 bg-green-900/20 border-r border-t border-gray-600"></div>
					<div class="absolute bottom-0 right-0 w-1/2 h-1/2 bg-yellow-900/20 border-l border-t border-gray-600"></div>
					
					<!-- Center lines -->
					<div class="absolute top-0 left-1/2 w-px h-full bg-gray-600"></div>
					<div class="absolute left-0 top-1/2 w-full h-px bg-gray-600"></div>
					
					<!-- User position indicator -->
					<div 
						class="absolute w-4 h-4 bg-white rounded-full border-2 border-gray-900 shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
						style="left: {result.position2D.x}%; top: {result.position2D.y}%"
					></div>
				</div>
				
				<!-- Corner labels -->
				<div class="absolute -top-6 -left-6 text-xs text-red-400 font-semibold">
					{userDisplayNames.pastafarianin}
				</div>
				<div class="absolute -top-6 -right-6 text-xs text-blue-400 font-semibold">
					{userDisplayNames.blonzej}
				</div>
				<div class="absolute -bottom-6 -left-6 text-xs text-green-400 font-semibold">
					{userDisplayNames.mayxs}
				</div>
				<div class="absolute -bottom-6 -right-6 text-xs text-yellow-400 font-semibold">
					{userDisplayNames.kodjax}
				</div>
			</div>
			
			<!-- Position Details -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
				<div class="text-center p-4 bg-gray-800 rounded-lg">
					<div class="text-lg font-bold text-white mb-1">
						({result.position2D.x.toFixed(1)}, {result.position2D.y.toFixed(1)})
					</div>
					<div class="text-sm text-gray-400">2D Position</div>
					<Badge class="{getQuadrantColor(result.quadrant)} text-white mt-2">
						{userDisplayNames[result.quadrant]} Quadrant
					</Badge>
				</div>
				
				<div class="text-center p-4 bg-gray-800 rounded-lg">
					<div class="text-2xl font-bold text-white mb-1">
						{result.confidence.toFixed(1)}%
					</div>
					<div class="text-sm text-gray-400">Confidence Level</div>
					<Badge class="{getConfidenceColor(result.confidence)} text-white mt-2">
						{confidenceDescription.split(' - ')[0]}
					</Badge>
				</div>
				
				<div class="text-center p-4 bg-gray-800 rounded-lg">
					<div class="text-2xl font-bold text-white mb-1">
						{result.totalCommonAnime}
					</div>
					<div class="text-sm text-gray-400">Common Anime</div>
					<Badge class="bg-purple-600 text-white mt-2">
						{result.mode.charAt(0).toUpperCase() + result.mode.slice(1)}
					</Badge>
				</div>
			</div>
		</div>

		<!-- Deviation Stats for all 4 users -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
			<div class="bg-gray-800 rounded-lg p-4">
				<h4 class="text-white font-semibold mb-2 flex items-center">
					<span class="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
					{userDisplayNames.pastafarianin}
				</h4>
				<div class="text-xl font-bold text-red-400">
					{result.averageDeviations.pastafarianin.toFixed(2)}
				</div>
				<div class="text-xs text-gray-400 mt-1">
					Avg deviation
				</div>
			</div>
			
			<div class="bg-gray-800 rounded-lg p-4">
				<h4 class="text-white font-semibold mb-2 flex items-center">
					<span class="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
					{userDisplayNames.kodjax}
				</h4>
				<div class="text-xl font-bold text-blue-400">
					{result.averageDeviations.kodjax.toFixed(2)}
				</div>
				<div class="text-xs text-gray-400 mt-1">
					Avg deviation
				</div>
			</div>
			
			<div class="bg-gray-800 rounded-lg p-4">
				<h4 class="text-white font-semibold mb-2 flex items-center">
					<span class="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
					{userDisplayNames.mayxs}
				</h4>
				<div class="text-xl font-bold text-green-400">
					{result.averageDeviations.mayxs.toFixed(2)}
				</div>
				<div class="text-xs text-gray-400 mt-1">
					Avg deviation
				</div>
			</div>
			
			<div class="bg-gray-800 rounded-lg p-4">
				<h4 class="text-white font-semibold mb-2 flex items-center">
					<span class="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
					{userDisplayNames.blonzej}
				</h4>
				<div class="text-xl font-bold text-yellow-400">
					{result.averageDeviations.blonzej.toFixed(2)}
				</div>
				<div class="text-xs text-gray-400 mt-1">
					Avg deviation
				</div>
			</div>
		</div>
	</CardContent>
</Card>
