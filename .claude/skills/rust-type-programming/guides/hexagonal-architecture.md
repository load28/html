# Hexagonal Architecture in Rust (헥사고날 아키텍처 - Rust)

Rust로 구현하는 헥사고날 아키텍처(Ports and Adapters 패턴) 가이드입니다.

## 핵심 원칙

- **도메인 중심 설계**: 비즈니스 로직이 프레임워크와 인프라에 독립적
- **의존성 역전**: 도메인이 외부에 의존하지 않고, 외부가 도메인에 의존
- **포트와 어댑터**: 트레이트를 통한 명확한 경계 정의
- **타입 안전성**: Rust의 타입 시스템으로 컴파일 타임 보장
- **테스트 용이성**: 각 레이어를 독립적으로 테스트 가능

## 아키텍처 구조

```
src/
├── domain/              # 핵심 비즈니스 로직 (Pure Rust)
│   ├── entities/        # 도메인 엔티티
│   ├── value_objects/   # 값 객체 (Newtype 패턴)
│   └── services/        # 도메인 서비스
│
├── application/         # 유스케이스 오케스트레이션
│   ├── ports/           # 트레이트 정의
│   │   ├── input/       # Input Ports (Use Cases)
│   │   └── output/      # Output Ports (Repository, External APIs)
│   └── services/        # 애플리케이션 서비스
│
└── infrastructure/      # 외부 세계와의 연결
    ├── adapters/        # Adapters 구현
    │   ├── input/       # HTTP, CLI, gRPC Handlers
    │   └── output/      # Repository 구현, API Clients
    ├── config/          # 설정 및 DI
    └── persistence/     # DB, Cache 등
```

## 레이어별 책임

### 1. Domain Layer (도메인 레이어)

**순수 비즈니스 로직, 외부 의존성 없음**

```rust
// domain/value_objects/email.rs
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Email(String);

#[derive(Debug, thiserror::Error)]
pub enum EmailError {
    #[error("Invalid email format: {0}")]
    InvalidFormat(String),
}

impl Email {
    pub fn new(value: impl Into<String>) -> Result<Self, EmailError> {
        let email = value.into();

        if !Self::is_valid(&email) {
            return Err(EmailError::InvalidFormat(email));
        }

        Ok(Self(email))
    }

    fn is_valid(email: &str) -> bool {
        email.contains('@') && email.contains('.')
    }

    pub fn value(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for Email {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

// domain/value_objects/user_id.rs
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct UserId(Uuid);

impl UserId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    pub fn from_uuid(id: Uuid) -> Self {
        Self(id)
    }

    pub fn value(&self) -> Uuid {
        self.0
    }
}

impl Default for UserId {
    fn default() -> Self {
        Self::new()
    }
}

// domain/entities/user.rs
use chrono::{DateTime, Utc};
use super::value_objects::{Email, UserId};

#[derive(Debug, Clone)]
pub struct User {
    id: UserId,
    email: Email,
    created_at: DateTime<Utc>,
}

#[derive(Debug, thiserror::Error)]
pub enum UserError {
    #[error("Email is same as current")]
    SameEmail,
    #[error("Invalid email: {0}")]
    InvalidEmail(#[from] EmailError),
}

impl User {
    pub fn new(id: UserId, email: Email) -> Self {
        Self {
            id,
            email,
            created_at: Utc::now(),
        }
    }

    pub fn change_email(&mut self, new_email: Email) -> Result<(), UserError> {
        if self.email == new_email {
            return Err(UserError::SameEmail);
        }

        self.email = new_email;
        Ok(())
    }

    pub fn id(&self) -> UserId {
        self.id
    }

    pub fn email(&self) -> &Email {
        &self.email
    }

    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }
}
```

**규칙:**
- ❌ 외부 크레이트(web framework, DB 등) 의존 금지
- ❌ I/O 작업(파일, 네트워크, DB) 직접 접근 금지
- ✅ 순수 비즈니스 규칙만 포함
- ✅ Newtype 패턴으로 타입 안전성 보장
- ✅ `thiserror`는 허용 (에러 타입 정의용)

