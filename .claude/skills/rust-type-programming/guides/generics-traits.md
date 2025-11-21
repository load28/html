# 제네릭 & 트레이트 활용 가이드

## 개요

제네릭과 트레이트는 러스트의 타입 시스템에서 가장 강력한 추상화 도구입니다.
엔터프라이즈 코드에서는 타입 안전성을 유지하면서 재사용 가능한 코드를 작성하기 위해 필수적입니다.

## 1. 트레이트 바운드 설계

### 명시적 트레이트 바운드

```rust
use std::fmt::{Debug, Display};

// ❌ 너무 관대함
fn process<T>(value: T) {
    // T에 대해 할 수 있는 게 거의 없음
}

// ✅ 필요한 바운드만 명시
fn process<T: Debug + Clone>(value: T) -> T {
    println!("Processing: {:?}", value);
    value.clone()
}

// ✅ where 절로 가독성 향상
fn complex_function<T, U, V>(a: T, b: U, c: V) -> Result<String, ProcessError>
where
    T: Debug + Display + Clone,
    U: IntoIterator<Item = String>,
    V: AsRef<str> + Into<String>,
{
    // 구현
    Ok(format!("{}", a))
}
```

### 트레이트 바운드 최소화

```rust
// ❌ 과도한 바운드
fn print_items<T: Debug + Display + Clone + PartialEq>(items: Vec<T>) {
    for item in items {
        println!("{:?}", item); // Debug만 사용
    }
}

// ✅ 필요한 것만
fn print_items<T: Debug>(items: Vec<T>) {
    for item in items {
        println!("{:?}", item);
    }
}
```

### 조건부 트레이트 구현

```rust
use std::fmt::{self, Display};

pub struct Wrapper<T> {
    value: T,
}

// T가 Display를 구현하는 경우에만 Wrapper도 Display 구현
impl<T: Display> Display for Wrapper<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Wrapper({})", self.value)
    }
}

// T가 Clone을 구현하는 경우에만 Wrapper도 Clone 구현
impl<T: Clone> Clone for Wrapper<T> {
    fn clone(&self) -> Self {
        Self {
            value: self.value.clone(),
        }
    }
}
```

## 2. Associated Types vs Generic Parameters

### Associated Types 사용 경우

```rust
// ✅ 트레이트 당 하나의 구체적인 타입이 있을 때
pub trait Repository {
    type Entity;
    type Error;

    fn find(&self, id: &str) -> Result<Self::Entity, Self::Error>;
    fn save(&self, entity: &Self::Entity) -> Result<(), Self::Error>;
    fn delete(&self, id: &str) -> Result<(), Self::Error>;
}

pub struct UserRepository {
    // ...
}

impl Repository for UserRepository {
    type Entity = User;
    type Error = DatabaseError;

    fn find(&self, id: &str) -> Result<User, DatabaseError> {
        // 구현
        Ok(User::default())
    }

    fn save(&self, entity: &User) -> Result<(), DatabaseError> {
        // 구현
        Ok(())
    }

    fn delete(&self, id: &str) -> Result<(), DatabaseError> {
        // 구현
        Ok(())
    }
}

// ✅ 사용이 간단함
fn process_repository<R: Repository>(repo: &R) -> Result<R::Entity, R::Error> {
    repo.find("123")
}
```

### Generic Parameters 사용 경우

```rust
// ✅ 여러 타입으로 구현 가능할 때
pub trait Converter<Input, Output> {
    fn convert(&self, input: Input) -> Output;
}

pub struct StringToIntConverter;

impl Converter<String, i32> for StringToIntConverter {
    fn convert(&self, input: String) -> i32 {
        input.parse().unwrap_or(0)
    }
}

impl Converter<String, f64> for StringToIntConverter {
    fn convert(&self, input: String) -> f64 {
        input.parse().unwrap_or(0.0)
    }
}

// ✅ 여러 변환 지원
fn use_converter() {
    let converter = StringToIntConverter;
    let int_val: i32 = converter.convert("42".to_string());
    let float_val: f64 = converter.convert("42.5".to_string());
}
```

