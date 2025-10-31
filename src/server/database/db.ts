import { Pool, PoolConfig } from 'pg';

// 데이터베이스 연결 풀 설정 (성능 최적화)
const poolConfig: PoolConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'friend_posts_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),

  // 성능 최적화 설정
  max: 20, // 최대 연결 수
  idleTimeoutMillis: 30000, // 유휴 연결 타임아웃
  connectionTimeoutMillis: 2000, // 연결 타임아웃
};

// 연결 풀 생성
const pool = new Pool(poolConfig);

// 연결 에러 핸들링
pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// 데이터베이스 쿼리 함수 (파라미터화된 쿼리로 SQL Injection 방지)
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // 느린 쿼리 로깅 (성능 모니터링)
    if (duration > 1000) {
      console.warn('Slow query detected:', {
        text,
        duration: `${duration}ms`,
        rows: res.rowCount,
      });
    }

    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// 트랜잭션 지원
export const getClient = async () => {
  const client = await pool.connect();

  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // 타임아웃 설정
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    return release();
  };

  return client;
};

export default pool;
