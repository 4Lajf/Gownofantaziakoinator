<script>
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Progress } from '$lib/components/ui/progress';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';

	import { analyzeUserSpectrum, AnalysisError } from '$lib/spectrum-analyzer';
	import SpectrumVisualization from '$lib/components/SpectrumVisualization.svelte';
	import CompassVisualization from '$lib/components/CompassVisualization.svelte';
	import ResultsDisplay from '$lib/components/ResultsDisplay.svelte';

	// State variables
	let username = '';
	let selectedPlatform = 'anilist';
	let selectedMode = 'isekai';
	let selectedComparisonMode = '2-user';
	let isAnalyzing = false;
	let analysisProgress = null;
	let result = null;
	let error = null;

	// Handle analysis
	async function handleAnalyze() {
		if (!username.trim()) {
			error = 'Please enter a username';
			return;
		}

		isAnalyzing = true;
		error = null;
		result = null;
		analysisProgress = null;

		try {
			result = await analyzeUserSpectrum(username.trim(), selectedPlatform, selectedMode, selectedComparisonMode, progress => {
				analysisProgress = progress;
			});
		} catch (err) {
			if (err instanceof AnalysisError) {
				error = err.message;
			} else {
				error = 'An unexpected error occurred';
			}
		} finally {
			isAnalyzing = false;
			analysisProgress = null;
		}
	}

	// Handle mode change
	function handleModeChange(mode) {
		selectedMode = mode;
		// Clear previous results when mode changes
		result = null;
		error = null;
	}

	// Handle platform change
	function handlePlatformChange(platform) {
		selectedPlatform = platform;
		// Clear previous results when platform changes
		result = null;
		error = null;
	}

	// Handle comparison mode change
	function handleComparisonModeChange(comparisonMode) {
		selectedComparisonMode = comparisonMode;
		// Clear previous results when comparison mode changes
		result = null;
		error = null;
	}
</script>

<div class="min-h-screen bg-gray-950 text-white">
	<div class="container mx-auto px-4 py-8">
		<!-- Header -->
		<div class="mb-8 text-center">
			<h1 class="mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-4xl font-bold text-transparent">Gównofantaziakoinator</h1>
			<p class="mb-2 text-xl text-gray-300">Sprawdź w którym miejscu na spektrum autyzmu się znajdujesz</p>
		</div>

		<!-- Main Content -->
		<div class="mx-auto max-w-4xl">
			<!-- Input Section -->
			<Card class="mb-8 border-gray-800 bg-gray-900">
				<CardHeader class="">
					<CardTitle class="text-white">Analyze Your Anime Taste</CardTitle>
					<CardDescription class="text-gray-400">Enter your username and select your platform to discover your position on the autism spectrum</CardDescription>
				</CardHeader>
				<CardContent class="space-y-6">
					<!-- Comparison Mode Selection -->
					<div>
						<Label class="mb-3 block text-white">Comparison Mode</Label>
						<Tabs value={selectedComparisonMode} onValueChange={handleComparisonModeChange} class="w-full">
							<TabsList class="grid w-full grid-cols-2 bg-gray-800">
								<TabsTrigger value="2-user" class="data-[state=active]:bg-purple-600">2-User Spectrum</TabsTrigger>
								<TabsTrigger value="4-user" class="data-[state=active]:bg-purple-600">4-User Compass</TabsTrigger>
							</TabsList>
						</Tabs>
						<p class="mt-2 text-xs text-gray-400">
							{selectedComparisonMode === '2-user'
								? 'Compare with Kodjax and MrBall on a linear spectrum'
								: 'Compare with all 4 users (Pastafarianin, Kodjax, MaYxS, Blonzej) on a 2D compass'}
						</p>
					</div>

					<!-- Anime Mode Selection -->
					<div>
						<Label class="mb-3 block text-white">Anime Mode</Label>
						<Tabs value={selectedMode} onValueChange={handleModeChange} class="w-full">
							<TabsList class="grid w-full grid-cols-2 bg-gray-800">
								<TabsTrigger value="isekai" class="data-[state=active]:bg-purple-600">Isekai</TabsTrigger>
								<TabsTrigger value="fantasy" class="data-[state=active]:bg-purple-600">Fantasy</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>

					<!-- Platform and Username -->
					<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
						<div>
							<Label for="platform" class="text-white">Platform</Label>
							<select
								bind:value={selectedPlatform}
								on:change={e => handlePlatformChange(e.currentTarget.value)}
								class="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
							>
								<option value="anilist">AniList</option>
								<option value="mal">MyAnimeList</option>
							</select>
						</div>

						<div class="md:col-span-2">
							<Label for="username" class="text-white">Username</Label>
							<div class="flex gap-2">
								<Input
									type="text"
									id="username"
									bind:value={username}
									placeholder="Enter your username"
									disabled={isAnalyzing}
									class="border-gray-700 bg-gray-800 text-white placeholder-gray-400"
									on:keydown={e => e.key === 'Enter' && handleAnalyze()}
								/>
								<Button onclick={handleAnalyze} disabled={isAnalyzing || !username.trim()} class="bg-purple-600 hover:bg-purple-700">
									{isAnalyzing ? 'Analyzing...' : 'Analyze'}
								</Button>
							</div>
						</div>
					</div>

					<!-- Progress -->
					{#if analysisProgress}
						<div class="space-y-2">
							<div class="flex justify-between text-sm">
								<span class="text-gray-300">{analysisProgress.message}</span>
								<span class="text-gray-400">{analysisProgress.progress}%</span>
							</div>
							<Progress value={analysisProgress.progress} class="bg-gray-800" />
						</div>
					{/if}

					<!-- Error Display -->
					{#if error}
						<Alert class="border-red-800 bg-red-900/20">
							<AlertDescription class="text-red-300">
								{error}
							</AlertDescription>
						</Alert>
					{/if}
				</CardContent>
			</Card>

			<!-- Results Section -->
			{#if result}
				<div class="space-y-6">
					<!-- Visualization based on comparison mode -->
					{#if result.comparisonMode === '4-user'}
						<CompassVisualization {result} />
					{:else}
						<SpectrumVisualization {result} />
					{/if}

					<!-- Detailed Results -->
					<ResultsDisplay {result} />
				</div>
			{/if}
		</div>
	</div>
</div>
