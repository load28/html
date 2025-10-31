import { Router, Request, Response } from 'express';
import {
  searchPostsWithElasticsearch,
  getAutocompleteSuggestions,
  getRelatedQueries,
  getTrendingSearches,
  getPopularTagsFromES,
  getMoreLikeThis,
  ESSearchFilters,
} from '../services/elasticsearchSearchService';

const router = Router();

/**
 * GET /api/es/search/posts
 * Elasticsearch 기반 고급 게시물 검색
 *
 * Query Parameters:
 * - userId: number (required) - 검색하는 사용자 ID
 * - query: string (optional) - 검색어
 * - tags: string[] (optional) - 태그 필터
 * - dateFrom: string (optional) - 시작 날짜
 * - dateTo: string (optional) - 종료 날짜
 * - friendId: number (optional) - 특정 친구 ID
 * - page: number (optional, default: 1) - 페이지 번호
 * - limit: number (optional, default: 20) - 페이지당 결과 수
 * - sortBy: string (optional) - 정렬 방식 (relevance, date, popularity)
 * - fuzzy: boolean (optional) - 퍼지 검색 활성화
 */
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string);

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        error: 'Valid userId is required',
      });
    }

    const filters: ESSearchFilters = {
      userId,
      query: req.query.query as string,
      tags: req.query.tags
        ? Array.isArray(req.query.tags)
          ? (req.query.tags as string[])
          : [req.query.tags as string]
        : undefined,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      friendId: req.query.friendId
        ? parseInt(req.query.friendId as string)
        : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      sortBy: (req.query.sortBy as any) || 'relevance',
      fuzzy: req.query.fuzzy === 'true' || req.query.fuzzy === '1',
    };

    // Limit 제한 (DoS 방지)
    if (filters.limit && filters.limit > 100) {
      filters.limit = 100;
    }

    const result = await searchPostsWithElasticsearch(filters);

    res.json({
      success: true,
      data: result,
      powered_by: 'Elasticsearch',
    });
  } catch (error: any) {
    console.error('Elasticsearch search API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search posts',
      message: error.message,
    });
  }
});

/**
 * GET /api/es/search/autocomplete
 * 자동완성 제안 (ngram 기반)
 *
 * Query Parameters:
 * - userId: number (required) - 사용자 ID
 * - query: string (required) - 검색어 (최소 2자)
 * - limit: number (optional, default: 5) - 결과 수
 */
router.get('/autocomplete', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string);
    const query = req.query.query as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        error: 'Valid userId is required',
      });
    }

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const suggestions = await getAutocompleteSuggestions(userId, query, limit);

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error('Autocomplete API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get autocomplete suggestions',
    });
  }
});

/**
 * GET /api/es/search/related
 * 관련 검색어 추천
 *
 * Query Parameters:
 * - query: string (required) - 검색어
 * - limit: number (optional, default: 5) - 결과 수
 */
router.get('/related', async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
      });
    }

    const relatedQueries = await getRelatedQueries(query, limit);

    res.json({
      success: true,
      data: relatedQueries,
    });
  } catch (error) {
    console.error('Related queries API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get related queries',
    });
  }
});

/**
 * GET /api/es/search/trending
 * 인기 검색어 (최근 1주일)
 *
 * Query Parameters:
 * - limit: number (optional, default: 10) - 결과 수
 */
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const trending = await getTrendingSearches(limit);

    res.json({
      success: true,
      data: trending,
    });
  } catch (error) {
    console.error('Trending searches API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trending searches',
    });
  }
});

/**
 * GET /api/es/search/tags
 * 인기 태그 조회 (Elasticsearch Aggregations)
 *
 * Query Parameters:
 * - userId: number (required) - 사용자 ID
 * - limit: number (optional, default: 10) - 결과 수
 */
router.get('/tags', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        error: 'Valid userId is required',
      });
    }

    const tags = await getPopularTagsFromES(userId, limit);

    res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    console.error('Popular tags API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get popular tags',
    });
  }
});

/**
 * GET /api/es/search/similar/:postId
 * 유사 게시물 추천 (More Like This)
 *
 * Path Parameters:
 * - postId: string (required) - 게시물 ID
 *
 * Query Parameters:
 * - limit: number (optional, default: 5) - 결과 수
 */
router.get('/similar/:postId', async (req: Request, res: Response) => {
  try {
    const postId = req.params.postId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

    const similarPosts = await getMoreLikeThis(postId, limit);

    res.json({
      success: true,
      data: similarPosts,
    });
  } catch (error) {
    console.error('Similar posts API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get similar posts',
    });
  }
});

export default router;
