<script>
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { SpectrumAnalyzer } from '$lib/spectrum-analyzer';

	let { result } = $props();

	let spectrumDescription = $derived(SpectrumAnalyzer.getSpectrumDescription(result.spectrumPosition));
	let confidenceDescription = $derived(SpectrumAnalyzer.getConfidenceDescription(result.confidence));

	// Calculate position for visual indicator
	let indicatorPosition = $derived(result.spectrumPosition);

	// Get color based on position
	function getPositionColor(position) {
		if (position < 25) return 'bg-blue-500';
		if (position < 50) return 'bg-cyan-500';
		if (position < 75) return 'bg-yellow-500';
		return 'bg-red-500';
	}

	// Get confidence color
	function getConfidenceColor(confidence) {
		if (confidence < 40) return 'bg-red-500';
		if (confidence < 70) return 'bg-yellow-500';
		return 'bg-green-500';
	}
</script>

<Card class="border-gray-800 bg-gray-900">
	<CardHeader class="">
		<CardTitle class="text-2xl text-white">Autism Spectrum Analysis</CardTitle>
		<CardDescription class="text-gray-400">
			Based on {result.totalCommonAnime} common {result.mode} anime with base users
		</CardDescription>
	</CardHeader>
	<CardContent class="space-y-6">
		<!-- Spectrum Visualization -->
		<div class="space-y-4">
			<div class="text-center">
				<h3 class="mb-2 text-lg font-semibold text-white">Your Position on the Spectrum</h3>
				<p class="mb-4 text-sm text-gray-300">{spectrumDescription}</p>
			</div>

			<!-- Visual Spectrum Bar -->
			<div class="relative">
				<!-- Background bar -->
				<div class="relative h-8 w-full overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 via-purple-600 to-red-600">
					<!-- Position indicator -->
					<div class="absolute top-0 h-full w-1 bg-white shadow-lg transition-all duration-500" style="left: {indicatorPosition}%"></div>
				</div>

				<!-- Labels -->
				<div class="mt-2 flex justify-between text-xs text-gray-400">
					<span>Kodjax-aligned</span>
					<span class="text-center">Balanced</span>
					<span class="text-right">MrBall-aligned</span>
				</div>
			</div>

			<!-- Position Details -->
			<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
				<div class="rounded-lg bg-gray-800 p-4 text-center">
					<div class="mb-1 text-2xl font-bold text-white">
						{result.spectrumPosition.toFixed(1)}%
					</div>
					<div class="text-sm text-gray-400">Spectrum Position</div>
					<Badge class="{getPositionColor(result.spectrumPosition)} mt-2 text-white">
						{result.spectrumPosition < 50 ? 'Kodjax Side' : 'MrBall Side'}
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

		<!-- Deviation Stats -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div class="rounded-lg bg-gray-800 p-4">
				<h4 class="mb-2 flex items-center font-semibold text-white">
					<span class="mr-2 h-3 w-3 rounded-full bg-blue-500"></span>
					Deviation from Kodjax
				</h4>
				<div class="text-2xl font-bold text-blue-400">
					{result.averageDeviationFromKodjax.toFixed(2)}
				</div>
				<div class="mt-1 text-xs text-gray-400">Average score difference</div>
			</div>

			<div class="rounded-lg bg-gray-800 p-4">
				<h4 class="mb-2 flex items-center font-semibold text-white">
					<span class="mr-2 h-3 w-3 rounded-full bg-red-500"></span>
					Deviation from MrBall
				</h4>
				<div class="text-2xl font-bold text-red-400">
					{result.averageDeviationFromPastafarianin.toFixed(2)}
				</div>
				<div class="mt-1 text-xs text-gray-400">Average score difference</div>
			</div>
		</div>
	</CardContent>
</Card>
