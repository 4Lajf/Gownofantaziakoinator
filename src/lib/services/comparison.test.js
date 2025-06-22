import { describe, it, expect } from 'vitest';
import { 
  findCommonAnime, 
  calculateSimilarityScore, 
  generateScatterPlotData,
  createComparison 
} from './comparison.js';

describe('Comparison Service', () => {
  const mockUser1 = {
    username: 'TestUser1',
    platform: 'anilist',
    avatar: null,
    animeCount: 100,
    meanScore: 7.5,
    fantasyAnime: [
      {
        id: 1,
        title: 'Attack on Titan',
        score: 9,
        status: 'completed',
        genres: ['Fantasy', 'Action'],
        coverImage: 'test.jpg',
        episodes: 25,
        source: 'anilist',
        format: 'TV',
        year: 2013
      },
      {
        id: 2,
        title: 'Fullmetal Alchemist',
        score: 10,
        status: 'completed',
        genres: ['Fantasy', 'Adventure'],
        coverImage: 'test2.jpg',
        episodes: 64,
        source: 'anilist',
        format: 'TV',
        year: 2003
      }
    ]
  };

  const mockUser2 = {
    username: 'TestUser2',
    platform: 'mal',
    avatar: null,
    animeCount: 150,
    meanScore: 8.0,
    fantasyAnime: [
      {
        id: 101,
        title: 'Attack on Titan',
        score: 8,
        status: 'completed',
        genres: ['Fantasy', 'Action'],
        coverImage: 'test.jpg',
        episodes: 25,
        source: 'mal',
        format: 'TV',
        year: 2013
      },
      {
        id: 102,
        title: 'Different Anime',
        score: 7,
        status: 'completed',
        genres: ['Fantasy'],
        coverImage: 'test3.jpg',
        episodes: 12,
        source: 'mal',
        format: 'TV',
        year: 2020
      }
    ]
  };

  describe('findCommonAnime', () => {
    it('should find common anime between two users', () => {
      const common = findCommonAnime(mockUser1, mockUser2);
      expect(common).toHaveLength(1);
      expect(common[0].title).toBe('Attack on Titan');
      expect(common[0].user1Score).toBe(9);
      expect(common[0].user2Score).toBe(8);
    });

    it('should return empty array when no common anime', () => {
      const user1 = { ...mockUser1, fantasyAnime: [mockUser1.fantasyAnime[1]] };
      const user2 = { ...mockUser2, fantasyAnime: [mockUser2.fantasyAnime[1]] };
      const common = findCommonAnime(user1, user2);
      expect(common).toHaveLength(0);
    });
  });

  describe('calculateSimilarityScore', () => {
    it('should calculate similarity score correctly', () => {
      const commonAnime = [
        {
          title: 'Test Anime',
          user1Score: 9,
          user2Score: 8
        }
      ];
      const score = calculateSimilarityScore(commonAnime);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return 0 for empty common anime list', () => {
      const score = calculateSimilarityScore([]);
      expect(score).toBe(0);
    });

    it('should return 0 when no scores available', () => {
      const commonAnime = [
        {
          title: 'Test Anime',
          user1Score: null,
          user2Score: null
        }
      ];
      const score = calculateSimilarityScore(commonAnime);
      expect(score).toBe(0);
    });
  });

  describe('generateScatterPlotData', () => {
    it('should generate scatter plot data correctly', () => {
      const commonAnime = [
        {
          title: 'Test Anime',
          id: 1,
          user1Score: 9,
          user2Score: 8,
          coverImage: 'test.jpg',
          genres: ['Fantasy']
        }
      ];
      const scatterData = generateScatterPlotData(commonAnime);
      expect(scatterData).toHaveLength(1);
      expect(scatterData[0]).toHaveProperty('x', 9);
      expect(scatterData[0]).toHaveProperty('y', 8);
      expect(scatterData[0]).toHaveProperty('title', 'Test Anime');
    });

    it('should filter out anime without scores', () => {
      const commonAnime = [
        {
          title: 'Test Anime 1',
          id: 1,
          user1Score: 9,
          user2Score: 8,
          coverImage: 'test.jpg',
          genres: ['Fantasy']
        },
        {
          title: 'Test Anime 2',
          id: 2,
          user1Score: null,
          user2Score: 8,
          coverImage: 'test2.jpg',
          genres: ['Fantasy']
        }
      ];
      const scatterData = generateScatterPlotData(commonAnime);
      expect(scatterData).toHaveLength(1);
    });
  });

  describe('createComparison', () => {
    it('should create a complete comparison object', () => {
      const comparison = createComparison(mockUser1, mockUser2);
      expect(comparison).toHaveProperty('user1', mockUser1);
      expect(comparison).toHaveProperty('user2', mockUser2);
      expect(comparison).toHaveProperty('commonAnime');
      expect(comparison).toHaveProperty('similarityScore');
      expect(comparison.commonAnime).toHaveLength(1);
      expect(comparison.similarityScore).toBeGreaterThan(0);
    });
  });
});
