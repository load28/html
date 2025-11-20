# 매크로 & 코드 생성 가이드

## 개요

매크로와 코드 생성은 반복적인 보일러플레이트를 줄이고 타입 안전성을 유지하는 강력한 도구입니다.
엔터프라이즈 코드에서는 derive 매크로와 선언적 매크로를 적극 활용합니다.

## 원칙

1. **타입 안전성 유지**: 매크로로 생성된 코드도 타입 체크
2. **명시적 에러**: 컴파일 타임에 명확한 에러 메시지
3. **문서화**: 매크로 사용법을 명확히 문서화
4. **최소 사용**: 매크로는 꼭 필요할 때만

## 1. Derive 매크로 활용

### 기본 Derive

```rust
// ✅ 필요한 trait만 derive
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct User {
    pub id: String,
    pub name: String,
    pub email: String,
}

// ✅ Hash는 Eq가 있을 때만
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserId(String);

// ✅ 순서 비교가 필요할 때
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Priority(u8);

// ✅ Default로 기본값 제공
#[derive(Debug, Clone, Default)]
pub struct Config {
    pub host: String,
    pub port: u16,
}
```

### Serde Derive

```rust
use serde::{Deserialize, Serialize};

// ✅ 직렬화/역직렬화
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse {
    pub status: String,
    pub data: Option<String>,
}

// ✅ 필드명 변경
#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    #[serde(rename = "userId")]
    pub user_id: String,

    #[serde(rename = "fullName")]
    pub full_name: String,
}

// ✅ 기본값 제공
#[derive(Debug, Deserialize)]
pub struct Config {
    pub host: String,

    #[serde(default = "default_port")]
    pub port: u16,

    #[serde(default)]
    pub timeout: u64,
}

fn default_port() -> u16 {
    8080
}

// ✅ Skip 필드
#[derive(Debug, Serialize, Deserialize)]
pub struct Session {
    pub user_id: String,
    pub created_at: i64,

    #[serde(skip)]
    pub internal_data: Vec<u8>,
}

// ✅ Enum 태깅
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Message {
    Text { content: String },
    Image { url: String, width: u32, height: u32 },
    Video { url: String, duration: u32 },
}
```

