import { query } from '../database/db';
import NodeCache from 'node-cache';

// 캐시 설정 (성능 최적화)
// TTL: 5분, 체크 주기: 60초
const searchCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export interface SearchFilters {
  userId: number;
  query?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  friendId?: number;
  page?: number;
  limit?: number;
}

export interface Post {
  id: number;
  user_id: number;
  user_name: string;
  user_avatar: string;
  title: string;
  content: string;
  tags: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export interface SearchResult {
  posts: Post[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * 친구 게시물 검색 (성능 최적화)
 * - Full-Text Search 사용
 * - 인덱스 활용
 * - 페이지네이션
 * - 결과 캐싱
 */
export async function searchFriendPosts(
  filters: SearchFilters
): Promise<SearchResult> {
  const {
    userId,
    query: searchQuery,
    tags,
    dateFrom,
    dateTo,
    friendId,
    page = 1,
    limit = 20,
  } = filters;

  // 캐시 키 생성
  const cacheKey = JSON.stringify(filters);
  const cachedResult = searchCache.get<SearchResult>(cacheKey);

  if (cachedResult) {
    console.log('Cache hit for search:', cacheKey);
    return cachedResult;
  }

  // 페이지네이션 계산
  const offset = (page - 1) * limit;

  // 동적 쿼리 빌더 (SQL Injection 방지를 위한 파라미터화)
  let queryText = `
    SELECT
      p.id,
      p.user_id,
      u.name as user_name,
      u.avatar_url as user_avatar,
      p.title,
      p.content,
      p.tags,
      p.likes_count,
      p.comments_count,
      p.created_at,
      COUNT(*) OVER() AS total_count
    FROM posts p
    INNER JOIN users u ON p.user_id = u.id
    INNER JOIN friendships f ON (
      (f.user_id = $1 AND f.friend_id = p.user_id) OR
      (f.friend_id = $1 AND f.user_id = p.user_id)
    )
    WHERE f.status = 'accepted'
  `;

  const queryParams: any[] = [userId];
  let paramIndex = 2;

  // Full-Text Search 조건 추가
  if (searchQuery && searchQuery.trim()) {
    queryText += ` AND p.search_vector @@ plainto_tsquery('english', $${paramIndex})`;
    queryParams.push(searchQuery);
    paramIndex++;
  }

  // 태그 필터
  if (tags && tags.length > 0) {
    queryText += ` AND p.tags && $${paramIndex}::text[]`;
    queryParams.push(tags);
    paramIndex++;
  }

  // 날짜 범위 필터
  if (dateFrom) {
    queryText += ` AND p.created_at >= $${paramIndex}`;
    queryParams.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    queryText += ` AND p.created_at <= $${paramIndex}`;
    queryParams.push(dateTo);
    paramIndex++;
  }

  // 특정 친구 필터
  if (friendId) {
    queryText += ` AND p.user_id = $${paramIndex}`;
    queryParams.push(friendId);
    paramIndex++;
  }

  // 정렬 및 페이지네이션
  queryText += `
    ORDER BY p.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  queryParams.push(limit, offset);

  try {
    const result = await query(queryText, queryParams);

    const posts: Post[] = result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      user_name: row.user_name,
      user_avatar: row.user_avatar,
      title: row.title,
      content: row.content,
      tags: row.tags || [],
      likes_count: row.likes_count,
      comments_count: row.comments_count,
      created_at: row.created_at,
    }));

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    const totalPages = Math.ceil(total / limit);

    const searchResult: SearchResult = {
      posts,
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    };

    // 결과 캐싱
    searchCache.set(cacheKey, searchResult);

    return searchResult;
  } catch (error) {
    console.error('Search error:', error);
    throw new Error('Failed to search posts');
  }
}

/**
 * 인기 태그 조회 (캐싱)
 */
export async function getPopularTags(userId: number, limit: number = 10): Promise<string[]> {
  const cacheKey = `popular_tags_${userId}_${limit}`;
  const cached = searchCache.get<string[]>(cacheKey);

  if (cached) {
    return cached;
  }

  const queryText = `
    SELECT DISTINCT unnest(p.tags) as tag, COUNT(*) as count
    FROM posts p
    INNER JOIN friendships f ON (
      (f.user_id = $1 AND f.friend_id = p.user_id) OR
      (f.friend_id = $1 AND f.user_id = p.user_id)
    )
    WHERE f.status = 'accepted'
    GROUP BY tag
    ORDER BY count DESC
    LIMIT $2
  `;

  try {
    const result = await query(queryText, [userId, limit]);
    const tags = result.rows.map((row) => row.tag);
    searchCache.set(cacheKey, tags);
    return tags;
  } catch (error) {
    console.error('Failed to get popular tags:', error);
    return [];
  }
}

/**
 * 캐시 무효화 (게시물 작성/수정/삭제 시 호출)
 */
export function invalidateCache(userId?: number) {
  if (userId) {
    const keys = searchCache.keys().filter((key) => key.includes(`"userId":${userId}`));
    searchCache.del(keys);
  } else {
    searchCache.flushAll();
  }
}
