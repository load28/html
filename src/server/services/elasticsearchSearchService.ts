import esClient, {
  POSTS_INDEX,
  SEARCH_LOGS_INDEX,
  indexDocument,
} from './elasticsearchClient';
import NodeCache from 'node-cache';

// 캐시 설정 (Elasticsearch 결과도 캐싱)
const searchCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export interface ESSearchFilters {
  userId: number;
  query?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  friendId?: number;
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'date' | 'popularity';
  fuzzy?: boolean; // 퍼지 검색 활성화
}

export interface ESSearchResult {
  posts: any[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
  searchTime: number; // 검색 시간 (ms)
  maxScore?: number; // 최고 관련도 점수
}

/**
 * Elasticsearch를 사용한 고급 게시물 검색
 *
 * 성능 최적화 기능:
 * - Full-Text Search with Korean analyzer (nori)
 * - Fuzzy search (오타 허용)
 * - Multi-field boosting (제목 가중치 > 내용)
 * - 관련도 점수 기반 정렬
 * - 실시간 집계 (Aggregations)
 */
export async function searchPostsWithElasticsearch(
  filters: ESSearchFilters
): Promise<ESSearchResult> {
  const startTime = Date.now();
  const {
    userId,
    query: searchQuery,
    tags,
    dateFrom,
    dateTo,
    friendId,
    page = 1,
    limit = 20,
    sortBy = 'relevance',
    fuzzy = true,
  } = filters;

  // 캐시 체크
  const cacheKey = JSON.stringify(filters);
  const cachedResult = searchCache.get<ESSearchResult>(cacheKey);

  if (cachedResult) {
    console.log('✓ Cache hit for Elasticsearch search');
    return cachedResult;
  }

  // 페이지네이션 계산
  const from = (page - 1) * limit;

  // Elasticsearch 쿼리 DSL 구성
  const mustQueries: any[] = [];
  const filterQueries: any[] = [];

  // 친구 관계 필터 (필수)
  // 실제 구현에서는 friendships 정보를 미리 인덱스에 포함하거나
  // 별도로 조회한 friend IDs를 사용해야 함
  // 여기서는 user_id 필터링으로 간략화
  if (friendId) {
    filterQueries.push({ term: { user_id: friendId } });
  }

  // Full-Text Search 쿼리
  if (searchQuery && searchQuery.trim()) {
    const matchQuery: any = {
      multi_match: {
        query: searchQuery,
        fields: [
          'title^3', // 제목에 3배 가중치
          'content^1', // 내용에 1배 가중치
          'user_name^2', // 작성자에 2배 가중치
        ],
        type: 'best_fields',
        operator: 'or',
        minimum_should_match: '70%', // 70% 이상 매칭
      },
    };

    // 퍼지 검색 추가 (오타 허용)
    if (fuzzy) {
      matchQuery.multi_match.fuzziness = 'AUTO';
      matchQuery.multi_match.prefix_length = 2;
    }

    mustQueries.push(matchQuery);
  }

  // 태그 필터 (정확한 매칭)
  if (tags && tags.length > 0) {
    filterQueries.push({
      terms: { tags: tags },
    });
  }

  // 날짜 범위 필터
  if (dateFrom || dateTo) {
    const rangeQuery: any = { range: { created_at: {} } };

    if (dateFrom) rangeQuery.range.created_at.gte = dateFrom;
    if (dateTo) rangeQuery.range.created_at.lte = dateTo;

    filterQueries.push(rangeQuery);
  }

  // 정렬 설정
  let sort: any[] = [];
  switch (sortBy) {
    case 'date':
      sort = [{ created_at: { order: 'desc' } }];
      break;
    case 'popularity':
      sort = [
        { likes_count: { order: 'desc' } },
        { comments_count: { order: 'desc' } },
        { created_at: { order: 'desc' } },
      ];
      break;
    case 'relevance':
    default:
      sort = ['_score', { created_at: { order: 'desc' } }];
      break;
  }

  // 최종 쿼리 구성
  const searchBody: any = {
    query: {
      bool: {
        must: mustQueries.length > 0 ? mustQueries : [{ match_all: {} }],
        filter: filterQueries,
      },
    },
    sort,
    from,
    size: limit,
    // 검색 결과 하이라이팅
    highlight: {
      fields: {
        title: {},
        content: { fragment_size: 150, number_of_fragments: 3 },
      },
      pre_tags: ['<mark>'],
      post_tags: ['</mark>'],
    },
    // 집계 추가 (통계용)
    aggs: {
      popular_tags: {
        terms: { field: 'tags', size: 10 },
      },
      date_histogram: {
        date_histogram: {
          field: 'created_at',
          calendar_interval: 'day',
        },
      },
    },
  };

  try {
    // Elasticsearch 검색 실행
    const response = await esClient.search({
      index: POSTS_INDEX,
      body: searchBody,
    });

    const hits = response.hits.hits;
    const total = typeof response.hits.total === 'object'
      ? response.hits.total.value
      : response.hits.total;

    // 검색 결과 변환
    const posts = hits.map((hit: any) => ({
      ...hit._source,
      _score: hit._score,
      _highlights: hit.highlight, // 하이라이팅 결과
    }));

    const totalPages = Math.ceil(total / limit);
    const searchTime = Date.now() - startTime;

    const result: ESSearchResult = {
      posts,
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
      searchTime,
      maxScore: response.hits.max_score || undefined,
    };

    // 결과 캐싱
    searchCache.set(cacheKey, result);

    // 검색 로그 기록 (비동기, non-blocking)
    logSearch(userId, filters, total, searchTime).catch((err) =>
      console.error('Failed to log search:', err)
    );

    console.log(
      `✓ Elasticsearch search completed in ${searchTime}ms (${total} results)`
    );

    return result;
  } catch (error) {
    console.error('Elasticsearch search error:', error);
    throw new Error('Search failed');
  }
}

/**
 * 자동완성 제안 (ngram 기반)
 */
export async function getAutocompleteSuggestions(
  userId: number,
  query: string,
  limit: number = 5
): Promise<string[]> {
  if (!query || query.length < 2) return [];

  try {
    const response = await esClient.search({
      index: POSTS_INDEX,
      body: {
        query: {
          multi_match: {
            query,
            fields: ['title.autocomplete', 'user_name.autocomplete'],
            type: 'bool_prefix',
          },
        },
        size: limit,
        _source: ['title'],
      },
    });

    const suggestions = response.hits.hits
      .map((hit: any) => hit._source.title)
      .filter((title: string) => title && title.trim());

    return [...new Set(suggestions)]; // 중복 제거
  } catch (error) {
    console.error('Autocomplete error:', error);
    return [];
  }
}

/**
 * 관련 검색어 추천 (검색 로그 분석)
 */
export async function getRelatedQueries(
  query: string,
  limit: number = 5
): Promise<string[]> {
  try {
    const response = await esClient.search({
      index: SEARCH_LOGS_INDEX,
      body: {
        query: {
          match: { query: { query, fuzziness: 'AUTO' } },
        },
        aggs: {
          related_queries: {
            terms: { field: 'query.keyword', size: limit },
          },
        },
        size: 0,
      },
    });

    const buckets = response.aggregations?.related_queries?.buckets || [];
    return buckets.map((bucket: any) => bucket.key);
  } catch (error) {
    console.error('Related queries error:', error);
    return [];
  }
}

/**
 * 인기 검색어 (최근 1주일)
 */
export async function getTrendingSearches(limit: number = 10): Promise<any[]> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  try {
    const response = await esClient.search({
      index: SEARCH_LOGS_INDEX,
      body: {
        query: {
          range: {
            timestamp: { gte: oneWeekAgo.toISOString() },
          },
        },
        aggs: {
          trending: {
            terms: {
              field: 'query.keyword',
              size: limit,
              order: { _count: 'desc' },
            },
          },
        },
        size: 0,
      },
    });

    const buckets = response.aggregations?.trending?.buckets || [];
    return buckets.map((bucket: any) => ({
      query: bucket.key,
      count: bucket.doc_count,
    }));
  } catch (error) {
    console.error('Trending searches error:', error);
    return [];
  }
}

