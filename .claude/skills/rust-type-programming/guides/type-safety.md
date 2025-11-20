# 타입 안전성 가이드

## 개요

타입 안전성은 컴파일 타임에 오류를 방지하는 가장 강력한 도구입니다.
엔터프라이즈 환경에서는 런타임 에러보다 컴파일 에러가 훨씬 저렴합니다.

## 1. Newtype 패턴

### 기본 원칙

프리미티브 타입을 직접 사용하지 말고 도메인 의미를 담은 타입으로 래핑합니다.

```rust
// ❌ BAD: 프리미티브 타입 직접 사용
fn transfer(from: String, to: String, amount: f64) -> Result<(), String> {
    // from과 to를 실수로 바꿔서 호출할 수 있음
    // amount가 음수일 수 있음
}

// ✅ GOOD: Newtype으로 타입 안전성 확보
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct AccountId(String);

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Money {
    cents: u64, // 음수 불가능, 소수점 오류 방지
}

impl Money {
    pub fn from_dollars(dollars: u64) -> Self {
        Self { cents: dollars * 100 }
    }

    pub fn from_cents(cents: u64) -> Self {
        Self { cents }
    }

    pub fn cents(&self) -> u64 {
        self.cents
    }
}

fn transfer(from: AccountId, to: AccountId, amount: Money) -> Result<Receipt, TransferError> {
    // 타입이 잘못된 사용을 방지
    // from과 to를 바꿔서 호출하면 컴파일 에러는 아니지만,
    // 명시적 타입으로 실수 가능성 감소
}
```

### Validated Newtype

생성자에서 유효성 검증을 강제합니다.

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Email(String);

#[derive(Debug, thiserror::Error)]
pub enum EmailError {
    #[error("Invalid email format: {0}")]
    InvalidFormat(String),
    #[error("Email too long: {0} characters")]
    TooLong(usize),
}

impl Email {
    const MAX_LENGTH: usize = 254;

    /// 이메일을 생성합니다.
    ///
    /// # Errors
    /// - 이메일 형식이 올바르지 않으면 `EmailError::InvalidFormat`
    /// - 이메일이 254자를 초과하면 `EmailError::TooLong`
    pub fn new(email: impl Into<String>) -> Result<Self, EmailError> {
        let email = email.into();

        if email.len() > Self::MAX_LENGTH {
            return Err(EmailError::TooLong(email.len()));
        }

        if !email.contains('@') || !email.contains('.') {
            return Err(EmailError::InvalidFormat(email));
        }

        Ok(Self(email))
    }

