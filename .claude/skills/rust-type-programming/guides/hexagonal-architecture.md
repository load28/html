# 헥사고날 아키텍처 (Hexagonal Architecture)

## 개요

헥사고날 아키텍처(Ports and Adapters)는 비즈니스 로직을 외부 의존성으로부터 분리하는 아키텍처 패턴입니다.
러스트의 타입 시스템과 트레이트를 활용하여 엄격하고 타입 안전한 헥사고날 아키텍처를 구현합니다.

## 핵심 원칙

1. **도메인 중심**: 비즈니스 로직이 핵심
2. **의존성 역전**: 외부가 내부에 의존 (내부는 외부를 모름)
3. **Port (인터페이스)**: 트레이트로 정의
4. **Adapter (구현체)**: 트레이트 구현
5. **테스트 용이성**: Mock 구현 쉬움

## 계층 구조

```
┌─────────────────────────────────────────┐
│           Adapters (외부)                │
│  ┌────────────────────────────────────┐ │
│  │      Ports (인터페이스/트레이트)    │ │
│  │  ┌──────────────────────────────┐  │ │
│  │  │    Domain (비즈니스 로직)     │  │ │
│  │  │      - Entities              │  │ │
│  │  │      - Value Objects         │  │ │
│  │  │      - Use Cases             │  │ │
│  │  └──────────────────────────────┘  │ │
│  │     Trait Definitions              │ │
│  └────────────────────────────────────┘ │
│  Struct Implementations                 │
└─────────────────────────────────────────┘
```

## 1. 디렉토리 구조

```
src/
├── domain/              # 도메인 계층 (핵심 비즈니스 로직)
│   ├── mod.rs
│   ├── entities/        # 엔티티
│   │   ├── mod.rs
│   │   ├── user.rs
│   │   └── order.rs
│   ├── value_objects/   # 값 객체
│   │   ├── mod.rs
│   │   ├── email.rs
│   │   └── money.rs
│   └── services/        # 도메인 서비스
│       ├── mod.rs
│       └── order_service.rs
├── application/         # 애플리케이션 계층 (유스케이스)
│   ├── mod.rs
│   ├── ports/           # Ports (인터페이스)
│   │   ├── mod.rs
│   │   ├── input/       # 인바운드 포트
│   │   │   ├── mod.rs
│   │   │   └── create_user_usecase.rs
│   │   └── output/      # 아웃바운드 포트
│   │       ├── mod.rs
│   │       ├── user_repository.rs
│   │       └── email_service.rs
│   └── usecases/        # 유스케이스 구현
│       ├── mod.rs
│       └── create_user.rs
└── adapters/            # Adapters (구현체)
    ├── mod.rs
    ├── input/           # 인바운드 어댑터
    │   ├── mod.rs
    │   ├── http/        # HTTP API
    │   │   ├── mod.rs
    │   │   └── user_controller.rs
    │   └── cli/         # CLI
    │       ├── mod.rs
    │       └── commands.rs
    └── output/          # 아웃바운드 어댑터
        ├── mod.rs
        ├── persistence/ # 영속성
        │   ├── mod.rs
        │   ├── postgres_user_repository.rs
        │   └── redis_cache_repository.rs
        └── messaging/   # 메시징
            ├── mod.rs
            └── smtp_email_service.rs
```

## 2. Domain 계층

### Entities (엔티티)

```rust
// domain/entities/user.rs
use crate::domain::value_objects::{Email, UserId};

/// 사용자 엔티티
/// 비즈니스 로직의 핵심 객체
#[derive(Debug, Clone, PartialEq)]
pub struct User {
    id: UserId,
    email: Email,
    name: String,
    is_active: bool,
}

impl User {
    pub fn new(id: UserId, email: Email, name: String) -> Self {
        Self {
            id,
            email,
            name,
            is_active: true,
        }
    }

    pub fn id(&self) -> &UserId {
        &self.id
    }

    pub fn email(&self) -> &Email {
        &self.email
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn is_active(&self) -> bool {
        self.is_active
    }

    /// 비즈니스 규칙: 사용자 비활성화
    pub fn deactivate(&mut self) -> Result<(), DomainError> {
        if !self.is_active {
            return Err(DomainError::UserAlreadyInactive);
        }
        self.is_active = false;
        Ok(())
    }

    /// 비즈니스 규칙: 이름 변경
    pub fn change_name(&mut self, new_name: String) -> Result<(), DomainError> {
        if new_name.trim().is_empty() {
            return Err(DomainError::InvalidName);
        }
        self.name = new_name;
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum DomainError {
    #[error("User is already inactive")]
    UserAlreadyInactive,

    #[error("Invalid name")]
    InvalidName,
}
```