/**
 * 태그 집계 (인기 태그)
 */
export async function getPopularTagsFromES(
  userId: number,
  limit: number = 10
): Promise<string[]> {
  const cacheKey = `popular_tags_es_${userId}_${limit}`;
  const cached = searchCache.get<string[]>(cacheKey);

  if (cached) return cached;

  try {
    const response = await esClient.search({
      index: POSTS_INDEX,
      body: {
        query: { match_all: {} },
        aggs: {
          popular_tags: {
            terms: { field: 'tags', size: limit, order: { _count: 'desc' } },
          },
        },
        size: 0,
      },
    });

    const buckets = response.aggregations?.popular_tags?.buckets || [];
    const tags = buckets.map((bucket: any) => bucket.key);

    searchCache.set(cacheKey, tags);
    return tags;
  } catch (error) {
    console.error('Popular tags error:', error);
    return [];
  }
}

/**
 * 검색 로그 기록
 */
async function logSearch(
  userId: number,
  filters: ESSearchFilters,
  resultsCount: number,
  responseTime: number
): Promise<void> {
  const logEntry = {
    user_id: userId,
    query: filters.query || '',
    filters: {
      tags: filters.tags,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      friendId: filters.friendId,
      sortBy: filters.sortBy,
    },
    results_count: resultsCount,
    timestamp: new Date().toISOString(),
    response_time_ms: responseTime,
  };

  try {
    await indexDocument(
      SEARCH_LOGS_INDEX,
      `${userId}_${Date.now()}`,
      logEntry
    );
  } catch (error) {
    console.error('Failed to log search:', error);
  }
}

/**
 * 캐시 무효화
 */
export function invalidateESCache(pattern?: string) {
  if (pattern) {
    const keys = searchCache.keys().filter((key) => key.includes(pattern));
    searchCache.del(keys);
  } else {
    searchCache.flushAll();
  }
  console.log('✓ Elasticsearch cache invalidated');
}

/**
 * More Like This 쿼리 (유사 게시물 추천)
 */
export async function getMoreLikeThis(
  postId: string,
  limit: number = 5
): Promise<any[]> {
  try {
    const response = await esClient.search({
      index: POSTS_INDEX,
      body: {
        query: {
          more_like_this: {
            fields: ['title', 'content', 'tags'],
            like: [{ _index: POSTS_INDEX, _id: postId }],
            min_term_freq: 1,
            min_doc_freq: 1,
            max_query_terms: 12,
          },
        },
        size: limit,
      },
    });

    return response.hits.hits.map((hit: any) => hit._source);
  } catch (error) {
    console.error('More like this error:', error);
    return [];
  }
}

export default esClient;