### 2. Application Layer (애플리케이션 레이어)

**유스케이스 오케스트레이션, 포트(트레이트) 정의**

```rust
// application/ports/input/register_user.rs
use async_trait::async_trait;
use crate::domain::entities::User;

pub struct RegisterUserCommand {
    pub email: String,
}

#[derive(Debug, thiserror::Error)]
pub enum RegisterUserError {
    #[error("User already exists")]
    UserAlreadyExists,
    #[error("Invalid email: {0}")]
    InvalidEmail(String),
    #[error("Repository error: {0}")]
    Repository(#[from] RepositoryError),
    #[error("Email service error: {0}")]
    EmailService(String),
}

#[async_trait]
pub trait RegisterUserUseCase: Send + Sync {
    async fn execute(&self, command: RegisterUserCommand)
        -> Result<User, RegisterUserError>;
}

// application/ports/output/user_repository.rs
use async_trait::async_trait;
use crate::domain::{entities::User, value_objects::{Email, UserId}};

#[derive(Debug, thiserror::Error)]
pub enum RepositoryError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("Connection error: {0}")]
    Connection(String),
    #[error("Not found")]
    NotFound,
}

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn save(&self, user: &User) -> Result<(), RepositoryError>;
    async fn find_by_email(&self, email: &Email)
        -> Result<Option<User>, RepositoryError>;
    async fn find_by_id(&self, id: UserId)
        -> Result<Option<User>, RepositoryError>;
}

// application/ports/output/email_service.rs
use async_trait::async_trait;
use crate::domain::entities::User;

#[derive(Debug, thiserror::Error)]
pub enum EmailError {
    #[error("Failed to send email: {0}")]
    SendFailed(String),
}

#[async_trait]
pub trait EmailService: Send + Sync {
    async fn send_welcome(&self, user: &User) -> Result<(), EmailError>;
}

// application/services/register_user_service.rs
use async_trait::async_trait;
use crate::{
    application::ports::{
        input::{RegisterUserCommand, RegisterUserError, RegisterUserUseCase},
        output::{EmailService, UserRepository},
    },
    domain::{
        entities::User,
        value_objects::{Email, UserId},
    },
};

pub struct RegisterUserService<R, E> {
    user_repository: R,
    email_service: E,
}

impl<R, E> RegisterUserService<R, E> {
    pub fn new(user_repository: R, email_service: E) -> Self {
        Self {
            user_repository,
            email_service,
        }
    }
}

#[async_trait]
impl<R, E> RegisterUserUseCase for RegisterUserService<R, E>
where
    R: UserRepository,
    E: EmailService,
{
    async fn execute(&self, command: RegisterUserCommand)
        -> Result<User, RegisterUserError>
    {
        // 1. 도메인 객체 생성 (값 객체 검증)
        let email = Email::new(command.email)
            .map_err(|e| RegisterUserError::InvalidEmail(e.to_string()))?;

        // 2. 비즈니스 규칙 검증
        if let Some(_existing) = self.user_repository
            .find_by_email(&email)
            .await?
        {
            return Err(RegisterUserError::UserAlreadyExists);
        }

        // 3. 도메인 엔티티 생성
        let user = User::new(UserId::new(), email);

        // 4. 영속화
        self.user_repository.save(&user).await?;

        // 5. 외부 서비스 호출
        self.email_service
            .send_welcome(&user)
            .await
            .map_err(|e| RegisterUserError::EmailService(e.to_string()))?;

        Ok(user)
    }
}
```

**규칙:**
- ✅ 트레이트로 포트(인터페이스) 정의
- ✅ 제네릭 타입 파라미터로 의존성 주입
- ✅ `async_trait` 사용 (비동기 트레이트)
- ✅ 유스케이스 단위로 서비스 분리
- ✅ 도메인 객체 오케스트레이션
- ❌ 구체적인 구현체(struct) 직접 의존 금지