### thiserror Derive

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ServiceError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {field} = {value}")]
    InvalidInput { field: String, value: String },

    #[error("Database error")]
    Database(#[from] DatabaseError),

    #[error("IO error")]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

#[derive(Debug, Error)]
#[error("Database connection failed: {reason}")]
pub struct DatabaseError {
    pub reason: String,
}
```

### Custom Derive (Procedural Macro)

```rust
// 사용 예시 (매크로는 별도 크레이트로 정의)

// ✅ Builder 패턴 자동 생성
#[derive(Builder)]
pub struct User {
    name: String,
    email: String,
    #[builder(default)]
    age: Option<u32>,
}

// 생성된 코드 사용
fn use_builder() {
    let user = UserBuilder::default()
        .name("John".to_string())
        .email("john@example.com".to_string())
        .age(Some(30))
        .build()
        .unwrap();
}

// ✅ Validator 자동 생성
#[derive(Validate)]
pub struct RegisterForm {
    #[validate(email)]
    pub email: String,

    #[validate(length(min = 8))]
    pub password: String,

    #[validate(range(min = 18, max = 120))]
    pub age: u32,
}
```

## 2. 선언적 매크로 (macro_rules!)

### 기본 패턴

```rust
// ✅ 간단한 래퍼 매크로
macro_rules! log_error {
    ($($arg:tt)*) => {
        eprintln!("[ERROR] {}", format!($($arg)*))
    };
}

// 사용
fn use_log() {
    log_error!("Failed to connect: {}", "timeout");
}

// ✅ 여러 패턴 지원
macro_rules! create_function {
    // 인자 없음
    ($name:ident) => {
        fn $name() {
            println!("Called {}", stringify!($name));
        }
    };

    // 인자 있음
    ($name:ident, $arg:ty) => {
        fn $name(x: $arg) {
            println!("Called {} with {:?}", stringify!($name), x);
        }
    };
}

// 사용
create_function!(hello);
create_function!(greet, String);
```

### 타입 안전한 DSL

```rust
// ✅ SQL 쿼리 빌더
macro_rules! select {
    ($table:ident where $field:ident = $value:expr) => {
        format!(
            "SELECT * FROM {} WHERE {} = '{}'",
            stringify!($table),
            stringify!($field),
            $value
        )
    };

    ($table:ident) => {
        format!("SELECT * FROM {}", stringify!($table))
    };
}

fn use_select() {
    let query1 = select!(users);
    let query2 = select!(users where id = "123");

    println!("{}", query1);
    println!("{}", query2);
}

// ✅ JSON 빌더
macro_rules! json {
    ({ $($key:tt : $value:tt),* $(,)? }) => {
        {
            let mut map = std::collections::HashMap::new();
            $(
                map.insert(
                    String::from(stringify!($key)),
                    json!($value)
                );
            )*
            serde_json::Value::Object(
                map.into_iter()
                    .map(|(k, v)| (k, v))
                    .collect()
            )
        }
    };

    ([ $($value:tt),* $(,)? ]) => {
        serde_json::Value::Array(vec![
            $(json!($value)),*
        ])
    };

    ($value:expr) => {
        serde_json::json!($value)
    };
}
```

### HashMap/HashSet 초기화

```rust
// ✅ 간편한 컬렉션 생성
macro_rules! hashmap {
    ($($key:expr => $value:expr),* $(,)?) => {
        {
            let mut map = std::collections::HashMap::new();
            $(
                map.insert($key, $value);
            )*
            map
        }
    };
}

macro_rules! hashset {
    ($($value:expr),* $(,)?) => {
        {
            let mut set = std::collections::HashSet::new();
            $(
                set.insert($value);
            )*
            set
        }
    };
}

// 사용
fn use_collections() {
    let map = hashmap! {
        "name" => "John",
        "email" => "john@example.com",
    };

    let set = hashset! {
        1, 2, 3, 4, 5
    };
}
```

## 3. 프로시저럴 매크로 패턴

### Function-like 매크로

```rust
// 정의 (별도 크레이트)
use proc_macro::TokenStream;

#[proc_macro]
pub fn make_answer(_item: TokenStream) -> TokenStream {
    "fn answer() -> u32 { 42 }".parse().unwrap()
}

// 사용
make_answer!();

fn main() {
    println!("The answer is: {}", answer());
}
```

### Attribute 매크로

```rust
// 정의 (별도 크레이트)
#[proc_macro_attribute]
pub fn log_calls(_attr: TokenStream, item: TokenStream) -> TokenStream {
    // 함수 호출 시 로그 추가
    item
}

// 사용
#[log_calls]
fn important_function(x: i32) -> i32 {
    x * 2
}
```

### Derive 매크로

```rust
// 정의 (별도 크레이트)
#[proc_macro_derive(Builder, attributes(builder))]
pub fn derive_builder(input: TokenStream) -> TokenStream {
    // Builder 패턴 코드 생성
    input
}

// 사용
#[derive(Builder)]
struct User {
    name: String,
    #[builder(default)]
    age: Option<u32>,
}
```

## 4. 컴파일 타임 검증

### static_assertions

```rust
use static_assertions::*;

// ✅ 컴파일 타임 크기 검증
assert_eq_size!(u64, [u8; 8]);
assert_eq_size!(Option<&str>, &str);

// ✅ trait 구현 확인
assert_impl_all!(String: Clone, Send, Sync);
assert_not_impl_any!(User: Copy);

// ✅ 상수 검증
const MAX_SIZE: usize = 100;
const_assert!(MAX_SIZE < 1000);
const_assert!(MAX_SIZE > 0);

pub struct Buffer {
    data: [u8; MAX_SIZE],
}

// ✅ 타입 속성 검증
assert_eq_align!(u64, u64);
```

### compile_error!

```rust
// ✅ 조건부 컴파일 에러
#[cfg(all(feature = "async", feature = "sync"))]
compile_error!("Cannot enable both 'async' and 'sync' features");

// ✅ 매크로 내부 검증
macro_rules! validate_size {
    ($size:expr) => {
        if $size > 1024 {
            compile_error!("Size must be <= 1024");
        }
    };
}

// ❌ 컴파일 에러
// validate_size!(2048);
```

### cfg 조건부 컴파일

```rust
// ✅ OS별 코드
#[cfg(target_os = "linux")]
fn platform_specific() {
    println!("Running on Linux");
}

#[cfg(target_os = "windows")]
fn platform_specific() {
    println!("Running on Windows");
}

// ✅ 피처 플래그
#[cfg(feature = "advanced")]
pub mod advanced {
    pub fn advanced_feature() {
        println!("Advanced feature enabled");
    }
}

// ✅ 테스트 전용 코드
#[cfg(test)]
mod tests {
    #[test]
    fn test_something() {
        assert_eq!(2 + 2, 4);
    }
}

// ✅ 디버그/릴리스 구분
#[cfg(debug_assertions)]
fn debug_only() {
    println!("Debug mode");
}

#[cfg(not(debug_assertions))]
fn debug_only() {
    // 릴리스에서는 아무것도 안 함
}
```

## 5. 코드 생성 도구

### build.rs

```rust
// build.rs - 빌드 시점 코드 생성
use std::env;
use std::fs::File;
use std::io::Write;
use std::path::Path;

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();
    let dest_path = Path::new(&out_dir).join("generated.rs");
    let mut f = File::create(&dest_path).unwrap();

    // 코드 생성
    writeln!(
        f,
        r#"
        pub const BUILD_TIME: &str = "{}";
        pub const VERSION: &str = "{}";
        "#,
        chrono::Utc::now().to_rfc3339(),
        env!("CARGO_PKG_VERSION")
    )
    .unwrap();

    println!("cargo:rerun-if-changed=build.rs");
}