### 혼합 사용

```rust
pub trait Serializer {
    type Error;

    fn serialize<T: serde::Serialize>(&self, value: &T) -> Result<Vec<u8>, Self::Error>;
    fn deserialize<T: serde::DeserializeOwned>(&self, data: &[u8]) -> Result<T, Self::Error>;
}

pub struct JsonSerializer;

impl Serializer for JsonSerializer {
    type Error = serde_json::Error;

    fn serialize<T: serde::Serialize>(&self, value: &T) -> Result<Vec<u8>, Self::Error> {
        serde_json::to_vec(value)
    }

    fn deserialize<T: serde::DeserializeOwned>(&self, data: &[u8]) -> Result<T, Self::Error> {
        serde_json::from_slice(data)
    }
}
```

## 3. Static Dispatch vs Dynamic Dispatch

### Static Dispatch (제네릭)

```rust
// ✅ 성능이 중요할 때 - 제로 비용 추상화
pub fn process_static<T: Display>(item: T) {
    println!("{}", item);
    // 컴파일러가 각 타입에 대해 별도 코드 생성
    // 인라인 가능, 최적화 가능
}

// 사용
fn use_static() {
    process_static(42);        // process_static::<i32> 생성
    process_static("hello");   // process_static::<&str> 생성
}
```

### Dynamic Dispatch (Trait Objects)

```rust
// ✅ 런타임에 타입이 결정되거나, 여러 타입을 한 컬렉션에 담을 때
pub fn process_dynamic(item: &dyn Display) {
    println!("{}", item);
    // 가상 함수 테이블(vtable)을 통한 호출
    // 약간의 성능 비용 발생
}

// 이기종 컬렉션
fn use_dynamic() {
    let items: Vec<Box<dyn Display>> = vec![
        Box::new(42),
        Box::new("hello"),
        Box::new(3.14),
    ];

    for item in items {
        process_dynamic(item.as_ref());
    }
}
```

### 선택 가이드

```rust
// ✅ Static Dispatch 사용 경우
// - 성능이 중요
// - 컴파일 타임에 타입이 결정됨
// - 코드 크기보다 속도가 중요

pub fn fast_process<T: Debug>(value: T) {
    // 인라인되어 최적화됨
    println!("{:?}", value);
}

// ✅ Dynamic Dispatch 사용 경우
// - 이기종 컬렉션 필요
// - 플러그인 시스템
// - 코드 크기가 중요 (하나의 구현만 생성)

pub trait Plugin {
    fn execute(&self);
}

pub struct PluginManager {
    plugins: Vec<Box<dyn Plugin>>,
}

impl PluginManager {
    pub fn add_plugin(&mut self, plugin: Box<dyn Plugin>) {
        self.plugins.push(plugin);
    }

    pub fn run_all(&self) {
        for plugin in &self.plugins {
            plugin.execute();
        }
    }
}
```

## 4. 고급 트레이트 패턴

### Sealed Trait

```rust
// 외부에서 구현 불가능한 트레이트
mod sealed {
    pub trait Sealed {}
}

pub trait CannotImplement: sealed::Sealed {
    fn method(&self);
}

pub struct AllowedType;

impl sealed::Sealed for AllowedType {}

impl CannotImplement for AllowedType {
    fn method(&self) {
        println!("Allowed");
    }
}

// ❌ 외부에서는 구현 불가
// impl sealed::Sealed for MyType {}
// impl CannotImplement for MyType { ... }
```

### Extension Trait