### 3. Infrastructure Layer (인프라 레이어)

**어댑터 구현, 외부 시스템 연결**

```rust
// infrastructure/adapters/input/http/user_controller.rs
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::application::ports::input::{
    RegisterUserCommand, RegisterUserUseCase,
};

#[derive(Deserialize)]
pub struct RegisterUserRequest {
    email: String,
}

#[derive(Serialize)]
pub struct UserResponse {
    id: String,
    email: String,
    created_at: String,
}

pub async fn register_user<U>(
    State(use_case): State<Arc<U>>,
    Json(req): Json<RegisterUserRequest>,
) -> Response
where
    U: RegisterUserUseCase,
{
    let command = RegisterUserCommand { email: req.email };

    match use_case.execute(command).await {
        Ok(user) => {
            let response = UserResponse {
                id: user.id().value().to_string(),
                email: user.email().to_string(),
                created_at: user.created_at().to_rfc3339(),
            };
            (StatusCode::CREATED, Json(response)).into_response()
        }
        Err(e) => {
            let status = match e {
                RegisterUserError::UserAlreadyExists => StatusCode::CONFLICT,
                RegisterUserError::InvalidEmail(_) => StatusCode::BAD_REQUEST,
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            };
            (status, e.to_string()).into_response()
        }
    }
}

// infrastructure/adapters/output/postgres_user_repository.rs
use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    application::ports::output::{RepositoryError, UserRepository},
    domain::{
        entities::User,
        value_objects::{Email, UserId},
    },
};

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
    async fn save(&self, user: &User) -> Result<(), RepositoryError> {
        sqlx::query!(
            r#"
            INSERT INTO users (id, email, created_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (id) DO UPDATE
            SET email = EXCLUDED.email
            "#,
            user.id().value(),
            user.email().value(),
            user.created_at()
        )
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::Database(e.to_string()))?;

        Ok(())
    }

    async fn find_by_email(&self, email: &Email)
        -> Result<Option<User>, RepositoryError>
    {
        let row = sqlx::query!(
            r#"
            SELECT id, email, created_at
            FROM users
            WHERE email = $1
            "#,
            email.value()
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepositoryError::Database(e.to_string()))?;

        Ok(row.map(|r| {
            User::new(
                UserId::from_uuid(r.id),
                Email::new(r.email).expect("Invalid email in database"),
            )
        }))
    }

    async fn find_by_id(&self, id: UserId)
        -> Result<Option<User>, RepositoryError>
    {
        let row = sqlx::query!(
            r#"
            SELECT id, email, created_at
            FROM users
            WHERE id = $1
            "#,
            id.value()
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepositoryError::Database(e.to_string()))?;

        Ok(row.map(|r| {
            User::new(
                UserId::from_uuid(r.id),
                Email::new(r.email).expect("Invalid email in database"),
            )
        }))
    }
}

// infrastructure/adapters/output/smtp_email_service.rs
use async_trait::async_trait;
use lettre::{
    message::Message, AsyncSmtpTransport, AsyncTransport, Tokio1Executor,
};

use crate::{
    application::ports::output::{EmailError, EmailService},
    domain::entities::User,
};

pub struct SmtpEmailService {
    mailer: AsyncSmtpTransport<Tokio1Executor>,
}

impl SmtpEmailService {
    pub fn new(mailer: AsyncSmtpTransport<Tokio1Executor>) -> Self {
        Self { mailer }
    }
}

#[async_trait]
impl EmailService for SmtpEmailService {
    async fn send_welcome(&self, user: &User) -> Result<(), EmailError> {
        let email = Message::builder()
            .from("noreply@example.com".parse().unwrap())
            .to(user.email().value().parse().unwrap())
            .subject("Welcome!")
            .body(format!("Welcome, {}!", user.email()))
            .map_err(|e| EmailError::SendFailed(e.to_string()))?;

        self.mailer
            .send(email)
            .await
            .map_err(|e| EmailError::SendFailed(e.to_string()))?;

        Ok(())
    }
}

// infrastructure/config/app_state.rs
use std::sync::Arc;
use sqlx::PgPool;

use crate::{
    application::services::RegisterUserService,
    infrastructure::adapters::output::{
        PostgresUserRepository, SmtpEmailService,
    },
};

pub type RegisterUserUseCaseImpl = RegisterUserService<
    PostgresUserRepository,
    SmtpEmailService,
>;

pub struct AppState {
    pub register_user: Arc<RegisterUserUseCaseImpl>,
}

impl AppState {
    pub fn new(pool: PgPool, email_service: SmtpEmailService) -> Self {
        let user_repository = PostgresUserRepository::new(pool);
        let register_user = Arc::new(RegisterUserService::new(
            user_repository,
            email_service,
        ));

        Self { register_user }
    }
}
```

