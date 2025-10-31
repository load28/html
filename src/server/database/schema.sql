-- 친구 게시물 검색 기능을 위한 데이터베이스 스키마
-- 성능 최적화: 인덱스, Full-Text Search, 파티셔닝 고려

-- Users 테이블
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_url VARCHAR(500),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 이메일 검색 성능 향상을 위한 인덱스
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_name ON users(name);

-- Posts 테이블
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    title VARCHAR(255),
    tags TEXT[], -- 태그 배열
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 성능 최적화를 위한 인덱스들
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC); -- 최신 게시물 정렬용
CREATE INDEX idx_posts_tags ON posts USING GIN(tags); -- 태그 검색용

-- Full-Text Search 인덱스 (PostgreSQL의 tsvector 사용)
ALTER TABLE posts ADD COLUMN search_vector tsvector;
CREATE INDEX idx_posts_search ON posts USING GIN(search_vector);

-- 검색 벡터 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION posts_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_search_update
    BEFORE INSERT OR UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION posts_search_trigger();

-- Friendships 테이블 (친구 관계)
CREATE TABLE IF NOT EXISTS friendships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'accepted', -- pending, accepted, blocked
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id)
);

-- 친구 관계 조회 성능 향상을 위한 인덱스
CREATE INDEX idx_friendships_user_id ON friendships(user_id) WHERE status = 'accepted';
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id) WHERE status = 'accepted';
CREATE INDEX idx_friendships_composite ON friendships(user_id, friend_id, status);

-- 샘플 데이터 삽입
INSERT INTO users (name, email, avatar_url, bio) VALUES
    ('Minyeoung Seo', 'minyeoung@example.com', '/pic.jpg', 'Developer & Designer'),
    ('John Doe', 'john@example.com', '/avatar1.jpg', 'Software Engineer'),
    ('Jane Smith', 'jane@example.com', '/avatar2.jpg', 'Product Manager'),
    ('Alice Kim', 'alice@example.com', '/avatar3.jpg', 'UX Designer'),
    ('Bob Lee', 'bob@example.com', '/avatar4.jpg', 'Data Scientist')
ON CONFLICT (email) DO NOTHING;

-- 친구 관계 생성 (Minyeoung Seo가 다른 사용자들과 친구)
INSERT INTO friendships (user_id, friend_id, status) VALUES
    (1, 2, 'accepted'),
    (1, 3, 'accepted'),
    (1, 4, 'accepted'),
    (2, 1, 'accepted'),
    (3, 1, 'accepted'),
    (4, 1, 'accepted')
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- 샘플 게시물 생성
INSERT INTO posts (user_id, title, content, tags) VALUES
    (2, 'Introduction to TypeScript', 'TypeScript is a great language for building scalable applications. Here are some tips...', ARRAY['typescript', 'programming', 'javascript']),
    (2, 'Best Practices in Node.js', 'When building Node.js applications, consider these performance tips...', ARRAY['nodejs', 'backend', 'performance']),
    (3, 'Product Management 101', 'Effective product management requires understanding user needs...', ARRAY['product', 'management', 'business']),
    (3, 'Agile Development Tips', 'Working in an agile environment can be challenging but rewarding...', ARRAY['agile', 'development', 'teamwork']),
    (4, 'UI/UX Design Principles', 'Good design is invisible. Here are key principles to follow...', ARRAY['design', 'ux', 'ui']),
    (4, 'Color Theory for Designers', 'Understanding color theory can elevate your designs...', ARRAY['design', 'color', 'theory']),
    (2, 'Docker Best Practices', 'Containerization is essential for modern development. Here is how to use Docker effectively...', ARRAY['docker', 'devops', 'containers'])
ON CONFLICT DO NOTHING;

-- 성능 모니터링을 위한 뷰
CREATE OR REPLACE VIEW friend_posts_search_stats AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as total_posts,
    COUNT(DISTINCT user_id) as active_users
FROM posts
GROUP BY DATE(created_at)
ORDER BY date DESC;