```rust
// 기존 타입에 메서드 추가
pub trait StringExt {
    fn is_valid_email(&self) -> bool;
    fn truncate_to(&self, max_len: usize) -> String;
}

impl StringExt for String {
    fn is_valid_email(&self) -> bool {
        self.contains('@') && self.contains('.')
    }

    fn truncate_to(&self, max_len: usize) -> String {
        if self.len() <= max_len {
            self.clone()
        } else {
            format!("{}...", &self[..max_len - 3])
        }
    }
}

impl StringExt for str {
    fn is_valid_email(&self) -> bool {
        self.contains('@') && self.contains('.')
    }

    fn truncate_to(&self, max_len: usize) -> String {
        if self.len() <= max_len {
            self.to_string()
        } else {
            format!("{}...", &self[..max_len - 3])
        }
    }
}

// 사용
fn use_extension() {
    let email = "test@example.com".to_string();
    println!("Is valid: {}", email.is_valid_email());
    println!("Truncated: {}", email.truncate_to(10));
}
```

### Marker Trait

```rust
use std::marker::PhantomData;

// 마커 트레이트로 타입 속성 표시
pub trait Validated {}

pub struct Email<V> {
    value: String,
    _validated: PhantomData<V>,
}

pub struct Unvalidated;
pub struct ValidatedMarker;

impl Validated for ValidatedMarker {}

impl Email<Unvalidated> {
    pub fn new(value: String) -> Self {
        Self {
            value,
            _validated: PhantomData,
        }
    }

    pub fn validate(self) -> Result<Email<ValidatedMarker>, ValidationError> {
        if !self.value.contains('@') {
            return Err(ValidationError::InvalidFormat);
        }

        Ok(Email {
            value: self.value,
            _validated: PhantomData,
        })
    }
}

impl Email<ValidatedMarker> {
    pub fn value(&self) -> &str {
        &self.value
    }
}

// 검증된 이메일만 받는 함수
pub fn send_email<V: Validated>(email: Email<V>) {
    println!("Sending to: {}", email.value());
}
```

### Blanket Implementation

```rust
// 특정 트레이트를 구현하는 모든 타입에 대해 구현
pub trait ToJson {
    fn to_json(&self) -> String;
}

// serde::Serialize를 구현하는 모든 타입에 대해 ToJson 자동 구현
impl<T: serde::Serialize> ToJson for T {
    fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }
}

// 이제 모든 Serialize 타입이 to_json() 사용 가능
#[derive(serde::Serialize)]
struct User {
    name: String,
    age: u32,
}

fn use_blanket() {
    let user = User {
        name: "John".to_string(),
        age: 30,
    };
    println!("{}", user.to_json()); // 자동으로 사용 가능
}
```

## 5. 고급 제네릭 패턴

### Higher-Kinded Types (HKT) 모방

```rust
// 러스트는 진정한 HKT가 없지만, 비슷하게 만들 수 있음

pub trait Functor {
    type Unwrapped;
    type Wrapped<B>;

    fn map<B, F>(self, f: F) -> Self::Wrapped<B>
    where
        F: FnOnce(Self::Unwrapped) -> B;
}

impl<A> Functor for Option<A> {
    type Unwrapped = A;
    type Wrapped<B> = Option<B>;

    fn map<B, F>(self, f: F) -> Option<B>
    where
        F: FnOnce(A) -> B,
    {
        self.map(f)
    }
}

impl<A, E> Functor for Result<A, E> {
    type Unwrapped = A;
    type Wrapped<B> = Result<B, E>;

    fn map<B, F>(self, f: F) -> Result<B, E>
    where
        F: FnOnce(A) -> B,
    {
        self.map(f)
    }
}
```

### 타입 레벨 프로그래밍

```rust
use std::marker::PhantomData;

// 타입 레벨 불리언
pub struct True;
pub struct False;

pub trait Bool {
    type Not: Bool;
}

impl Bool for True {
    type Not = False;
}

impl Bool for False {
    type Not = True;
}

// 타입 레벨 조건
pub trait If {
    type Then<T, F>;
}

impl If for True {
    type Then<T, F> = T;
}

impl If for False {
    type Then<T, F> = F;
}

// 사용 예시
pub struct Config<IsProduction: Bool> {
    _production: PhantomData<IsProduction>,
}

impl Config<True> {
    pub fn database_url(&self) -> &str {
        "prod-database-url"
    }
}

impl Config<False> {
    pub fn database_url(&self) -> &str {
        "dev-database-url"
    }
}
```

