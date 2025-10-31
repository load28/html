import { Router, Request, Response } from 'express';
import {
  searchFriendPosts,
  getPopularTags,
  SearchFilters,
} from '../services/searchService';

const router = Router();

/**
 * GET /api/search/posts
 * 친구 게시물 검색 API
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
 */
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string);

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        error: 'Valid userId is required',
      });
    }

    const filters: SearchFilters = {
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
    };

    // Limit 제한 (DoS 방지)
    if (filters.limit && filters.limit > 100) {
      filters.limit = 100;
    }

    const result = await searchFriendPosts(filters);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search posts',
    });
  }
});

/**
 * GET /api/search/tags
 * 인기 태그 조회 API
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

    const tags = await getPopularTags(userId, limit);

    res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    console.error('Tags API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get popular tags',
    });
  }
});

/**
 * GET /api/search/suggestions
 * 검색어 자동완성 API
 */
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string);
    const query = req.query.query as string;

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

    // 간단한 자동완성: 최근 게시물 제목에서 검색
    const result = await searchFriendPosts({
      userId,
      query,
      limit: 5,
    });

    const suggestions = result.posts
      .map((post) => post.title)
      .filter((title) => title && title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5);

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error('Suggestions API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suggestions',
    });
  }
});

export default router;
