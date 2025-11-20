# 에러 핸들링 패턴

## 개요

엔터프라이즈 애플리케이션에서 에러 핸들링은 타입 시스템의 핵심입니다.
모든 에러는 타입으로 표현되고, 명시적으로 처리되어야 합니다.

## 원칙

1. **Never panic in library code**: 라이브러리는 panic하지 않고 Result를 반환
2. **타입화된 에러**: String 대신 구조화된 에러 타입
3. **컨텍스트 보존**: 에러 체인을 통해 원인 추적
4. **복구 가능성 구분**: 복구 가능/불가능 에러를 타입으로 구분

## 1. 커스텀 에러 타입 설계

### thiserror 사용

```rust
use thiserror::Error;

/// 사용자 서비스의 모든 에러
#[derive(Debug, Error)]
pub enum UserServiceError {
    #[error("User not found: {user_id}")]
    NotFound { user_id: String },

    #[error("User already exists: {email}")]
    AlreadyExists { email: String },

    #[error("Invalid email format: {email}")]
    InvalidEmail { email: String },

    #[error("Database error: {0}")]
    Database(#[from] DatabaseError),

    #[error("Validation error: {0}")]
    Validation(#[from] ValidationError),

    #[error("Permission denied: {action} requires {required_role}")]
    PermissionDenied {
        action: String,
        required_role: String,
    },
}

#[derive(Debug, Error)]
pub enum DatabaseError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Query failed: {0}")]
    QueryFailed(String),

    #[error("Transaction failed: {0}")]
    TransactionFailed(String),
}

#[derive(Debug, Error)]
pub enum ValidationError {
    #[error("Field '{field}' is required")]
    Required { field: String },

    #[error("Field '{field}' is too long: {length} > {max}")]
    TooLong {
        field: String,
        length: usize,
        max: usize,
    },

    #[error("Field '{field}' is too short: {length} < {min}")]
    TooShort {
        field: String,
        length: usize,
        min: usize,
    },
}
```

### 에러 계층 구조

```rust
use thiserror::Error;

/// 애플리케이션 레벨 에러
#[derive(Debug, Error)]
pub enum AppError {
    #[error("User service error")]
    UserService(#[from] UserServiceError),

    #[error("Payment service error")]
    PaymentService(#[from] PaymentServiceError),

    #[error("Authentication error")]
    Auth(#[from] AuthError),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

/// 도메인별 에러를 명시적으로 분리
#[derive(Debug, Error)]
pub enum PaymentServiceError {
    #[error("Insufficient funds: required {required}, available {available}")]
    InsufficientFunds { required: u64, available: u64 },

    #[error("Payment gateway error: {0}")]
    Gateway(String),

    #[error("Invalid payment method")]
    InvalidMethod,
}

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("Token expired")]
    TokenExpired,

    #[error("Token invalid: {0}")]
    TokenInvalid(String),

    #[error("Unauthorized")]
    Unauthorized,
}
```

## 2. Result 타입 체이닝

### 기본 패턴

```rust
use std::fs::File;
use std::io::{self, Read};

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Failed to read config file: {0}")]
    Io(#[from] io::Error),

    #[error("Failed to parse config: {0}")]
    Parse(#[from] serde_json::Error),

    #[error("Invalid config: {0}")]
    Invalid(String),
}

#[derive(Debug, serde::Deserialize)]
pub struct Config {
    pub port: u16,
    pub host: String,
    pub database_url: String,
}

impl Config {
    pub fn from_file(path: &str) -> Result<Self, ConfigError> {
        let mut file = File::open(path)?; // io::Error -> ConfigError
        let mut contents = String::new();
        file.read_to_string(&mut contents)?; // io::Error -> ConfigError

        let config: Config = serde_json::from_str(&contents)?; // serde_json::Error -> ConfigError

        // 추가 검증
        if config.port == 0 {
            return Err(ConfigError::Invalid("Port cannot be 0".to_string()));
        }

        Ok(config)
    }
}
```

### map_err로 에러 변환

```rust
use std::num::ParseIntError;

#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    #[error("Invalid format: {0}")]
    InvalidFormat(String),

    #[error("Number parse error: {0}")]
    NumberParse(#[from] ParseIntError),
}

fn parse_id(s: &str) -> Result<u64, ParseError> {
    if s.is_empty() {
        return Err(ParseError::InvalidFormat("ID cannot be empty".to_string()));
    }

    s.parse::<u64>()
        .map_err(|e| ParseError::NumberParse(e))
}

// 또는 더 간단하게 From trait 활용
fn parse_id_simple(s: &str) -> Result<u64, ParseError> {
    if s.is_empty() {
        return Err(ParseError::InvalidFormat("ID cannot be empty".to_string()));
    }

    Ok(s.parse::<u64>()?) // From<ParseIntError> 자동 변환
}
```

