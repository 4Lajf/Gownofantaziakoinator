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

<Card class="border-gray-800 bg-gray-900">
	<CardHeader>
		<CardTitle class="text-2xl text-white">4-User Compass Analysis</CardTitle>
		<CardDescription class="text-gray-400">
			Based on {result.totalCommonAnime} common {result.mode} anime with all 4 base users
		</CardDescription>
	</CardHeader>
	<CardContent class="space-y-6">
		<!-- Scoring System Warning -->
		{#if userHasSmileySystem}
			<Alert class="border-yellow-600 bg-yellow-900/20">
				<AlertDescription class="text-yellow-200">
					⚠️ <strong>Scoring System Notice:</strong> You're using a 3-point smiley system (😞😐😊), which may result in artificially lower deviations with Blonzej who
					also uses the same 3-point scale. Your position may be biased toward the Blonzej quadrant due to this scoring system compatibility.
				</AlertDescription>
			</Alert>
		{/if}

		<!-- Compass Visualization -->
		<div class="space-y-4">
			<div class="text-center">
				<h3 class="mb-2 text-lg font-semibold text-white">Your Position on the Compass</h3>
				<p class="mb-4 text-sm text-gray-300">{quadrantDescription}</p>
				<p class="text-xs text-gray-400">{positionDescription}</p>
			</div>

			<!-- 2D Compass Grid -->
			<div class="relative mx-auto" style="width: 400px; height: 400px;">
				<!-- Background grid -->
				<div class="absolute inset-0 rounded-lg border border-gray-700 bg-gray-800">
					<!-- Quadrant backgrounds -->
					<div class="absolute top-0 left-0 h-1/2 w-1/2 border-r border-b border-gray-600 bg-red-900/20"></div>
					<div class="absolute top-0 right-0 h-1/2 w-1/2 border-b border-l border-gray-600 bg-blue-900/20"></div>
					<div class="absolute bottom-0 left-0 h-1/2 w-1/2 border-t border-r border-gray-600 bg-green-900/20"></div>
					<div class="absolute right-0 bottom-0 h-1/2 w-1/2 border-t border-l border-gray-600 bg-yellow-900/20"></div>

					<!-- Center lines -->
					<div class="absolute top-0 left-1/2 h-full w-px bg-gray-600"></div>
					<div class="absolute top-1/2 left-0 h-px w-full bg-gray-600"></div>

					<!-- User position indicator -->
					<div
						class="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 transform rounded-full border-2 border-gray-900 bg-white shadow-lg transition-all duration-500"
						style="left: {result.position2D.x}%; top: {result.position2D.y}%"
					></div>
				</div>

				<!-- Corner labels -->
				<div class="absolute -top-6 -left-6 text-xs font-semibold text-red-400">
					{userDisplayNames.pastafarianin}
				</div>
				<div class="absolute -top-6 -right-6 text-xs font-semibold text-blue-400">
					{userDisplayNames.blonzej}
				</div>
				<div class="absolute -bottom-6 -left-6 text-xs font-semibold text-green-400">
					{userDisplayNames.mayxs}
				</div>
				<div class="absolute -right-6 -bottom-6 text-xs font-semibold text-yellow-400">
					{userDisplayNames.kodjax}
				</div>
			</div>

			<!-- Position Details -->
			<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
				<div class="rounded-lg bg-gray-800 p-4 text-center">
					<div class="mb-1 text-lg font-bold text-white">
						({result.position2D.x.toFixed(1)}, {result.position2D.y.toFixed(1)})
					</div>
					<div class="text-sm text-gray-400">2D Position</div>
					<Badge class="{getQuadrantColor(result.quadrant)} mt-2 text-white">
						{userDisplayNames[result.quadrant]} Quadrant
					</Badge>
				</div>

				<div class="rounded-lg bg-gray-800 p-4 text-center">
					<div class="mb-1 text-2xl font-bold text-white">
						{result.confidence.toFixed(1)}%
					</div>
					<div class="text-sm text-gray-400">Confidence Level</div>
					<Badge class="{getConfidenceColor(result.confidence)} mt-2 text-white">
						{confidenceDescription.split(' - ')[0]}
					</Badge>
				</div>

				<div class="rounded-lg bg-gray-800 p-4 text-center">
					<div class="mb-1 text-2xl font-bold text-white">
						{result.totalCommonAnime}
					</div>
					<div class="text-sm text-gray-400">Common Anime</div>
					<Badge class="mt-2 bg-purple-600 text-white">
						{result.mode.charAt(0).toUpperCase() + result.mode.slice(1)}
					</Badge>
				</div>
			</div>
		</div>

		<!-- Deviation Stats for all 4 users -->
		<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
			<div class="rounded-lg bg-gray-800 p-4">
				<h4 class="mb-2 flex items-center font-semibold text-white">
					<span class="mr-2 h-3 w-3 rounded-full bg-red-500"></span>
					{userDisplayNames.pastafarianin}
				</h4>
				<div class="text-xl font-bold text-red-400">
					{result.averageDeviations.pastafarianin.toFixed(2)}
				</div>
				<div class="mt-1 text-xs text-gray-400">Avg deviation</div>
			</div>

			<div class="rounded-lg bg-gray-800 p-4">
				<h4 class="mb-2 flex items-center font-semibold text-white">
					<span class="mr-2 h-3 w-3 rounded-full bg-blue-500"></span>
					{userDisplayNames.kodjax}
				</h4>
				<div class="text-xl font-bold text-blue-400">
					{result.averageDeviations.kodjax.toFixed(2)}
				</div>
				<div class="mt-1 text-xs text-gray-400">Avg deviation</div>
			</div>

			<div class="rounded-lg bg-gray-800 p-4">
				<h4 class="mb-2 flex items-center font-semibold text-white">
					<span class="mr-2 h-3 w-3 rounded-full bg-green-500"></span>
					{userDisplayNames.mayxs}
				</h4>
				<div class="text-xl font-bold text-green-400">
					{result.averageDeviations.mayxs.toFixed(2)}
				</div>
				<div class="mt-1 text-xs text-gray-400">Avg deviation</div>
			</div>

			<div class="rounded-lg bg-gray-800 p-4">
				<h4 class="mb-2 flex items-center font-semibold text-white">
					<span class="mr-2 h-3 w-3 rounded-full bg-yellow-500"></span>
					{userDisplayNames.blonzej}
				</h4>
				<div class="text-xl font-bold text-yellow-400">
					{result.averageDeviations.blonzej.toFixed(2)}
				</div>
				<div class="mt-1 text-xs text-gray-400">Avg deviation</div>
			</div>
		</div>
	</CardContent>
</Card>