## 6. 실전 패턴

### Repository 패턴

```rust
use async_trait::async_trait;

#[async_trait]
pub trait Repository<T> {
    type Error;

    async fn find_by_id(&self, id: &str) -> Result<Option<T>, Self::Error>;
    async fn find_all(&self) -> Result<Vec<T>, Self::Error>;
    async fn save(&self, entity: &T) -> Result<(), Self::Error>;
    async fn delete(&self, id: &str) -> Result<(), Self::Error>;
}

#[async_trait]
impl Repository<User> for PostgresUserRepository {
    type Error = DatabaseError;

    async fn find_by_id(&self, id: &str) -> Result<Option<User>, DatabaseError> {
        // 구현
        Ok(None)
    }

    async fn find_all(&self) -> Result<Vec<User>, DatabaseError> {
        Ok(Vec::new())
    }

    async fn save(&self, entity: &User) -> Result<(), DatabaseError> {
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DatabaseError> {
        Ok(())
    }
}
```

### Builder with Generics

```rust
pub struct Query<T, F = ()> {
    table: String,
    filters: F,
    _phantom: PhantomData<T>,
}

impl<T> Query<T, ()> {
    pub fn new(table: String) -> Self {
        Self {
            table,
            filters: (),
            _phantom: PhantomData,
        }
    }
}

impl<T, F> Query<T, F> {
    pub fn filter<NewF>(self, filter: NewF) -> Query<T, (F, NewF)> {
        Query {
            table: self.table,
            filters: (self.filters, filter),
            _phantom: PhantomData,
        }
    }

    pub fn execute(self) -> Vec<T> {
        // 실행 로직
        Vec::new()
    }
}
```

### Type-safe ID

```rust
use std::marker::PhantomData;

pub struct Id<T> {
    value: String,
    _phantom: PhantomData<T>,
}

impl<T> Id<T> {
    pub fn new(value: String) -> Self {
        Self {
            value,
            _phantom: PhantomData,
        }
    }

    pub fn value(&self) -> &str {
        &self.value
    }
}

impl<T> Clone for Id<T> {
    fn clone(&self) -> Self {
        Self {
            value: self.value.clone(),
            _phantom: PhantomData,
        }
    }
}

pub struct User {
    id: Id<User>,
    name: String,
}

pub struct Post {
    id: Id<Post>,
    author_id: Id<User>, // 타입 안전한 참조
    title: String,
}

// ❌ 컴파일 에러: 다른 타입의 ID는 비교 불가
fn type_safe_ids() {
    let user_id = Id::<User>::new("user-123".to_string());
    let post_id = Id::<Post>::new("post-456".to_string());

    // if user_id == post_id { } // 컴파일 에러
}
```

## 체크리스트

제네릭 & 트레이트 사용 체크리스트:

- [ ] 트레이트 바운드는 필요한 것만 명시
- [ ] Associated Types와 Generic Parameters 적절히 선택
- [ ] Static/Dynamic dispatch 성능 트레이드오프 고려
- [ ] Trait object는 Sized가 아님을 기억 (`?Sized`)
- [ ] 제네릭 함수/타입에 충분한 문서화
- [ ] 트레이트 경계 조건 명확히
- [ ] PhantomData로 런타임 비용 없음 확인
- [ ] 복잡한 제네릭은 타입 별칭으로 간소화

## 참고 자료

- [Rust Book - Generics](https://doc.rust-lang.org/book/ch10-00-generics.html)
- [Rust Book - Traits](https://doc.rust-lang.org/book/ch10-02-traits.html)
- [Trait Objects](https://doc.rust-lang.org/book/ch17-02-trait-objects.html)
- [Advanced Traits](https://doc.rust-lang.org/book/ch19-03-advanced-traits.html)
