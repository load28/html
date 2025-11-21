# 러스트 코딩 컨벤션

## 개요

엔터프라이즈급 러스트 코드를 위한 코딩 컨벤션과 베스트 프랙티스입니다.
일관성 있고 안전한 코드를 작성하기 위한 규칙들을 정의합니다.

## 1. 타입 선언 규칙

### 명시적 타입 선언

모든 공개 함수와 구조체 필드에는 명시적 타입을 선언합니다.

```rust
// ❌ BAD: 타입 추론에 의존
pub fn process(data) -> _ {
    data.parse().unwrap()
}

// ✅ GOOD: 명시적 타입 선언
pub fn process(data: &str) -> Result<UserId, ParseError> {
    data.parse()
        .map_err(ParseError::from)
}
```

### 프리미티브 타입 사용 금지

도메인 개념은 항상 Newtype으로 래핑합니다.

```rust
// ❌ BAD: 프리미티브 타입 직접 사용
fn transfer(from: String, to: String, amount: f64) -> bool

// ✅ GOOD: Newtype 사용
fn transfer(from: AccountId, to: AccountId, amount: Money) -> Result<Receipt, TransferError>
```

## 2. 에러 처리 규칙

### unwrap 사용 금지

프로덕션 코드에서 `unwrap()`, `expect()` 사용을 피합니다.

```rust
// ❌ BAD: unwrap 사용
let value = result.unwrap();
let data = option.expect("should have value");

// ✅ GOOD: 명시적 에러 처리
let value = result.map_err(|e| ProcessError::from(e))?;
let data = option.ok_or(ProcessError::MissingData)?;
```

### 타입화된 에러

모든 에러는 명시적 타입으로 정의합니다.

```rust
// ❌ BAD: 문자열 에러
fn process() -> Result<Data, String>

// ✅ GOOD: 타입화된 에러
#[derive(Debug, thiserror::Error)]
pub enum ProcessError {
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("Database error: {0}")]
    Database(#[from] DbError),
}

fn process() -> Result<Data, ProcessError>
```

## 3. 불변성 규칙

### 기본은 불변

모든 변수는 기본적으로 불변으로 선언합니다.

```rust
// ❌ BAD: 불필요한 가변성
let mut data = fetch_data();
process(data);

// ✅ GOOD: 불변 변수
let data = fetch_data();
process(data);
```

### 가변 참조 최소화

가변 참조는 꼭 필요한 경우에만 사용합니다.

```rust
// ❌ BAD: 불필요한 가변 참조
fn update(data: &mut Data) {
    let new_data = data.clone();
    // data를 변경하지 않음
}

// ✅ GOOD: 소유권 이동 또는 불변 참조
fn update(data: Data) -> Data {
    // 새로운 값 반환
}
```

## 4. 문서화 규칙

### 공개 API 문서화

모든 공개 함수, 타입, 모듈에 문서 주석을 작성합니다.

```rust
/// 사용자 프로필을 조회합니다.
///
/// # Arguments
/// * `user_id` - 조회할 사용자의 ID
///
/// # Returns
/// 사용자 프로필 또는 에러
///
/// # Errors
/// - `UserError::NotFound` - 사용자를 찾을 수 없음
/// - `UserError::Database` - 데이터베이스 에러
///
/// # Examples
/// ```
/// let profile = get_user_profile(UserId(123))?;
/// ```
pub fn get_user_profile(user_id: UserId) -> Result<UserProfile, UserError> {
    // ...
}
```

### panic 가능성 문서화

panic이 발생할 수 있는 함수는 반드시 문서화합니다.

```rust
/// 배열의 첫 번째 요소를 반환합니다.
///
/// # Panics
/// 배열이 비어있으면 panic합니다.
pub fn first_element<T>(arr: &[T]) -> &T {
    &arr[0]
}
```

### 타입 불변조건 주석

타입의 불변조건을 주석으로 명시합니다.

```rust
/// 양수 금액을 표현하는 타입
///
/// # Invariants
/// - cents는 항상 0 이상
/// - 오버플로우 방지를 위해 u64 사용
#[derive(Debug, Clone, Copy)]
pub struct Money {
    cents: u64,
}
```

## 5. 트레이트 사용 규칙

### 트레이트 바운드 명시

제네릭 타입의 트레이트 바운드를 명시적으로 선언합니다.

```rust
// ❌ BAD: 암묵적 바운드
fn process<T>(item: T) {
    println!("{:?}", item); // Debug 바운드 필요
}

// ✅ GOOD: 명시적 바운드
fn process<T: Debug>(item: T) {
    println!("{:?}", item);
}
```

### where 절 사용

복잡한 트레이트 바운드는 where 절로 분리합니다.

```rust
// ❌ BAD: 읽기 어려운 시그니처
fn complex<T: Clone + Debug + Serialize, U: DeserializeOwned + Send>(t: T, u: U) -> Result<(), Error>

