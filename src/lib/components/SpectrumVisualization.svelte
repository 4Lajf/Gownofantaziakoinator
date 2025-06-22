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

<Card class="bg-gray-900 border-gray-800">
	<CardHeader class="">
		<CardTitle class="text-white text-2xl">Autism Spectrum Analysis</CardTitle>
		<CardDescription class="text-gray-400">
			Based on {result.totalCommonAnime} common {result.mode} anime with base users
		</CardDescription>
	</CardHeader>
	<CardContent class="space-y-6">
		<!-- Spectrum Visualization -->
		<div class="space-y-4">
			<div class="text-center">
				<h3 class="text-lg font-semibold text-white mb-2">Your Position on the Spectrum</h3>
				<p class="text-gray-300 text-sm mb-4">{spectrumDescription}</p>
			</div>
			
			<!-- Visual Spectrum Bar -->
			<div class="relative">
				<!-- Background bar -->
				<div class="w-full h-8 bg-gradient-to-r from-blue-600 via-purple-600 to-red-600 rounded-lg relative overflow-hidden">
					<!-- Position indicator -->
					<div 
						class="absolute top-0 h-full w-1 bg-white shadow-lg transition-all duration-500"
						style="left: {indicatorPosition}%"
					></div>
				</div>
				
				<!-- Labels -->
				<div class="flex justify-between mt-2 text-xs text-gray-400">
					<span>Kodjax-aligned</span>
					<span class="text-center">Balanced</span>
					<span class="text-right">MrBall-aligned</span>
				</div>
			</div>
			
			<!-- Position Details -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
				<div class="text-center p-4 bg-gray-800 rounded-lg">
					<div class="text-2xl font-bold text-white mb-1">
						{result.spectrumPosition.toFixed(1)}%
					</div>
					<div class="text-sm text-gray-400">Spectrum Position</div>
					<Badge class="{getPositionColor(result.spectrumPosition)} text-white mt-2">
						{result.spectrumPosition < 50 ? 'Kodjax Side' : 'MrBall Side'}
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

		<!-- Deviation Stats -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="bg-gray-800 rounded-lg p-4">
				<h4 class="text-white font-semibold mb-2 flex items-center">
					<span class="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
					Deviation from Kodjax
				</h4>
				<div class="text-2xl font-bold text-blue-400">
					{result.averageDeviationFromKodjax.toFixed(2)}
				</div>
				<div class="text-xs text-gray-400 mt-1">
					Average score difference
				</div>
			</div>
			
			<div class="bg-gray-800 rounded-lg p-4">
				<h4 class="text-white font-semibold mb-2 flex items-center">
					<span class="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
					Deviation from MrBall
				</h4>
				<div class="text-2xl font-bold text-red-400">
					{result.averageDeviationFromPastafarianin.toFixed(2)}
				</div>
				<div class="text-xs text-gray-400 mt-1">
					Average score difference
				</div>
			</div>
		</div>
	</CardContent>
</Card>
