<script>
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';

	let { result } = $props();

	// Check if we're in 4-user mode
	let is4UserMode = $derived(result.comparisonMode === '4-user');

	// Check if user has smiley scoring system
	let userHasSmileySystem = $derived.by(() => {
		console.log('🔍 Checking user scoring system:', {
			platform: result.platform,
			scoreFormat: result.scoreFormat,
			username: result.username,
			comparisonMode: result.comparisonMode,
			sampleScores: result.commonAnime?.slice(0, 5).map(a => a.userScore)
		});

		const hasSmileyFormat = result.scoreFormat === 'POINT_3';
		const isAniList = result.platform === 'anilist';
		const is4User = result.comparisonMode === '4-user';

		console.log('🔍 Smiley system check:', {
			hasSmileyFormat,
			isAniList,
			is4User,
			shouldShow: is4User && isAniList && hasSmileyFormat
		});

		// Only show warning if user actually has POINT_3 scoring system
		return is4User && isAniList && hasSmileyFormat;
	});

	// Sort common anime by user score (highest first)
	let sortedCommonAnime = $derived([...result.commonAnime].sort((a, b) => b.userScore - a.userScore));

	// Get top and bottom anime for interesting comparisons
	let topAnime = $derived(sortedCommonAnime.slice(0, 5));
	let bottomAnime = $derived(sortedCommonAnime.slice(-5).reverse());

	// Calculate interesting stats - for "Biggest Fight" sections, only include anime that the specific base user has rated
	let biggestDisagreementWithKodjax = $derived(
		result.commonAnime
			.filter(a => a.kodjaxDeviation !== undefined && a.kodjaxScore !== undefined && a.kodjaxScore !== null && a.kodjaxScore > 0)
			.sort((a, b) => (b.kodjaxDeviation || 0) - (a.kodjaxDeviation || 0))[0]
	);

	let biggestDisagreementWithMrBall = $derived(
		result.commonAnime
			.filter(a => a.pastafarianinDeviation !== undefined && a.pastafarianinScore !== undefined && a.pastafarianinScore !== null && a.pastafarianinScore > 0)
			.sort((a, b) => (b.pastafarianinDeviation || 0) - (a.pastafarianinDeviation || 0))[0]
	);

	// Additional calculations for 4-user mode
	let biggestDisagreementWithMaYxS = $derived(
		is4UserMode
			? result.commonAnime
					.filter(a => a.mayxsDeviation !== undefined && a.mayxsScore !== undefined && a.mayxsScore !== null && a.mayxsScore > 0)
					.sort((a, b) => (b.mayxsDeviation || 0) - (a.mayxsDeviation || 0))[0]
			: null
	);

	let biggestDisagreementWithBlonzej = $derived(
		is4UserMode
			? result.commonAnime
					.filter(a => a.blonzejDeviation !== undefined && a.blonzejScore !== undefined && a.blonzejScore !== null && a.blonzejScore > 0)
					.sort((a, b) => (b.blonzejDeviation || 0) - (a.blonzejDeviation || 0))[0]
			: null
	);

	// For "Most Agreed" section, require users to have rated it based on mode
	let mostAgreedAnime = $derived(
		is4UserMode
			? // In 4-user mode, require at least 2 users to have rated it
				result.commonAnime
					.filter(a => {
						const validScores = [a.kodjaxScore, a.pastafarianinScore, a.mayxsScore, a.blonzejScore].filter(
							score => score !== undefined && score !== null && score > 0
						);
						return validScores.length >= 2;
					})
					.sort((a, b) => {
						const aTotal = (a.kodjaxDeviation || 0) + (a.pastafarianinDeviation || 0) + (a.mayxsDeviation || 0) + (a.blonzejDeviation || 0);
						const bTotal = (b.kodjaxDeviation || 0) + (b.pastafarianinDeviation || 0) + (b.mayxsDeviation || 0) + (b.blonzejDeviation || 0);
						return aTotal - bTotal;
					})[0]
			: // Original 2-user logic
				result.commonAnime
					.filter(
						a =>
							a.kodjaxDeviation !== undefined &&
							a.pastafarianinDeviation !== undefined &&
							a.kodjaxScore !== undefined &&
							a.pastafarianinScore !== undefined &&
							a.kodjaxScore !== null &&
							a.pastafarianinScore !== null &&
							a.kodjaxScore > 0 &&
							a.pastafarianinScore > 0
					)
					.sort((a, b) => {
						const aTotal = (a.kodjaxDeviation || 0) + (a.pastafarianinDeviation || 0);
						const bTotal = (b.kodjaxDeviation || 0) + (b.pastafarianinDeviation || 0);
						return aTotal - bTotal;
					})[0]
	);

	// For top/bottom anime lists, keep the original behavior (show anime even if only one base user watched it)
	// But we can still use the original topAnime and bottomAnime

	function getScoreColor(score) {
		if (score >= 8) return 'text-green-400';
		if (score >= 6) return 'text-yellow-400';
		if (score >= 4) return 'text-orange-400';
		return 'text-red-400';
	}

	function getDeviationColor(deviation) {
		if (deviation <= 1) return 'text-green-400';
		if (deviation <= 2) return 'text-yellow-400';
		if (deviation <= 3) return 'text-orange-400';
		return 'text-red-400';
	}

	// Helper function to format scores based on scoring system
	function formatUserScore(translatedScore, originalScore, scoringSystem, username) {
		if (!translatedScore) return translatedScore;
		if (!originalScore || !scoringSystem) return translatedScore;

		switch (scoringSystem) {
			case 'POINT_3': // Smiley system
				const smiley = originalScore === 1 ? '😞' : originalScore === 2 ? '😐' : originalScore === 3 ? '😊' : '';
				return smiley ? `${translatedScore} ${smiley}` : translatedScore;

			case 'POINT_5': // 5-star system
				const stars =
					originalScore === 10
						? '⭐'
						: originalScore === 30
							? '⭐⭐'
							: originalScore === 50
								? '⭐⭐⭐'
								: originalScore === 70
									? '⭐⭐⭐⭐'
									: originalScore === 90
										? '⭐⭐⭐⭐⭐'
										: '';
				return stars ? `${translatedScore} ${stars}` : translatedScore;

			case 'POINT_100': // 100-point system
				return `${translatedScore} (${originalScore}/100)`;

			default:
				return translatedScore;
		}
	}

	// Legacy function for Blonzej compatibility
	function formatBlonzejScore(translatedScore, originalScore) {
		return formatUserScore(translatedScore, originalScore, 'POINT_3', 'blonzej');
	}