**규칙:**
- ✅ 트레이트를 구현하는 구조체(Adapters)
- ✅ 프레임워크, 외부 라이브러리 사용
- ✅ `Arc<T>`로 의존성 공유 (멀티스레드 환경)
- ✅ 에러를 애플리케이션 에러 타입으로 변환
- ❌ 도메인 로직 포함 금지

## 의존성 규칙

```
Infrastructure (Adapters)
       ↓ (depends on)
   Application (Ports & Use Cases)
       ↓ (depends on)
    Domain (Entities, Value Objects)
```

**절대 규칙:**
- Domain은 어떤 레이어에도 의존하지 않음
- Application은 Domain에만 의존
- Infrastructure는 Application과 Domain에 의존
- **Cargo.toml도 이 규칙을 따라야 함**

### Cargo 워크스페이스 구조 예시

```toml
# Cargo.toml (workspace root)
[workspace]
members = ["domain", "application", "infrastructure"]

# domain/Cargo.toml
[package]
name = "domain"

[dependencies]
thiserror = "1.0"
uuid = { version = "1.0", features = ["v4"] }
chrono = "0.4"

# application/Cargo.toml
[package]
name = "application"

[dependencies]
domain = { path = "../domain" }
async-trait = "0.1"
thiserror = "1.0"

# infrastructure/Cargo.toml
[package]
name = "infrastructure"

[dependencies]
domain = { path = "../domain" }
application = { path = "../application" }
axum = "0.7"
sqlx = { version = "0.7", features = ["postgres", "runtime-tokio"] }
lettre = "0.11"
tokio = { version = "1", features = ["full"] }
```

## 테스트 전략