    /// # Safety
    /// 이미 검증된 이메일로부터 생성합니다.
    /// 외부 시스템에서 이미 검증된 경우에만 사용하세요.
    pub fn new_unchecked(email: String) -> Self {
        Self(email)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

// ✅ 사용 예시
fn send_email(to: Email, subject: &str, body: &str) -> Result<(), EmailSendError> {
    // Email 타입을 받았다는 것은 이미 검증되었다는 보장
    // 함수 내부에서 재검증 불필요
}
```

### 단위 타입 (Units of Measure)

```rust
use std::marker::PhantomData;

// 단위를 타입으로 표현
pub struct Meters;
pub struct Feet;
pub struct Seconds;
pub struct Hours;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Distance<Unit> {
    value: f64,
    _unit: PhantomData<Unit>,
}

impl Distance<Meters> {
    pub fn meters(value: f64) -> Self {
        Self {
            value,
            _unit: PhantomData,
        }
    }

    pub fn to_feet(self) -> Distance<Feet> {
        Distance {
            value: self.value * 3.28084,
            _unit: PhantomData,
        }
    }
}

impl Distance<Feet> {
    pub fn feet(value: f64) -> Self {
        Self {
            value,
            _unit: PhantomData,
        }
    }

    pub fn to_meters(self) -> Distance<Meters> {
        Distance {
            value: self.value / 3.28084,
            _unit: PhantomData,
        }
    }
}

// ✅ 타입 안전한 단위 변환
fn calculate_distance() {
    let d1 = Distance::meters(100.0);
    let d2 = Distance::feet(328.084);

    // 컴파일 에러: 다른 단위끼리 직접 비교 불가
    // let same = d1 == d2;

    // ✅ 명시적 변환 필요
    let d2_in_meters = d2.to_meters();
    let same = (d1.value - d2_in_meters.value).abs() < 0.001;
}
```

## 2. Phantom Types

컴파일 타임에만 존재하는 타입 정보로 상태를 표현합니다.

```rust
use std::marker::PhantomData;

// 상태 타입들
pub struct Open;
pub struct Closed;
pub struct Locked;

pub struct Door<State> {
    id: String,
    _state: PhantomData<State>,
}

impl Door<Closed> {
    pub fn new(id: String) -> Self {
        Self {
            id,
            _state: PhantomData,
        }
    }

    pub fn open(self) -> Door<Open> {
        println!("Door {} is now open", self.id);
        Door {
            id: self.id,
            _state: PhantomData,
        }
    }

    pub fn lock(self) -> Door<Locked> {
        println!("Door {} is now locked", self.id);
        Door {
            id: self.id,
            _state: PhantomData,
        }
    }
}

impl Door<Open> {
    pub fn close(self) -> Door<Closed> {
        println!("Door {} is now closed", self.id);
        Door {
            id: self.id,
            _state: PhantomData,
        }
    }

    // Open 상태에서는 lock 불가능 - 메서드 자체가 없음
}

impl Door<Locked> {
    pub fn unlock(self) -> Door<Closed> {
        println!("Door {} is now unlocked", self.id);
        Door {
            id: self.id,
            _state: PhantomData,
        }
    }
}

// ✅ 타입 시스템이 불가능한 상태 전이를 방지
fn door_example() {
    let door = Door::new("main".to_string());
    let door = door.open();
    // let door = door.lock(); // ❌ 컴파일 에러: Open 상태에서 lock 불가
    let door = door.close();
    let door = door.lock(); // ✅ OK
}
```

## 3. Builder 패턴의 타입 상태

```rust
use std::marker::PhantomData;

// 빌더 상태
pub struct WithoutName;
pub struct WithName;
pub struct WithoutEmail;
pub struct WithEmail;

pub struct UserBuilder<NameState, EmailState> {
    name: Option<String>,
    email: Option<String>,
    age: Option<u32>,
    _name_state: PhantomData<NameState>,
    _email_state: PhantomData<EmailState>,
}

impl UserBuilder<WithoutName, WithoutEmail> {
    pub fn new() -> Self {
        Self {
            name: None,
            email: None,
            age: None,
            _name_state: PhantomData,
            _email_state: PhantomData,
        }
    }
}

impl<EmailState> UserBuilder<WithoutName, EmailState> {
    pub fn name(self, name: String) -> UserBuilder<WithName, EmailState> {
        UserBuilder {
            name: Some(name),
            email: self.email,
            age: self.age,
            _name_state: PhantomData,
            _email_state: PhantomData,
        }
    }
}

impl<NameState> UserBuilder<NameState, WithoutEmail> {
    pub fn email(self, email: String) -> UserBuilder<NameState, WithEmail> {
        UserBuilder {
            name: self.name,
            email: Some(email),
            age: self.age,
            _name_state: PhantomData,
            _email_state: PhantomData,
        }
    }
}

impl<NameState, EmailState> UserBuilder<NameState, EmailState> {
    pub fn age(mut self, age: u32) -> Self {
        self.age = Some(age);
        self
    }
}

#[derive(Debug)]
pub struct User {
    name: String,
    email: String,
    age: Option<u32>,
}

// 필수 필드가 모두 설정된 경우에만 build 가능
impl UserBuilder<WithName, WithEmail> {
    pub fn build(self) -> User {
        User {
            name: self.name.unwrap(), // 타입 시스템이 Some 보장
            email: self.email.unwrap(), // 타입 시스템이 Some 보장
            age: self.age,
        }
    }
}

// ✅ 사용 예시
fn builder_example() {
    let user = UserBuilder::new()
        .name("John".to_string())
        .email("john@example.com".to_string())
        .age(30)
        .build(); // ✅ OK

    // ❌ 컴파일 에러: name이 없음
    // let user = UserBuilder::new()
    //     .email("john@example.com".to_string())
    //     .build();
}
```

## 4. Non-Empty Collections

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NonEmpty<T> {
    head: T,
    tail: Vec<T>,
}

impl<T> NonEmpty<T> {
    /// 비어있지 않은 컬렉션을 생성합니다.
    pub fn new(head: T, tail: Vec<T>) -> Self {
        Self { head, tail }
    }

    /// 단일 요소로 NonEmpty를 생성합니다.
    pub fn singleton(value: T) -> Self {
        Self {
            head: value,
            tail: Vec::new(),
        }
    }

    /// Vec로부터 NonEmpty를 생성합니다.
    ///
    /// # Returns
    /// 비어있으면 None, 아니면 Some(NonEmpty)
    pub fn from_vec(mut vec: Vec<T>) -> Option<Self> {
        if vec.is_empty() {
            None
        } else {
            let head = vec.remove(0);
            Some(Self { head, tail: vec })
        }
    }

    /// 첫 번째 요소를 반환합니다. (항상 존재함)
    pub fn head(&self) -> &T {
        &self.head
    }

    /// 길이를 반환합니다. (최소 1)
    pub fn len(&self) -> usize {
        1 + self.tail.len()
    }

    /// 요소를 추가합니다.
    pub fn push(&mut self, value: T) {
        self.tail.push(value);
    }

    /// 반복자를 반환합니다.
    pub fn iter(&self) -> impl Iterator<Item = &T> {
        std::iter::once(&self.head).chain(self.tail.iter())
    }
}

// ✅ 비어있지 않음을 타입으로 보장
fn process_items(items: NonEmpty<String>) -> String {
    // unwrap 없이 안전하게 첫 번째 요소 접근
    items.head().clone()
}
```

## 5. 타입 레벨 불변조건

```rust
/// 정렬된 벡터를 보장하는 타입
#[derive(Debug, Clone)]
pub struct Sorted<T: Ord> {
    inner: Vec<T>,
}

impl<T: Ord> Sorted<T> {
    /// 정렬된 벡터를 생성합니다.
    pub fn new(mut vec: Vec<T>) -> Self {
        vec.sort();
        Self { inner: vec }
    }

    /// 이미 정렬된 벡터로부터 생성합니다.
    ///
    /// # Safety
    /// 호출자가 벡터가 정렬되어 있음을 보장해야 합니다.
    pub fn new_unchecked(vec: Vec<T>) -> Self {
        debug_assert!(vec.windows(2).all(|w| w[0] <= w[1]));
        Self { inner: vec }
    }

    /// 이진 탐색을 수행합니다. (항상 O(log n))
    pub fn binary_search(&self, value: &T) -> Result<usize, usize> {
        self.inner.binary_search(value)
    }

    /// 요소를 정렬을 유지하며 삽입합니다.
    pub fn insert(&mut self, value: T) {
        match self.inner.binary_search(&value) {
            Ok(pos) | Err(pos) => self.inner.insert(pos, value),
        }
    }

    /// 내부 벡터에 대한 읽기 전용 참조
    pub fn as_slice(&self) -> &[T] {
        &self.inner
    }
}

// ✅ 정렬 보장을 타입으로 표현
fn find_in_sorted(items: &Sorted<i32>, target: i32) -> Option<usize> {
    // 정렬되어 있음이 보장되므로 이진 탐색 안전
    items.binary_search(&target).ok()
}
```

## 6. Zero-Cost Abstractions 확인

```rust
// 타입 안전성이 런타임 비용을 추가하지 않는지 확인

#[derive(Debug, Clone, Copy)]
pub struct UserId(u64);

#[derive(Debug, Clone, Copy)]
pub struct ProductId(u64);

// 컴파일 후 어셈블리 확인:
// cargo rustc --release -- --emit asm

pub fn get_user(id: UserId) -> Option<String> {
    // UserId는 런타임에 u64와 동일한 표현
    // 추가 메모리나 연산 비용 없음
    Some(format!("User {}", id.0))
}

// 두 함수의 어셈블리가 동일함을 확인
pub fn get_user_primitive(id: u64) -> Option<String> {
    Some(format!("User {}", id))
}
```

## 체크리스트

타입 안전성을 확보하기 위한 체크리스트:

- [ ] String, i32, f64 등 프리미티브 타입을 직접 사용하지 않음
- [ ] 모든 도메인 개념이 별도 타입으로 표현됨
- [ ] Newtype 생성자에서 유효성 검증 수행
- [ ] 불가능한 상태를 타입으로 표현 불가능하게 만듦
- [ ] Builder에 타입 상태 적용
- [ ] 컬렉션이 비어있으면 안 되는 경우 NonEmpty 사용
- [ ] 타입 불변조건을 주석으로 문서화
- [ ] Zero-cost abstraction 확인 (필요시 벤치마크)

## 참고 자료

- [Rust Design Patterns - Newtype](https://rust-unofficial.github.io/patterns/patterns/behavioural/newtype.html)
- [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)
- [Making Impossible States Impossible](https://www.youtube.com/watch?v=IcgmSRJHu_8)