### Value Objects (값 객체)

```rust
// domain/value_objects/email.rs
use std::fmt;

/// 이메일 값 객체
/// 항상 유효한 상태를 보장
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Email(String);

#[derive(Debug, thiserror::Error)]
pub enum EmailError {
    #[error("Invalid email format: {0}")]
    InvalidFormat(String),
}

impl Email {
    pub fn new(email: impl Into<String>) -> Result<Self, EmailError> {
        let email = email.into();

        // 간단한 검증 (실제로는 더 복잡한 검증 필요)
        if !email.contains('@') || !email.contains('.') {
            return Err(EmailError::InvalidFormat(email));
        }

        Ok(Self(email))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for Email {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

// domain/value_objects/user_id.rs
use std::fmt;

/// 사용자 ID 값 객체
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserId(String);

impl UserId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for UserId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}
```

## 3. Application 계층 - Ports

### Input Ports (인바운드 포트)

```rust
// application/ports/input/create_user_usecase.rs
use crate::domain::{entities::User, value_objects::Email};
use async_trait::async_trait;

/// 사용자 생성 유스케이스 포트
/// 외부에서 호출할 수 있는 인터페이스
#[async_trait]
pub trait CreateUserUseCase {
    type Error;

    async fn create_user(
        &self,
        email: Email,
        name: String,
    ) -> Result<User, Self::Error>;
}

/// 사용자 조회 유스케이스 포트
#[async_trait]
pub trait GetUserUseCase {
    type Error;

    async fn get_user_by_email(&self, email: &Email) -> Result<Option<User>, Self::Error>;
}
```

### Output Ports (아웃바운드 포트)

```rust
// application/ports/output/user_repository.rs
use crate::domain::{entities::User, value_objects::{Email, UserId}};
use async_trait::async_trait;

/// 사용자 저장소 포트
/// 도메인이 필요로 하는 영속성 인터페이스
#[async_trait]
pub trait UserRepository: Send + Sync {
    type Error: std::error::Error + Send + Sync;

    async fn save(&self, user: &User) -> Result<(), Self::Error>;
    async fn find_by_id(&self, id: &UserId) -> Result<Option<User>, Self::Error>;
    async fn find_by_email(&self, email: &Email) -> Result<Option<User>, Self::Error>;
    async fn delete(&self, id: &UserId) -> Result<(), Self::Error>;
}

// application/ports/output/email_service.rs
use crate::domain::value_objects::Email;
use async_trait::async_trait;

/// 이메일 발송 포트
#[async_trait]
pub trait EmailService: Send + Sync {
    type Error: std::error::Error + Send + Sync;

    async fn send_welcome_email(&self, to: &Email, name: &str) -> Result<(), Self::Error>;
}
```

## 4. Application 계층 - Use Cases