### 1. Domain Layer 테스트

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_change_email_with_valid_email() {
        let mut user = User::new(
            UserId::new(),
            Email::new("old@email.com").unwrap(),
        );
        let new_email = Email::new("new@email.com").unwrap();

        let result = user.change_email(new_email.clone());

        assert!(result.is_ok());
        assert_eq!(user.email(), &new_email);
    }

    #[test]
    fn should_fail_when_changing_to_same_email() {
        let email = Email::new("test@email.com").unwrap();
        let mut user = User::new(UserId::new(), email.clone());

        let result = user.change_email(email);

        assert!(matches!(result, Err(UserError::SameEmail)));
    }

    #[test]
    fn should_reject_invalid_email() {
        let result = Email::new("invalid-email");

        assert!(result.is_err());
    }
}
```

### 2. Application Layer 테스트 (Mock 사용)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use mockall::mock;

    // Mock 정의
    mock! {
        UserRepo {}

        #[async_trait]
        impl UserRepository for UserRepo {
            async fn save(&self, user: &User) -> Result<(), RepositoryError>;
            async fn find_by_email(&self, email: &Email)
                -> Result<Option<User>, RepositoryError>;
            async fn find_by_id(&self, id: UserId)
                -> Result<Option<User>, RepositoryError>;
        }
    }

    mock! {
        EmailSvc {}

        #[async_trait]
        impl EmailService for EmailSvc {
            async fn send_welcome(&self, user: &User) -> Result<(), EmailError>;
        }
    }

    #[tokio::test]
    async fn should_register_new_user() {
        // Arrange
        let mut mock_repo = MockUserRepo::new();
        let mut mock_email = MockEmailSvc::new();

        mock_repo
            .expect_find_by_email()
            .returning(|_| Ok(None));

        mock_repo
            .expect_save()
            .returning(|_| Ok(()));

        mock_email
            .expect_send_welcome()
            .returning(|_| Ok(()));

        let service = RegisterUserService::new(mock_repo, mock_email);
        let command = RegisterUserCommand {
            email: "test@email.com".to_string(),
        };

        // Act
        let result = service.execute(command).await;

        // Assert
        assert!(result.is_ok());
        let user = result.unwrap();
        assert_eq!(user.email().value(), "test@email.com");
    }

    #[tokio::test]
    async fn should_fail_when_user_already_exists() {
        let mut mock_repo = MockUserRepo::new();
        let mock_email = MockEmailSvc::new();

        let existing_user = User::new(
            UserId::new(),
            Email::new("test@email.com").unwrap(),
        );

        mock_repo
            .expect_find_by_email()
            .returning(move |_| Ok(Some(existing_user.clone())));

        let service = RegisterUserService::new(mock_repo, mock_email);
        let command = RegisterUserCommand {
            email: "test@email.com".to_string(),
        };

        let result = service.execute(command).await;

        assert!(matches!(
            result,
            Err(RegisterUserError::UserAlreadyExists)
        ));
    }
}
```

### 3. Infrastructure Layer 테스트 (통합 테스트)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::PgPool;

    async fn create_test_pool() -> PgPool {
        PgPool::connect("postgres://localhost/test_db")
            .await
            .expect("Failed to connect to test database")
    }

    #[tokio::test]
    async fn should_save_and_retrieve_user() {
        // Arrange
        let pool = create_test_pool().await;
        let repo = PostgresUserRepository::new(pool);

        let user = User::new(
            UserId::new(),
            Email::new("test@email.com").unwrap(),
        );

        // Act
        repo.save(&user).await.unwrap();
        let retrieved = repo
            .find_by_email(user.email())
            .await
            .unwrap();

        // Assert
        assert!(retrieved.is_some());
        let retrieved_user = retrieved.unwrap();
        assert_eq!(retrieved_user.id(), user.id());
        assert_eq!(retrieved_user.email(), user.email());
    }
}
```

## Rust 특유의 헥사고날 패턴

### 1. 트레이트 객체 vs 제네릭

```rust
// 방법 1: 제네릭 (Static Dispatch - 더 빠름)
pub struct RegisterUserService<R, E> {
    user_repository: R,
    email_service: E,
}

// 방법 2: 트레이트 객체 (Dynamic Dispatch - 더 유연함)
pub struct RegisterUserService {
    user_repository: Arc<dyn UserRepository>,
    email_service: Arc<dyn EmailService>,
}

// 권장: 제네릭 사용 (성능 우선)
// 트레이트 객체는 런타임에 구현체를 바꿔야 할 때만 사용
```

### 2. Arc를 활용한 의존성 공유

```rust
use std::sync::Arc;

pub struct AppState {
    pub register_user: Arc<dyn RegisterUserUseCase>,
    pub get_user: Arc<dyn GetUserQuery>,
}

// 여러 핸들러에서 공유
let state = Arc::new(AppState::new(...));
```

### 3. Newtype 패턴으로 타입 안전성

```rust
// ✅ 타입 레벨에서 실수 방지
pub struct UserId(Uuid);
pub struct OrderId(Uuid);

