import {
  testConnection,
  createIndex,
  deleteIndex,
  bulkIndex,
  POSTS_INDEX,
  SEARCH_LOGS_INDEX,
  postsIndexMapping,
  searchLogsIndexMapping,
} from '../services/elasticsearchClient';
import { query } from '../database/db';

/**
 * Elasticsearch 초기 설정 스크립트
 *
 * 실행 방법: yarn es:setup
 */

interface Post {
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
  updated_at: string;
}

/**
 * Elasticsearch 연결 확인
 */
async function checkConnection(): Promise<boolean> {
  console.log('🔍 Checking Elasticsearch connection...');
  const isConnected = await testConnection();

  if (!isConnected) {
    console.error(
      '✗ Cannot connect to Elasticsearch. Make sure it is running.'
    );
    console.log('\nTo start Elasticsearch:');
    console.log('  Docker: docker run -p 9200:9200 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:8.10.0');
    console.log('  Or install locally from: https://www.elastic.co/downloads/elasticsearch');
    return false;
  }

  return true;
}

/**
 * 인덱스 생성
 */
async function setupIndices(recreate: boolean = false): Promise<void> {
  console.log('\n📋 Setting up indices...');

  if (recreate) {
    console.log('⚠️  Recreating indices (existing data will be deleted)...');
    await deleteIndex(POSTS_INDEX);
    await deleteIndex(SEARCH_LOGS_INDEX);
  }

  await createIndex(POSTS_INDEX, postsIndexMapping);
  await createIndex(SEARCH_LOGS_INDEX, searchLogsIndexMapping);

  console.log('✓ Indices setup complete');
}

/**
 * PostgreSQL에서 Elasticsearch로 데이터 동기화
 */
async function syncDataFromPostgres(): Promise<void> {
  console.log('\n🔄 Syncing data from PostgreSQL to Elasticsearch...');

  try {
    // PostgreSQL에서 모든 게시물 조회
    const result = await query(`
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
        p.updated_at
      FROM posts p
      INNER JOIN users u ON p.user_id = u.id
      ORDER BY p.id
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  No posts found in PostgreSQL database');
      return;
    }

    // Elasticsearch 문서 형식으로 변환
    const documents: Post[] = result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      user_name: row.user_name,
      user_avatar: row.user_avatar || '',
      title: row.title || '',
      content: row.content,
      tags: row.tags || [],
      likes_count: row.likes_count,
      comments_count: row.comments_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    // 벌크 인덱싱 (배치 처리)
    const batchSize = 100;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await bulkIndex(POSTS_INDEX, batch);
      console.log(`  Indexed ${Math.min(i + batchSize, documents.length)}/${documents.length} posts`);
    }

    console.log(`✓ Successfully synced ${documents.length} posts from PostgreSQL`);
  } catch (error) {
    console.error('✗ Failed to sync data:', error);
    throw error;
  }
}

/**
 * 인덱스 통계 확인
 */
async function showIndexStats(): Promise<void> {
  console.log('\n📊 Index Statistics:');

  try {
    const esClient = (await import('../services/elasticsearchClient')).default;

    const postsStats = await esClient.count({ index: POSTS_INDEX });
    console.log(`  ${POSTS_INDEX}: ${postsStats.count} documents`);

    const logsStats = await esClient.count({ index: SEARCH_LOGS_INDEX });
    console.log(`  ${SEARCH_LOGS_INDEX}: ${logsStats.count} documents`);

    const health = await esClient.cluster.health();
    console.log(`\n  Cluster health: ${health.status}`);
    console.log(`  Number of nodes: ${health.number_of_nodes}`);
    console.log(`  Active shards: ${health.active_shards}`);
  } catch (error) {
    console.error('✗ Failed to get stats:', error);
  }
}

/**
 * 테스트 검색 실행
 */
async function runTestSearch(): Promise<void> {
  console.log('\n🔍 Running test searches...');

  try {
    const { searchPostsWithElasticsearch } = await import(
      '../services/elasticsearchSearchService'
    );

    // 테스트 1: 전체 검색
    console.log('\n  Test 1: Searching all posts...');
    const result1 = await searchPostsWithElasticsearch({ userId: 1 });
    console.log(`  ✓ Found ${result1.total} posts in ${result1.searchTime}ms`);

    // 테스트 2: 키워드 검색
    console.log('\n  Test 2: Searching for "TypeScript"...');
    const result2 = await searchPostsWithElasticsearch({
      userId: 1,
      query: 'TypeScript',
    });
    console.log(`  ✓ Found ${result2.total} posts in ${result2.searchTime}ms`);
    if (result2.posts.length > 0) {
      console.log(`  ✓ Top result: "${result2.posts[0].title}"`);
      console.log(`  ✓ Relevance score: ${result2.posts[0]._score?.toFixed(2)}`);
    }

    // 테스트 3: 퍼지 검색 (오타 허용)
    console.log('\n  Test 3: Fuzzy search for "typscript" (typo)...');
    const result3 = await searchPostsWithElasticsearch({
      userId: 1,
      query: 'typscript',
      fuzzy: true,
    });
    console.log(`  ✓ Found ${result3.total} posts in ${result3.searchTime}ms`);

    // 테스트 4: 태그 검색
    console.log('\n  Test 4: Searching posts with tag "programming"...');
    const result4 = await searchPostsWithElasticsearch({
      userId: 1,
      tags: ['programming'],
    });
    console.log(`  ✓ Found ${result4.total} posts in ${result4.searchTime}ms`);
  } catch (error) {
    console.error('✗ Test search failed:', error);
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   Elasticsearch Setup for Friend Posts       ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  try {
    // 1. 연결 확인
    const connected = await checkConnection();
    if (!connected) {
      process.exit(1);
    }

    // 2. 커맨드 라인 인자 확인
    const args = process.argv.slice(2);
    const recreate = args.includes('--recreate');
    const skipSync = args.includes('--skip-sync');
    const skipTest = args.includes('--skip-test');

    // 3. 인덱스 설정
    await setupIndices(recreate);

    // 4. 데이터 동기화
    if (!skipSync) {
      await syncDataFromPostgres();
    } else {
      console.log('\n⚠️  Skipping data sync (--skip-sync flag)');
    }

    // 5. 통계 확인
    await showIndexStats();

    // 6. 테스트 검색
    if (!skipTest) {
      await runTestSearch();
    } else {
      console.log('\n⚠️  Skipping test searches (--skip-test flag)');
    }

    console.log('\n✓ Setup complete!');
    console.log('\nYou can now start the server with: yarn dev:server');
    console.log('\nUsage flags:');
    console.log('  --recreate: Delete and recreate indices');
    console.log('  --skip-sync: Skip PostgreSQL data sync');
    console.log('  --skip-test: Skip test searches');

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Setup failed:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main();