```rust
// application/usecases/create_user.rs
use crate::{
    application::ports::{
        input::CreateUserUseCase,
        output::{EmailService, UserRepository},
    },
    domain::{entities::User, value_objects::{Email, UserId}},
};
use async_trait::async_trait;
use std::sync::Arc;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CreateUserError {
    #[error("User already exists: {0}")]
    UserAlreadyExists(String),

    #[error("Repository error: {0}")]
    Repository(String),

    #[error("Email service error: {0}")]
    EmailService(String),
}

/// 사용자 생성 유스케이스 구현
/// 도메인 로직과 외부 서비스를 조율
pub struct CreateUserUseCaseImpl<R, E>
where
    R: UserRepository,
    E: EmailService,
{
    user_repository: Arc<R>,
    email_service: Arc<E>,
}

impl<R, E> CreateUserUseCaseImpl<R, E>
where
    R: UserRepository,
    E: EmailService,
{
    pub fn new(user_repository: Arc<R>, email_service: Arc<E>) -> Self {
        Self {
            user_repository,
            email_service,
        }
    }
}

#[async_trait]
impl<R, E> CreateUserUseCase for CreateUserUseCaseImpl<R, E>
where
    R: UserRepository + 'static,
    E: EmailService + 'static,
{
    type Error = CreateUserError;

    async fn create_user(&self, email: Email, name: String) -> Result<User, Self::Error> {
        // 1. 이미 존재하는 사용자인지 확인
        if let Some(_) = self
            .user_repository
            .find_by_email(&email)
            .await
            .map_err(|e| CreateUserError::Repository(e.to_string()))?
        {
            return Err(CreateUserError::UserAlreadyExists(email.to_string()));
        }

        // 2. 새 사용자 생성 (도메인 로직)
        let user_id = UserId::new(uuid::Uuid::new_v4().to_string());
        let user = User::new(user_id, email.clone(), name.clone());

        // 3. 저장
        self.user_repository
            .save(&user)
            .await
            .map_err(|e| CreateUserError::Repository(e.to_string()))?;

        // 4. 환영 이메일 발송
        self.email_service
            .send_welcome_email(&email, &name)
            .await
            .map_err(|e| CreateUserError::EmailService(e.to_string()))?;

        Ok(user)
    }
}
```

## 5. Adapters 계층 - Output

### Persistence Adapter

```rust
// adapters/output/persistence/postgres_user_repository.rs
use crate::{
    application::ports::output::UserRepository,
    domain::{entities::User, value_objects::{Email, UserId}},
};
use async_trait::async_trait;
use sqlx::PgPool;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PostgresError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("User not found")]
    NotFound,
}

/// PostgreSQL 저장소 어댑터
pub struct PostgresUserRepository {
    pool: PgPool,
}

impl PostgresUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for PostgresUserRepository {
    type Error = PostgresError;

    async fn save(&self, user: &User) -> Result<(), Self::Error> {
        sqlx::query!(
            r#"
            INSERT INTO users (id, email, name, is_active)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE
            SET email = $2, name = $3, is_active = $4
            "#,
            user.id().as_str(),
            user.email().as_str(),
            user.name(),
            user.is_active()
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn find_by_id(&self, id: &UserId) -> Result<Option<User>, Self::Error> {
        let row = sqlx::query!(
            r#"
            SELECT id, email, name, is_active
            FROM users
            WHERE id = $1
            "#,
            id.as_str()
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| {
            User::new(
                UserId::new(r.id),
                Email::new(r.email).unwrap(),
                r.name,
            )
        }))
    }

    async fn find_by_email(&self, email: &Email) -> Result<Option<User>, Self::Error> {
        let row = sqlx::query!(
            r#"
            SELECT id, email, name, is_active
            FROM users
            WHERE email = $1
            "#,
            email.as_str()
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| {
            User::new(
                UserId::new(r.id),
                Email::new(r.email).unwrap(),
                r.name,
            )
        }))
    }

    async fn delete(&self, id: &UserId) -> Result<(), Self::Error> {
        sqlx::query!(
            r#"
            DELETE FROM users WHERE id = $1
            "#,
            id.as_str()
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

// In-Memory 저장소 (테스트용)
use std::collections::HashMap;
use std::sync::RwLock;

pub struct InMemoryUserRepository {
    users: RwLock<HashMap<UserId, User>>,
}

impl InMemoryUserRepository {
    pub fn new() -> Self {
        Self {
            users: RwLock::new(HashMap::new()),
        }
    }
}

#[async_trait]
impl UserRepository for InMemoryUserRepository {
    type Error = PostgresError;

    async fn save(&self, user: &User) -> Result<(), Self::Error> {
        let mut users = self.users.write().unwrap();
        users.insert(user.id().clone(), user.clone());
        Ok(())
    }

    async fn find_by_id(&self, id: &UserId) -> Result<Option<User>, Self::Error> {
        let users = self.users.read().unwrap();
        Ok(users.get(id).cloned())
    }

    async fn find_by_email(&self, email: &Email) -> Result<Option<User>, Self::Error> {
        let users = self.users.read().unwrap();
        Ok(users.values().find(|u| u.email() == email).cloned())
    }

    async fn delete(&self, id: &UserId) -> Result<(), Self::Error> {
        let mut users = self.users.write().unwrap();
        users.remove(id);
        Ok(())
    }
}
```