</script>

<div class="space-y-6">
	<!-- Interesting Comparisons -->
	<Card class="border-gray-800 bg-gray-900">
		<CardHeader class="">
			<CardTitle class="text-white">Notable Comparisons</CardTitle>
			<CardDescription class="text-gray-400">Your most interesting agreements and disagreements</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			{#if mostAgreedAnime}
				<div class="rounded-lg bg-gray-800 p-4">
					<h4 class="mb-2 font-semibold text-green-400">🤝 Most Agreed Upon</h4>
					<div class="flex items-center justify-between">
						<div>
							<div class="font-medium text-white">{mostAgreedAnime.anime.title}</div>
							<div class="text-sm text-gray-400">
								You: <span class={getScoreColor(mostAgreedAnime.userScore)}>{mostAgreedAnime.userScore}</span>
								{#if mostAgreedAnime.kodjaxScore}
									| Kodjax: <span class={getScoreColor(mostAgreedAnime.kodjaxScore)}>{mostAgreedAnime.kodjaxScore}</span>
								{/if}
								{#if mostAgreedAnime.pastafarianinScore}
									| MrBall: <span class={getScoreColor(mostAgreedAnime.pastafarianinScore)}>{mostAgreedAnime.pastafarianinScore}</span>
								{/if}
								{#if is4UserMode && mostAgreedAnime.mayxsScore}
									| MaYxS: <span class={getScoreColor(mostAgreedAnime.mayxsScore)}>{mostAgreedAnime.mayxsScore}</span>
								{/if}
								{#if is4UserMode && mostAgreedAnime.blonzejScore}
									| Blonzej: <span class={getScoreColor(mostAgreedAnime.blonzejScore)}
										>{formatBlonzejScore(mostAgreedAnime.blonzejScore, mostAgreedAnime.blonzejOriginalScore)}</span
									>
								{/if}
							</div>
						</div>
						<img src={mostAgreedAnime.anime.coverImage} alt={mostAgreedAnime.anime.title} class="h-16 w-12 rounded object-cover" loading="lazy" />
					</div>
				</div>
			{/if}

			{#if biggestDisagreementWithKodjax}
				<div class="rounded-lg bg-gray-800 p-4">
					<h4 class="mb-2 font-semibold text-blue-400">🥊 Biggest Fight with Kodjax</h4>
					<div class="flex items-center justify-between">
						<div>
							<div class="font-medium text-white">{biggestDisagreementWithKodjax.anime.title}</div>
							<div class="text-sm text-gray-400">
								You: <span class={getScoreColor(biggestDisagreementWithKodjax.userScore)}>{biggestDisagreementWithKodjax.userScore}</span>
								| Kodjax: <span class={getScoreColor(biggestDisagreementWithKodjax.kodjaxScore || 0)}>{biggestDisagreementWithKodjax.kodjaxScore}</span>
								| Difference:
								<span class={getDeviationColor(biggestDisagreementWithKodjax.kodjaxDeviation || 0)}>{biggestDisagreementWithKodjax.kodjaxDeviation?.toFixed(1)}</span>
							</div>
						</div>
						<img
							src={biggestDisagreementWithKodjax.anime.coverImage}
							alt={biggestDisagreementWithKodjax.anime.title}
							class="h-16 w-12 rounded object-cover"
							loading="lazy"
						/>
					</div>
				</div>
			{/if}

			{#if biggestDisagreementWithMrBall}
				<div class="rounded-lg bg-gray-800 p-4">
					<h4 class="mb-2 font-semibold text-red-400">⚔️ Biggest Fight with MrBall</h4>
					<div class="flex items-center justify-between">
						<div>
							<div class="font-medium text-white">{biggestDisagreementWithMrBall.anime.title}</div>
							<div class="text-sm text-gray-400">
								You: <span class={getScoreColor(biggestDisagreementWithMrBall.userScore)}>{biggestDisagreementWithMrBall.userScore}</span>
								| MrBall: <span class={getScoreColor(biggestDisagreementWithMrBall.pastafarianinScore || 0)}>{biggestDisagreementWithMrBall.pastafarianinScore}</span>
								| Difference:
								<span class={getDeviationColor(biggestDisagreementWithMrBall.pastafarianinDeviation || 0)}
									>{biggestDisagreementWithMrBall.pastafarianinDeviation?.toFixed(1)}</span
								>
							</div>
						</div>
						<img
							src={biggestDisagreementWithMrBall.anime.coverImage}
							alt={biggestDisagreementWithMrBall.anime.title}
							class="h-16 w-12 rounded object-cover"
							loading="lazy"
						/>
					</div>
				</div>
			{/if}

			{#if is4UserMode && biggestDisagreementWithMaYxS}
				<div class="rounded-lg bg-gray-800 p-4">
					<h4 class="mb-2 font-semibold text-green-400">🌿 Biggest Fight with MaYxS</h4>
					<div class="flex items-center justify-between">
						<div>
							<div class="font-medium text-white">{biggestDisagreementWithMaYxS.anime.title}</div>
							<div class="text-sm text-gray-400">
								You: <span class={getScoreColor(biggestDisagreementWithMaYxS.userScore)}>{biggestDisagreementWithMaYxS.userScore}</span>
								| MaYxS: <span class={getScoreColor(biggestDisagreementWithMaYxS.mayxsScore || 0)}>{biggestDisagreementWithMaYxS.mayxsScore}</span>
								| Difference:
								<span class={getDeviationColor(biggestDisagreementWithMaYxS.mayxsDeviation || 0)}>{biggestDisagreementWithMaYxS.mayxsDeviation?.toFixed(1)}</span>
							</div>
						</div>
						<img
							src={biggestDisagreementWithMaYxS.anime.coverImage}
							alt={biggestDisagreementWithMaYxS.anime.title}
							class="h-16 w-12 rounded object-cover"
							loading="lazy"
						/>
					</div>
				</div>
			{/if}

			{#if is4UserMode && biggestDisagreementWithBlonzej}
				<div class="rounded-lg bg-gray-800 p-4">
					<h4 class="mb-2 font-semibold text-yellow-400">⚡ Biggest Fight with Blonzej</h4>
					<div class="flex items-center justify-between">
						<div>
							<div class="font-medium text-white">{biggestDisagreementWithBlonzej.anime.title}</div>
							<div class="text-sm text-gray-400">
								You: <span class={getScoreColor(biggestDisagreementWithBlonzej.userScore)}>{biggestDisagreementWithBlonzej.userScore}</span>
								| Blonzej:
								<span class={getScoreColor(biggestDisagreementWithBlonzej.blonzejScore || 0)}
									>{formatBlonzejScore(biggestDisagreementWithBlonzej.blonzejScore, biggestDisagreementWithBlonzej.blonzejOriginalScore)}</span
								>
								| Difference:
								<span class={getDeviationColor(biggestDisagreementWithBlonzej.blonzejDeviation || 0)}
									>{biggestDisagreementWithBlonzej.blonzejDeviation?.toFixed(1)}</span
								>
							</div>
						</div>
						<img
							src={biggestDisagreementWithBlonzej.anime.coverImage}
							alt={biggestDisagreementWithBlonzej.anime.title}
							class="h-16 w-12 rounded object-cover"
							loading="lazy"
						/>
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Your Top Rated Common Anime -->
	<Card class="border-gray-800 bg-gray-900">
		<CardHeader class="">
			<CardTitle class="text-white">Your Top Rated Common {result.mode.charAt(0).toUpperCase() + result.mode.slice(1)} Anime</CardTitle>
			<CardDescription class="text-gray-400">Highest scored anime you share with the base users</CardDescription>
		</CardHeader>
		<CardContent class="">
			<div class="space-y-3">
				{#each topAnime as comparison, index}
					<div class="flex items-center space-x-4 rounded-lg bg-gray-800 p-3">
						<div class="w-6 text-lg font-bold text-gray-400">
							#{index + 1}
						</div>
						<img src={comparison.anime.coverImage} alt={comparison.anime.title} class="h-14 w-10 rounded object-cover" loading="lazy" />
						<div class="flex-1">
							<div class="text-sm font-medium text-white">{comparison.anime.title}</div>
							<div class="mt-1 text-xs text-gray-400">
								You: <span class={getScoreColor(comparison.userScore)}>{comparison.userScore}</span>
								{#if comparison.kodjaxScore}
									| Kodjax: <span class={getScoreColor(comparison.kodjaxScore)}>{comparison.kodjaxScore}</span>
									<span class="text-gray-500">(±{comparison.kodjaxDeviation?.toFixed(1)})</span>
								{/if}
								{#if comparison.pastafarianinScore}
									| MrBall: <span class={getScoreColor(comparison.pastafarianinScore)}>{comparison.pastafarianinScore}</span>
									<span class="text-gray-500">(±{comparison.pastafarianinDeviation?.toFixed(1)})</span>
								{/if}
								{#if is4UserMode && comparison.mayxsScore}
									| MaYxS: <span class={getScoreColor(comparison.mayxsScore)}>{comparison.mayxsScore}</span>
									<span class="text-gray-500">(±{comparison.mayxsDeviation?.toFixed(1)})</span>
								{/if}
								{#if is4UserMode && comparison.blonzejScore}
									| Blonzej: <span class={getScoreColor(comparison.blonzejScore)}>{formatBlonzejScore(comparison.blonzejScore, comparison.blonzejOriginalScore)}</span>
									<span class="text-gray-500">(±{comparison.blonzejDeviation?.toFixed(1)})</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</CardContent>
	</Card>

	<!-- Your Lowest Rated Common Anime -->
	<Card class="border-gray-800 bg-gray-900">
		<CardHeader class="">
			<CardTitle class="text-white">Your Lowest Rated Common {result.mode.charAt(0).toUpperCase() + result.mode.slice(1)} Anime</CardTitle>
			<CardDescription class="text-gray-400">Anime you didn't enjoy but share with the base users</CardDescription>
		</CardHeader>
		<CardContent class="">
			<div class="space-y-3">
				{#each bottomAnime as comparison, index}
					<div class="flex items-center space-x-4 rounded-lg bg-gray-800 p-3">
						<div class="w-6 text-lg font-bold text-gray-400">
							#{sortedCommonAnime.length - bottomAnime.length + index + 1}
						</div>
						<img src={comparison.anime.coverImage} alt={comparison.anime.title} class="h-14 w-10 rounded object-cover" loading="lazy" />
						<div class="flex-1">
							<div class="text-sm font-medium text-white">{comparison.anime.title}</div>
							<div class="mt-1 text-xs text-gray-400">
								You: <span class={getScoreColor(comparison.userScore)}>{comparison.userScore}</span>
								{#if comparison.kodjaxScore}
									| Kodjax: <span class={getScoreColor(comparison.kodjaxScore)}>{comparison.kodjaxScore}</span>
									<span class="text-gray-500">(±{comparison.kodjaxDeviation?.toFixed(1)})</span>
								{/if}
								{#if comparison.pastafarianinScore}
									| MrBall: <span class={getScoreColor(comparison.pastafarianinScore)}>{comparison.pastafarianinScore}</span>
									<span class="text-gray-500">(±{comparison.pastafarianinDeviation?.toFixed(1)})</span>
								{/if}
								{#if is4UserMode && comparison.mayxsScore}
									| MaYxS: <span class={getScoreColor(comparison.mayxsScore)}>{comparison.mayxsScore}</span>
									<span class="text-gray-500">(±{comparison.mayxsDeviation?.toFixed(1)})</span>
								{/if}
								{#if is4UserMode && comparison.blonzejScore}
									| Blonzej: <span class={getScoreColor(comparison.blonzejScore)}>{formatBlonzejScore(comparison.blonzejScore, comparison.blonzejOriginalScore)}</span>
									<span class="text-gray-500">(±{comparison.blonzejDeviation?.toFixed(1)})</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</CardContent>
	</Card>

	<!-- Complete Anime Comparison Table -->
	<Card class="border-gray-800 bg-gray-900">
		<CardHeader class="">
			<CardTitle class="text-white">Complete Anime Comparison</CardTitle>
			<CardDescription class="text-gray-400">
				All common {result.mode} anime with score differences
			</CardDescription>
		</CardHeader>
		<CardContent class="">
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-700">
							<th class="p-2 text-left text-gray-300">Anime</th>
							<th class="p-2 text-center text-gray-300">Your Score</th>
							<th class="p-2 text-center text-gray-300">Kodjax</th>
							<th class="p-2 text-center text-gray-300">MrBall</th>
							{#if is4UserMode}
								<th class="p-2 text-center text-gray-300">MaYxS</th>
								<th class="p-2 text-center text-gray-300">Blonzej</th>
							{/if}
							<th class="p-2 text-center text-gray-300">Diff vs Kodjax</th>
							<th class="p-2 text-center text-gray-300">Diff vs MrBall</th>
							{#if is4UserMode}
								<th class="p-2 text-center text-gray-300">Diff vs MaYxS</th>
								<th class="p-2 text-center text-gray-300">Diff vs Blonzej</th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each sortedCommonAnime as comparison}
							<tr class="border-b border-gray-800 hover:bg-gray-800/50">
								<td class="p-2">
									<div class="flex items-center space-x-2">
										<img src={comparison.anime.coverImage} alt={comparison.anime.title} class="h-10 w-8 rounded object-cover" loading="lazy" />
										<span class="text-xs text-white">{comparison.anime.title}</span>
									</div>
								</td>
								<td class="p-2 text-center">
									<span class="{getScoreColor(comparison.userScore)} font-semibold">
										{comparison.userScore}
									</span>
								</td>
								<td class="p-2 text-center">
									{#if comparison.kodjaxScore !== undefined}
										<span class={getScoreColor(comparison.kodjaxScore)}>
											{formatUserScore(comparison.kodjaxScore, comparison.kodjaxOriginalScore, comparison.kodjaxScoringSystem, 'kodjax')}
										</span>
									{:else}
										<span class="text-gray-500">-</span>
									{/if}
								</td>
								<td class="p-2 text-center">
									{#if comparison.pastafarianinScore !== undefined}
										<span class={getScoreColor(comparison.pastafarianinScore)}>
											{formatUserScore(comparison.pastafarianinScore, comparison.pastafarianinOriginalScore, comparison.pastafarianinScoringSystem, 'pastafarianin')}
										</span>
									{:else}
										<span class="text-gray-500">-</span>
									{/if}
								</td>
								{#if is4UserMode}
									<td class="p-2 text-center">
										{#if comparison.mayxsScore !== undefined}
											<span class={getScoreColor(comparison.mayxsScore)}>
												{formatUserScore(comparison.mayxsScore, comparison.mayxsOriginalScore, comparison.mayxsScoringSystem, 'mayxs')}
											</span>
										{:else}
											<span class="text-gray-500">-</span>
										{/if}
									</td>
									<td class="p-2 text-center">
										{#if comparison.blonzejScore !== undefined}
											<span class={getScoreColor(comparison.blonzejScore)}>
												{formatUserScore(comparison.blonzejScore, comparison.blonzejOriginalScore, comparison.blonzejScoringSystem, 'blonzej')}
											</span>
										{:else}
											<span class="text-gray-500">-</span>
										{/if}
									</td>
								{/if}
								<td class="p-2 text-center">
									{#if comparison.kodjaxDeviation !== undefined && comparison.kodjaxScore !== undefined && comparison.kodjaxScore !== null && comparison.kodjaxScore > 0}
										<span class={getDeviationColor(comparison.kodjaxDeviation)}>
											{comparison.kodjaxDeviation.toFixed(1)}
										</span>
									{:else}
										<span class="text-gray-500">-</span>
									{/if}
								</td>
								<td class="p-2 text-center">
									{#if comparison.pastafarianinDeviation !== undefined && comparison.pastafarianinScore !== undefined && comparison.pastafarianinScore !== null && comparison.pastafarianinScore > 0}
										<span class={getDeviationColor(comparison.pastafarianinDeviation)}>
											{comparison.pastafarianinDeviation.toFixed(1)}
										</span>
									{:else}
										<span class="text-gray-500">-</span>
									{/if}
								</td>
								{#if is4UserMode}
									<td class="p-2 text-center">
										{#if comparison.mayxsDeviation !== undefined && comparison.mayxsScore !== undefined && comparison.mayxsScore !== null && comparison.mayxsScore > 0}
											<span class={getDeviationColor(comparison.mayxsDeviation)}>
												{comparison.mayxsDeviation.toFixed(1)}
											</span>
										{:else}
											<span class="text-gray-500">-</span>
										{/if}
									</td>
									<td class="p-2 text-center">
										{#if comparison.blonzejDeviation !== undefined && comparison.blonzejScore !== undefined && comparison.blonzejScore !== null && comparison.blonzejScore > 0}
											<span class={getDeviationColor(comparison.blonzejDeviation)}>
												{comparison.blonzejDeviation.toFixed(1)}
											</span>
										{:else}
											<span class="text-gray-500">-</span>
										{/if}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</CardContent>
	</Card>
</div>