fn process_user(user_id: UserId) { } // OrderId를 넘기면 컴파일 에러!
```

### 4. Result 타입으로 명시적 에러 처리

```rust
// ✅ 모든 에러를 타입으로 표현
pub enum RegisterUserError {
    #[error("User already exists")]
    UserAlreadyExists,
    #[error("Repository error: {0}")]
    Repository(#[from] RepositoryError),
}

// ? 연산자로 에러 전파
let email = Email::new(command.email)?;
```

## 체크리스트

새로운 기능 추가 시:

- [ ] Domain에 엔티티/값 객체 정의 (Newtype 패턴 사용)
- [ ] Domain 엔티티에 대한 단위 테스트 작성
- [ ] Application에 Input Port 트레이트 정의
- [ ] Application에 필요한 Output Port 트레이트 정의
- [ ] Application Service 구현 (제네릭 사용)
- [ ] Application Service 테스트 (Mock 사용)
- [ ] Infrastructure에 Input Adapter 구현 (HTTP/CLI)
- [ ] Infrastructure에 Output Adapter 구현 (Repository 등)
- [ ] 통합 테스트 작성
- [ ] Cargo.toml에서 의존성 방향 검증
- [ ] `async_trait` 사용 (비동기 트레이트)

## 금지 패턴

```rust
// ❌ Domain이 Infrastructure에 의존
use sqlx::PgPool;

pub struct User {
    pool: PgPool, // 금지!
}

// ❌ Application이 구체 타입에 의존
use crate::infrastructure::PostgresUserRepository;

pub struct RegisterUserService {
    repo: PostgresUserRepository, // 금지! 트레이트 사용
}

// ❌ Controller에 비즈니스 로직
pub async fn create_user(Json(dto): Json<CreateUserDto>) {
    if !dto.email.contains('@') { // 금지! Domain에서 검증
        return Err("Invalid email");
    }
}

// ❌ unwrap() 남용
let user = repository.find_by_id(id).await.unwrap(); // 금지!
```

## 허용 패턴

```rust
// ✅ Domain은 순수하게 유지
pub struct User {
    id: UserId,
    email: Email, // Value Object로 검증
}

impl User {
    pub fn change_email(&mut self, new_email: Email) -> Result<(), UserError> {
        // 순수 비즈니스 로직만
    }
}

// ✅ Application은 트레이트에 의존 (제네릭)
pub struct RegisterUserService<R: UserRepository> {
    repository: R,
}

// ✅ Controller는 Use Case만 호출
pub async fn create_user<U: RegisterUserUseCase>(
    State(use_case): State<Arc<U>>,
    Json(dto): Json<CreateUserDto>,
) -> Response {
    use_case.execute(dto.into()).await
}

// ✅ Result로 에러 처리
let user = repository
    .find_by_id(id)
    .await
    .map_err(|e| AppError::Repository(e))?;
```

## 실전 적용 팁

1. **Cargo 워크스페이스 활용**: domain, application, infrastructure를 별도 크레이트로 분리
2. **타입 먼저 설계**: 트레이트 정의 → 도메인 객체 → 구현체 순서
3. **async_trait 사용**: 비동기 트레이트 메서드에 필수
4. **제네릭 우선**: 트레이트 객체보다 제네릭이 성능상 유리
5. **Arc로 공유**: 멀티스레드 환경에서 유스케이스 공유
6. **thiserror 활용**: 각 레이어별 에러 타입 정의
7. **mockall로 테스트**: Application 레이어 테스트에 활용
8. **sqlx compile-time checked queries**: DB 쿼리를 컴파일 타임에 검증

## 추천 크레이트

```toml
# Domain Layer
thiserror = "1.0"      # 에러 타입 정의
uuid = "1.0"           # ID 생성
chrono = "0.4"         # 날짜/시간

# Application Layer
async-trait = "0.1"    # 비동기 트레이트
mockall = "0.12"       # 테스트용 Mock

# Infrastructure Layer
axum = "0.7"           # HTTP 프레임워크
sqlx = "0.7"           # 데이터베이스 (compile-time checked)
tokio = "1.0"          # 비동기 런타임
serde = "1.0"          # 직렬화
```

## 참고 자료

- [Hexagonal Architecture by Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)
- [Rust Async Book](https://rust-lang.github.io/async-book/)
- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