## 3. 컨텍스트 전파

### anyhow 사용 (애플리케이션 레벨)

```rust
use anyhow::{Context, Result};

/// 라이브러리 코드는 구체적 에러 타입 사용
pub fn read_user_from_db(id: &str) -> Result<User, UserServiceError> {
    // ...
}

/// 애플리케이션 코드는 anyhow::Result 사용
pub fn process_user_request(id: &str) -> anyhow::Result<String> {
    let user = read_user_from_db(id)
        .context("Failed to read user from database")?;

    let profile = user.get_profile()
        .context(format!("Failed to get profile for user {}", id))?;

    Ok(profile.to_json())
}
```

### 명시적 컨텍스트 타입

```rust
use thiserror::Error;

#[derive(Debug, Error)]
#[error("Operation '{operation}' failed at {location}: {source}")]
pub struct ContextError {
    operation: String,
    location: String,
    #[source]
    source: Box<dyn std::error::Error + Send + Sync>,
}

impl ContextError {
    pub fn new(
        operation: impl Into<String>,
        location: impl Into<String>,
        source: impl std::error::Error + Send + Sync + 'static,
    ) -> Self {
        Self {
            operation: operation.into(),
            location: location.into(),
            source: Box::new(source),
        }
    }
}

// 사용 예시
fn save_user(user: &User) -> Result<(), ContextError> {
    database::insert(user).map_err(|e| {
        ContextError::new("save_user", "user_service.rs:123", e)
    })?;

    Ok(())
}
```

## 4. 복구 가능성 구분

### Recoverable vs Fatal

```rust
#[derive(Debug, thiserror::Error)]
pub enum ServiceError {
    /// 복구 가능한 에러들
    #[error("Temporary error: {0}")]
    Temporary(String),

    #[error("Retry exhausted: {0}")]
    RetryExhausted(String),

    /// 복구 불가능한 에러들
    #[error("Fatal error: {0}")]
    Fatal(String),

    #[error("Configuration error: {0}")]
    Configuration(String),
}

impl ServiceError {
    /// 재시도 가능한 에러인지 확인
    pub fn is_retryable(&self) -> bool {
        matches!(self, ServiceError::Temporary(_))
    }

    /// 치명적 에러인지 확인
    pub fn is_fatal(&self) -> bool {
        matches!(
            self,
            ServiceError::Fatal(_) | ServiceError::Configuration(_)
        )
    }
}

// 재시도 로직
pub async fn with_retry<F, T, E>(
    mut f: F,
    max_retries: usize,
) -> Result<T, ServiceError>
where
    F: FnMut() -> Result<T, ServiceError>,
{
    let mut attempts = 0;

    loop {
        match f() {
            Ok(result) => return Ok(result),
            Err(e) if e.is_fatal() => return Err(e),
            Err(e) if attempts >= max_retries => {
                return Err(ServiceError::RetryExhausted(format!(
                    "Failed after {} attempts: {}",
                    max_retries, e
                )));
            }
            Err(ServiceError::Temporary(_)) => {
                attempts += 1;
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
            Err(e) => return Err(e),
        }
    }
}
```

## 5. 에러 타입 별칭

```rust
// 도메인별 Result 타입 별칭
pub type UserResult<T> = Result<T, UserServiceError>;
pub type PaymentResult<T> = Result<T, PaymentServiceError>;
pub type AuthResult<T> = Result<T, AuthError>;

// 사용 예시
pub fn create_user(email: &str, password: &str) -> UserResult<User> {
    // UserServiceError를 반복해서 쓸 필요 없음
    validate_email(email)?;
    validate_password(password)?;

    let user = User::new(email, password);
    save_to_db(&user)?;

    Ok(user)
}
```

## 6. Option vs Result

### Option 사용 경우

```rust
// ✅ 값이 없는 것이 정상적인 경우
pub fn find_user_by_email(email: &str) -> Option<User> {
    // 사용자가 없을 수 있음 (에러 아님)
}

// ✅ 캐시 조회
pub fn get_from_cache(key: &str) -> Option<String> {
    // 캐시 미스는 정상 상황
}
```

### Result 사용 경우

```rust
// ✅ 실패 원인이 중요한 경우
pub fn load_config(path: &str) -> Result<Config, ConfigError> {
    // 파일이 없는지, 파싱 실패인지 등 원인이 중요
}

// ✅ 검증 실패
pub fn validate_email(email: &str) -> Result<(), ValidationError> {
    // 왜 실패했는지 알아야 함
}
```

