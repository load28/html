import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import searchRoutes from './routes/searchRoutes';
import elasticsearchRoutes from './routes/elasticsearchRoutes';
import { testConnection } from './services/elasticsearchClient';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors()); // CORS 활성화
app.use(express.json()); // JSON 파싱
app.use(express.urlencoded({ extended: true })); // URL-encoded 파싱

// 요청 로깅 미들웨어
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Health check 엔드포인트
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 라우트
app.use('/api/search', searchRoutes);
app.use('/api/es/search', elasticsearchRoutes);

// 404 핸들러
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// 에러 핸들러
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 서버 시작
app.listen(PORT, async () => {
  console.log(`
🚀 Server is running!
   Port: ${PORT}
   Environment: ${process.env.NODE_ENV || 'development'}

📡 PostgreSQL API Endpoints:
   GET  /api/search/posts         - Full-text search with PostgreSQL
   GET  /api/search/tags          - Popular tags
   GET  /api/search/suggestions   - Search suggestions

⚡ Elasticsearch API Endpoints:
   GET  /api/es/search/posts       - Advanced search with Elasticsearch
   GET  /api/es/search/autocomplete - Auto-complete suggestions
   GET  /api/es/search/related     - Related queries
   GET  /api/es/search/trending    - Trending searches
   GET  /api/es/search/tags        - Popular tags (aggregations)
   GET  /api/es/search/similar/:id - Similar posts (More Like This)

🔧 Setup:
   Run 'yarn es:setup' to initialize Elasticsearch indices
  `);

  // Elasticsearch 연결 테스트 (선택적)
  console.log('🔍 Testing Elasticsearch connection...');
  const esConnected = await testConnection();
  if (esConnected) {
    console.log('✓ Elasticsearch is ready\n');
  } else {
    console.log('⚠️  Elasticsearch is not available (PostgreSQL search will be used)\n');
  }
});

export default app;