### Email Service Adapter

```rust
// adapters/output/messaging/smtp_email_service.rs
use crate::{application::ports::output::EmailService, domain::value_objects::Email};
use async_trait::async_trait;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SmtpError {
    #[error("SMTP error: {0}")]
    Smtp(String),
}

/// SMTP 이메일 서비스 어댑터
pub struct SmtpEmailService {
    smtp_host: String,
    smtp_port: u16,
}

impl SmtpEmailService {
    pub fn new(smtp_host: String, smtp_port: u16) -> Self {
        Self {
            smtp_host,
            smtp_port,
        }
    }
}

#[async_trait]
impl EmailService for SmtpEmailService {
    type Error = SmtpError;

    async fn send_welcome_email(&self, to: &Email, name: &str) -> Result<(), Self::Error> {
        // 실제 SMTP 전송 로직
        println!(
            "Sending welcome email to {} ({}) via {}:{}",
            name,
            to.as_str(),
            self.smtp_host,
            self.smtp_port
        );
        Ok(())
    }
}

// Mock 이메일 서비스 (테스트용)
pub struct MockEmailService;

#[async_trait]
impl EmailService for MockEmailService {
    type Error = SmtpError;

    async fn send_welcome_email(&self, to: &Email, name: &str) -> Result<(), Self::Error> {
        println!("Mock: Sending email to {} ({})", name, to.as_str());
        Ok(())
    }
}
```

## 6. Adapters 계층 - Input

### HTTP Adapter

```rust
// adapters/input/http/user_controller.rs
use crate::{
    application::ports::input::CreateUserUseCase,
    domain::value_objects::Email,
};
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub email: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct CreateUserResponse {
    pub id: String,
    pub email: String,
    pub name: String,
}

/// HTTP 컨트롤러
/// 유스케이스 포트를 호출하는 어댑터
pub async fn create_user_handler<U>(
    State(usecase): State<Arc<U>>,
    Json(request): Json<CreateUserRequest>,
) -> Result<Json<CreateUserResponse>, AppError>
where
    U: CreateUserUseCase,
{
    // 1. DTO를 도메인 객체로 변환
    let email = Email::new(request.email)
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    // 2. 유스케이스 실행
    let user = usecase
        .create_user(email, request.name)
        .await
        .map_err(|_| AppError::InternalError)?;

    // 3. 도메인 객체를 DTO로 변환
    Ok(Json(CreateUserResponse {
        id: user.id().to_string(),
        email: user.email().to_string(),
        name: user.name().to_string(),
    }))
}

#[derive(Debug)]
pub enum AppError {
    BadRequest(String),
    InternalError,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::InternalError => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal error".to_string(),
            ),
        };

        (status, message).into_response()
    }
}
```

## 7. 의존성 주입 및 조립