### Option to Result 변환

```rust
pub fn get_user_or_error(id: &str) -> Result<User, UserServiceError> {
    find_user(id).ok_or_else(|| UserServiceError::NotFound {
        user_id: id.to_string(),
    })
}
```

## 7. 에러 핸들링 패턴

### Early Return 패턴

```rust
pub fn process_payment(
    user_id: &str,
    amount: u64,
) -> Result<Receipt, PaymentServiceError> {
    // 조기 리턴으로 에러 처리
    let user = get_user(user_id)?;
    let account = user.account()?;

    if account.balance() < amount {
        return Err(PaymentServiceError::InsufficientFunds {
            required: amount,
            available: account.balance(),
        });
    }

    let transaction = account.deduct(amount)?;
    let receipt = generate_receipt(&transaction)?;

    Ok(receipt)
}
```

### Match 패턴

```rust
pub fn handle_user_creation(email: &str) -> Result<User, AppError> {
    match create_user(email) {
        Ok(user) => {
            log::info!("User created: {}", email);
            Ok(user)
        }
        Err(UserServiceError::AlreadyExists { email }) => {
            log::warn!("User already exists: {}", email);
            // 이미 존재하는 사용자 반환
            get_user_by_email(&email).map_err(AppError::from)
        }
        Err(e) => {
            log::error!("Failed to create user: {}", e);
            Err(AppError::from(e))
        }
    }
}
```

### and_then 체이닝

```rust
pub fn get_user_profile(user_id: &str) -> UserResult<Profile> {
    get_user(user_id)
        .and_then(|user| user.verify())
        .and_then(|user| user.load_profile())
        .and_then(|profile| profile.enrich())
}
```

## 8. 에러 로깅

```rust
use tracing::{error, warn, info};

pub fn process_with_logging(id: &str) -> Result<(), AppError> {
    info!("Processing item: {}", id);

    match process_item(id) {
        Ok(()) => {
            info!("Successfully processed item: {}", id);
            Ok(())
        }
        Err(e) if e.is_retryable() => {
            warn!("Retryable error for item {}: {}", id, e);
            Err(e)
        }
        Err(e) => {
            error!("Fatal error for item {}: {:#}", id, e);
            // {:#} 는 에러 체인 전체를 출력
            Err(e)
        }
    }
}
```

## 9. 테스트용 에러

```rust
#[cfg(test)]
impl UserServiceError {
    /// 테스트용 헬퍼 메서드
    pub fn is_not_found(&self) -> bool {
        matches!(self, UserServiceError::NotFound { .. })
    }

    pub fn is_already_exists(&self) -> bool {
        matches!(self, UserServiceError::AlreadyExists { .. })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_not_found() {
        let result = get_user("nonexistent");
        assert!(result.is_err());

        let error = result.unwrap_err();
        assert!(error.is_not_found());
    }
}
```

## 10. Never Type과 Infallible

```rust
use std::convert::Infallible;

// 절대 실패하지 않는 함수
pub fn always_succeeds() -> Result<String, Infallible> {
    Ok("Success".to_string())
}

// 사용 시
fn use_infallible() {
    let result = always_succeeds();
    // unwrap이 안전함 (절대 실패하지 않으므로)
    let value = result.unwrap();
}

// 타입 시스템으로 성공을 보장
pub fn process_infallible<E>(
    result: Result<String, Infallible>,
) -> Result<String, E> {
    match result {
        Ok(s) => Ok(s),
        // Err 케이스는 실제로 발생할 수 없음
        Err(never) => match never {},
    }
}
```

## 체크리스트

에러 핸들링 체크리스트:

- [ ] unwrap(), expect() 사용 금지 (테스트 제외)
- [ ] panic!() 사용 금지 (라이브러리 코드)
- [ ] String 에러 대신 구조화된 에러 타입
- [ ] 모든 에러에 충분한 컨텍스트 정보
- [ ] 에러 타입에 #[derive(Debug, Error)] 적용
- [ ] 복구 가능한 에러와 치명적 에러 구분
- [ ] 에러 체인 보존 (#[from], #[source])
- [ ] 도메인별 에러 타입 분리
- [ ] 에러 처리 로직에 로깅 추가
- [ ] 공개 API의 에러 타입 문서화

## 참고 자료

- [thiserror](https://docs.rs/thiserror/)
- [anyhow](https://docs.rs/anyhow/)
- [Error Handling in Rust](https://blog.burntsushi.net/rust-error-handling/)
- [Rust Book - Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)