// main.rs에서 사용
include!(concat!(env!("OUT_DIR"), "/generated.rs"));

fn main() {
    println!("Built at: {}", BUILD_TIME);
    println!("Version: {}", VERSION);
}
```

### include_str! / include_bytes!

```rust
// ✅ 파일 내용을 컴파일 타임에 포함
pub const SQL_SCHEMA: &str = include_str!("schema.sql");
pub const DEFAULT_CONFIG: &str = include_str!("config.toml");
pub const LOGO_PNG: &[u8] = include_bytes!("logo.png");

fn use_included() {
    println!("Schema:\n{}", SQL_SCHEMA);
}
```

### concat! / stringify!

```rust
// ✅ 문자열 결합
const API_URL: &str = concat!(
    "https://",
    env!("API_HOST"),
    "/api/v1"
);

// ✅ 식을 문자열로
macro_rules! assert_with_message {
    ($condition:expr) => {
        if !$condition {
            panic!(
                "Assertion failed: {}",
                stringify!($condition)
            );
        }
    };
}
```

## 6. 실전 패턴

### 열거형 문자열 변환

```rust
macro_rules! enum_str {
    (
        $(#[$meta:meta])*
        $vis:vis enum $name:ident {
            $($(#[$variant_meta:meta])* $variant:ident),* $(,)?
        }
    ) => {
        $(#[$meta])*
        $vis enum $name {
            $($(#[$variant_meta])* $variant),*
        }

        impl $name {
            pub fn as_str(&self) -> &'static str {
                match self {
                    $(Self::$variant => stringify!($variant)),*
                }
            }

            pub fn from_str(s: &str) -> Option<Self> {
                match s {
                    $(stringify!($variant) => Some(Self::$variant),)*
                    _ => None,
                }
            }
        }
    };
}

// 사용
enum_str! {
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub enum Status {
        Active,
        Inactive,
        Pending,
    }
}

fn use_enum_str() {
    let status = Status::Active;
    println!("Status: {}", status.as_str());

    let parsed = Status::from_str("Pending");
    assert_eq!(parsed, Some(Status::Pending));
}
```

### 테스트 헬퍼

```rust
#[cfg(test)]
macro_rules! assert_ok {
    ($result:expr) => {
        match $result {
            Ok(val) => val,
            Err(e) => panic!("Expected Ok, got Err: {:?}", e),
        }
    };
}

#[cfg(test)]
macro_rules! assert_err {
    ($result:expr) => {
        match $result {
            Ok(val) => panic!("Expected Err, got Ok: {:?}", val),
            Err(e) => e,
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_with_macros() {
        let result: Result<i32, String> = Ok(42);
        let value = assert_ok!(result);
        assert_eq!(value, 42);

        let error_result: Result<i32, String> = Err("error".to_string());
        let error = assert_err!(error_result);
        assert_eq!(error, "error");
    }
}
```

### lazy_static / once_cell

```rust
use once_cell::sync::Lazy;
use std::collections::HashMap;

// ✅ 전역 상태 초기화
static GLOBAL_CONFIG: Lazy<HashMap<String, String>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert("api_key".to_string(), "secret".to_string());
    map.insert("endpoint".to_string(), "https://api.example.com".to_string());
    map
});

fn use_global() {
    println!("API Key: {}", GLOBAL_CONFIG.get("api_key").unwrap());
}

// ✅ Regex 패턴 캐싱
static EMAIL_REGEX: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap()
});

fn is_valid_email(email: &str) -> bool {
    EMAIL_REGEX.is_match(email)
}
```

## 체크리스트

매크로 & 코드 생성 체크리스트:

- [ ] derive 매크로를 최대한 활용
- [ ] 반복적인 보일러플레이트만 매크로화
- [ ] 매크로 사용법을 문서화
- [ ] 컴파일 에러 메시지가 명확한가
- [ ] static_assertions로 컴파일 타임 검증
- [ ] cfg로 조건부 컴파일 활용
- [ ] build.rs는 꼭 필요할 때만
- [ ] 매크로 확장 결과를 cargo expand로 확인

## 도구

```bash
# 매크로 확장 결과 확인
cargo install cargo-expand
cargo expand

# 매크로 디버깅
cargo rustc -- -Z trace-macros

# 프로시저럴 매크로 개발
cargo new my-macro --lib
# Cargo.toml에 [lib] proc-macro = true 추가
```

## 참고 자료

- [The Little Book of Rust Macros](https://danielkeep.github.io/tlborm/book/)
- [Procedural Macros Workshop](https://github.com/dtolnay/proc-macro-workshop)
- [cargo-expand](https://github.com/dtolnay/cargo-expand)
- [static_assertions](https://docs.rs/static_assertions/)