```rust
// main.rs 또는 composition_root.rs
use std::sync::Arc;
use axum::{routing::post, Router};

pub struct AppContainer<R, E>
where
    R: UserRepository + 'static,
    E: EmailService + 'static,
{
    pub create_user_usecase: Arc<CreateUserUseCaseImpl<R, E>>,
}

impl<R, E> AppContainer<R, E>
where
    R: UserRepository + 'static,
    E: EmailService + 'static,
{
    pub fn new(repository: Arc<R>, email_service: Arc<E>) -> Self {
        let create_user_usecase = Arc::new(CreateUserUseCaseImpl::new(
            repository,
            email_service,
        ));

        Self {
            create_user_usecase,
        }
    }
}

#[tokio::main]
async fn main() {
    // 어댑터 생성
    let repository = Arc::new(InMemoryUserRepository::new());
    let email_service = Arc::new(MockEmailService);

    // 컨테이너 조립
    let container = AppContainer::new(repository, email_service);

    // HTTP 라우터 설정
    let app = Router::new()
        .route(
            "/users",
            post(create_user_handler::<CreateUserUseCaseImpl<_, _>>),
        )
        .with_state(container.create_user_usecase);

    // 서버 실행
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .unwrap();

    axum::serve(listener, app).await.unwrap();
}
```

## 8. 테스트

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_user_success() {
        // Given: Mock 어댑터 사용
        let repository = Arc::new(InMemoryUserRepository::new());
        let email_service = Arc::new(MockEmailService);
        let usecase = CreateUserUseCaseImpl::new(repository, email_service);

        let email = Email::new("test@example.com").unwrap();
        let name = "Test User".to_string();

        // When: 사용자 생성
        let result = usecase.create_user(email.clone(), name.clone()).await;

        // Then: 성공
        assert!(result.is_ok());
        let user = result.unwrap();
        assert_eq!(user.email(), &email);
        assert_eq!(user.name(), "Test User");
    }

    #[tokio::test]
    async fn test_create_user_already_exists() {
        // Given: 이미 존재하는 사용자
        let repository = Arc::new(InMemoryUserRepository::new());
        let email_service = Arc::new(MockEmailService);
        let usecase = CreateUserUseCaseImpl::new(repository.clone(), email_service);

        let email = Email::new("test@example.com").unwrap();

        // 먼저 사용자 생성
        usecase
            .create_user(email.clone(), "Test".to_string())
            .await
            .unwrap();

        // When: 같은 이메일로 다시 생성 시도
        let result = usecase.create_user(email, "Test2".to_string()).await;

        // Then: 에러
        assert!(result.is_err());
    }
}
```

## 9. 장점

### 타입 안전성
```rust
// ✅ 컴파일 타임에 의존성 검증
impl<R, E> CreateUserUseCaseImpl<R, E>
where
    R: UserRepository,  // 반드시 UserRepository 구현체
    E: EmailService,    // 반드시 EmailService 구현체
{
    // ...
}

// ❌ 잘못된 타입 전달 시 컴파일 에러
// let usecase = CreateUserUseCaseImpl::new(wrong_type, wrong_type);
```

### 테스트 용이성
```rust
// 테스트에서는 Mock 사용
let repo = Arc::new(InMemoryUserRepository::new());
let email = Arc::new(MockEmailService);

// 프로덕션에서는 실제 구현 사용
let repo = Arc::new(PostgresUserRepository::new(pool));
let email = Arc::new(SmtpEmailService::new(host, port));
```

### 교체 가능성
```rust
// PostgreSQL에서 MongoDB로 교체
// UserRepository 트레이트만 구현하면 됨
pub struct MongoUserRepository { /* ... */ }

impl UserRepository for MongoUserRepository {
    // 구현
}

// 유스케이스 코드는 변경 없음!
```

## 체크리스트

헥사고날 아키텍처 체크리스트:

- [ ] 도메인은 외부 의존성이 없음 (순수 러스트)
- [ ] Ports는 트레이트로 정의
- [ ] Adapters는 트레이트 구현
- [ ] 의존성 방향: 외부 → 내부
- [ ] 도메인 로직은 엔티티와 값 객체에
- [ ] 유스케이스는 포트만 의존
- [ ] 어댑터는 교체 가능
- [ ] 각 계층별 에러 타입 분리
- [ ] 테스트용 Mock 어댑터 제공

## 참고 자료

- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Clean Architecture in Rust](https://www.lpalmieri.com/)
- [Ports and Adapters Pattern](https://herbertograca.com/2017/09/14/ports-adapters-architecture/)