// ✅ GOOD: where 절 사용
fn complex<T, U>(t: T, u: U) -> Result<(), Error>
where
    T: Clone + Debug + Serialize,
    U: DeserializeOwned + Send,
{
    // ...
}
```

## 6. 라이프타임 규칙

### 라이프타임 명시

엘리시전에 의존하지 않고 명시적으로 라이프타임을 선언합니다.

```rust
// ❌ BAD: 암묵적 라이프타임 (간단한 경우는 OK)
fn first(s: &str) -> &str

// ✅ GOOD: 복잡한 경우 명시적 라이프타임
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
```

### 라이프타임 파라미터 문서화

라이프타임 관계를 문서화합니다.

```rust
/// 문자열 슬라이스의 첫 단어를 반환합니다.
///
/// # Lifetimes
/// 반환되는 슬라이스는 입력과 동일한 라이프타임을 가집니다.
pub fn first_word<'a>(s: &'a str) -> &'a str {
    // ...
}
```

## 7. 네이밍 규칙

### Rust 표준 네이밍 컨벤션

- 타입, 트레이트: `PascalCase`
- 함수, 변수: `snake_case`
- 상수: `SCREAMING_SNAKE_CASE`
- 제네릭 타입: 짧은 대문자 (`T`, `U`) 또는 설명적 이름 (`Key`, `Value`)

```rust
// ✅ GOOD: 표준 네이밍
pub struct UserProfile {
    user_id: UserId,
    display_name: String,
}

const MAX_RETRIES: usize = 3;

fn calculate_total<T: Add>(items: &[T]) -> T {
    // ...
}
```

## 8. 모듈 구조 규칙

### 단일 책임 원칙

각 모듈은 하나의 명확한 책임을 가집니다.

```
src/
├── domain/          # 도메인 로직
│   ├── user.rs
│   └── order.rs
├── repository/      # 데이터 접근
│   ├── user_repo.rs
│   └── order_repo.rs
└── service/         # 비즈니스 로직
    ├── user_service.rs
    └── order_service.rs
```

### 공개 API 최소화

필요한 것만 `pub`으로 노출합니다.

```rust
// ❌ BAD: 내부 구현 노출
pub struct User {
    pub id: UserId,
    pub internal_state: InternalState, // 내부 상태 노출
}

// ✅ GOOD: 필요한 것만 노출
pub struct User {
    id: UserId,
    internal_state: InternalState,
}

impl User {
    pub fn id(&self) -> UserId {
        self.id
    }
    // internal_state는 접근자 없음
}
```

## 9. 테스트 규칙

### 단위 테스트 작성

모든 공개 함수에 단위 테스트를 작성합니다.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_money_creation() {
        let money = Money::from_dollars(10);
        assert_eq!(money.cents(), 1000);
    }

    #[test]
    fn test_invalid_email() {
        let result = Email::new("invalid");
        assert!(result.is_err());
    }
}
```

### 속성 기반 테스트

복잡한 로직에는 속성 기반 테스트를 고려합니다.

```rust
#[cfg(test)]
mod property_tests {
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn test_money_addition(a in 0u64..1000, b in 0u64..1000) {
            let m1 = Money::from_cents(a);
            let m2 = Money::from_cents(b);
            let sum = m1 + m2;
            assert_eq!(sum.cents(), a + b);
        }
    }
}
```

## 10. 성능 규칙

### Zero-cost Abstraction 확인

타입 안전성이 런타임 비용을 추가하지 않는지 확인합니다.

```bash
# 최적화된 어셈블리 확인
cargo rustc --release -- --emit asm

# 벤치마크 실행
cargo bench
```

### 불필요한 복사 방지

Clone 대신 참조를 사용합니다.

```rust
// ❌ BAD: 불필요한 복사
fn process(data: String) {
    println!("{}", data);
}

// ✅ GOOD: 참조 사용
fn process(data: &str) {
    println!("{}", data);
}
```

## 코드 리뷰 체크리스트

코드 작성 시 다음을 확인하세요:

- [ ] 모든 공개 함수에 명시적 타입 선언
- [ ] unwrap() 대신 적절한 에러 핸들링
- [ ] Newtype으로 도메인 타입 래핑
- [ ] 가변 참조 최소화
- [ ] 트레이트 바운드 명시
- [ ] 라이프타임 파라미터 문서화
- [ ] panic 발생 가능성 문서화
- [ ] 타입 불변조건 주석 작성
- [ ] 공개 API 문서화
- [ ] 단위 테스트 작성

## 참고 자료

- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- [Rust Design Patterns](https://rust-unofficial.github.io/patterns/)
- [Effective Rust](https://www.lurklurk.org/effective-rust/)
