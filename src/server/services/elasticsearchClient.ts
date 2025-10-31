import { Client } from '@elastic/elasticsearch';

// Elasticsearch 클라이언트 설정
const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
  },
  maxRetries: 5,
  requestTimeout: 60000,
  sniffOnStart: true,
});

// 인덱스 이름
export const POSTS_INDEX = 'friend_posts';
export const SEARCH_LOGS_INDEX = 'search_logs';

/**
 * Elasticsearch 인덱스 매핑 설정
 * 한국어 검색 최적화를 위한 nori 분석기 사용
 */
export const postsIndexMapping = {
  settings: {
    analysis: {
      // 한국어 형태소 분석기 설정
      analyzer: {
        korean_analyzer: {
          type: 'custom',
          tokenizer: 'nori_tokenizer',
          filter: ['nori_part_of_speech', 'lowercase', 'nori_readingform'],
        },
        // 자동완성용 분석기
        autocomplete_analyzer: {
          type: 'custom',
          tokenizer: 'autocomplete_tokenizer',
          filter: ['lowercase'],
        },
        autocomplete_search_analyzer: {
          type: 'custom',
          tokenizer: 'keyword',
          filter: ['lowercase'],
        },
      },
      tokenizer: {
        // nori 토크나이저
        nori_tokenizer: {
          type: 'nori_tokenizer',
          decompound_mode: 'mixed',
        },
        // ngram 토크나이저 (자동완성용)
        autocomplete_tokenizer: {
          type: 'edge_ngram',
          min_gram: 2,
          max_gram: 20,
          token_chars: ['letter', 'digit'],
        },
      },
    },
    // 샤딩 설정 (확장성)
    number_of_shards: 3,
    number_of_replicas: 1,
  },
  mappings: {
    properties: {
      id: { type: 'integer' },
      user_id: { type: 'integer' },
      user_name: {
        type: 'text',
        analyzer: 'korean_analyzer',
        fields: {
          keyword: { type: 'keyword' },
          autocomplete: {
            type: 'text',
            analyzer: 'autocomplete_analyzer',
            search_analyzer: 'autocomplete_search_analyzer',
          },
        },
      },
      user_avatar: { type: 'keyword' },
      title: {
        type: 'text',
        analyzer: 'korean_analyzer',
        fields: {
          keyword: { type: 'keyword' },
          autocomplete: {
            type: 'text',
            analyzer: 'autocomplete_analyzer',
            search_analyzer: 'autocomplete_search_analyzer',
          },
        },
      },
      content: {
        type: 'text',
        analyzer: 'korean_analyzer',
      },
      tags: {
        type: 'keyword', // 정확한 매칭을 위해 keyword 타입
      },
      likes_count: { type: 'integer' },
      comments_count: { type: 'integer' },
      created_at: { type: 'date' },
      updated_at: { type: 'date' },
      // 관련도 점수 계산용
      popularity_score: {
        type: 'rank_feature',
      },
    },
  },
};

/**
 * 검색 로그 인덱스 매핑
 */
export const searchLogsIndexMapping = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
  },
  mappings: {
    properties: {
      user_id: { type: 'integer' },
      query: { type: 'text', analyzer: 'korean_analyzer' },
      filters: { type: 'object' },
      results_count: { type: 'integer' },
      timestamp: { type: 'date' },
      response_time_ms: { type: 'integer' },
    },
  },
};

/**
 * 인덱스 존재 확인
 */
export async function indexExists(indexName: string): Promise<boolean> {
  try {
    const result = await esClient.indices.exists({ index: indexName });
    return result;
  } catch (error) {
    console.error(`Error checking index existence: ${indexName}`, error);
    return false;
  }
}

/**
 * 인덱스 생성
 */
export async function createIndex(indexName: string, mapping: any): Promise<void> {
  try {
    const exists = await indexExists(indexName);

    if (!exists) {
      await esClient.indices.create({
        index: indexName,
        body: mapping,
      });
      console.log(`✓ Index created: ${indexName}`);
    } else {
      console.log(`✓ Index already exists: ${indexName}`);
    }
  } catch (error) {
    console.error(`Error creating index: ${indexName}`, error);
    throw error;
  }
}

/**
 * 인덱스 삭제
 */
export async function deleteIndex(indexName: string): Promise<void> {
  try {
    const exists = await indexExists(indexName);

    if (exists) {
      await esClient.indices.delete({ index: indexName });
      console.log(`✓ Index deleted: ${indexName}`);
    }
  } catch (error) {
    console.error(`Error deleting index: ${indexName}`, error);
    throw error;
  }
}

/**
 * 문서 인덱싱
 */
export async function indexDocument(
  indexName: string,
  id: string,
  document: any
): Promise<void> {
  try {
    await esClient.index({
      index: indexName,
      id,
      document,
      refresh: 'wait_for', // 즉시 검색 가능하도록 설정
    });
  } catch (error) {
    console.error(`Error indexing document: ${id}`, error);
    throw error;
  }
}

/**
 * 대량 인덱싱 (벌크 작업)
 */
export async function bulkIndex(indexName: string, documents: any[]): Promise<void> {
  if (documents.length === 0) return;

  try {
    const body = documents.flatMap((doc) => [
      { index: { _index: indexName, _id: doc.id.toString() } },
      doc,
    ]);

    const result = await esClient.bulk({ body, refresh: 'wait_for' });

    if (result.errors) {
      const erroredDocuments = result.items.filter(
        (item: any) => item.index?.error
      );
      console.error('Bulk indexing errors:', erroredDocuments);
    } else {
      console.log(`✓ Bulk indexed ${documents.length} documents`);
    }
  } catch (error) {
    console.error('Error in bulk indexing:', error);
    throw error;
  }
}

/**
 * 문서 삭제
 */
export async function deleteDocument(indexName: string, id: string): Promise<void> {
  try {
    await esClient.delete({
      index: indexName,
      id,
    });
  } catch (error) {
    console.error(`Error deleting document: ${id}`, error);
    throw error;
  }
}

/**
 * 문서 업데이트
 */
export async function updateDocument(
  indexName: string,
  id: string,
  document: any
): Promise<void> {
  try {
    await esClient.update({
      index: indexName,
      id,
      doc: document,
      refresh: 'wait_for',
    });
  } catch (error) {
    console.error(`Error updating document: ${id}`, error);
    throw error;
  }
}

/**
 * Elasticsearch 연결 테스트
 */
export async function testConnection(): Promise<boolean> {
  try {
    const health = await esClient.cluster.health();
    console.log('✓ Elasticsearch cluster status:', health.status);
    return true;
  } catch (error) {
    console.error('✗ Elasticsearch connection failed:', error);
    return false;
  }
}

export default esClient;
