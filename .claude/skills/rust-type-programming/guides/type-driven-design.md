# 타입 주도 설계 (Type-Driven Design)

## 개요

타입 주도 설계는 타입 시스템을 활용하여 불가능한 상태를 표현할 수 없게 만드는 설계 방법론입니다.
"If it compiles, it works"를 목표로 합니다.

## 핵심 원칙

**"Make Impossible States Impossible"**

잘못된 상태를 만들 수 없도록 타입 시스템이 강제합니다.

## 1. 불가능한 상태 제거

### 나쁜 설계

```rust
// ❌ BAD: 모순된 상태가 가능
pub struct User {
    pub username: String,
    pub email: String,
    pub is_verified: bool,
    pub verification_token: Option<String>, // 검증된 사용자도 토큰을 가질 수 있음!
}

// 문제: is_verified=true이면서 verification_token=Some인 상태 가능
let invalid_user = User {
    username: "john".to_string(),
    email: "john@example.com".to_string(),
    is_verified: true,
    verification_token: Some("abc123".to_string()), // 모순!
};
```

### 좋은 설계

```rust
// ✅ GOOD: 타입으로 상태 구분
pub struct VerifiedUser {
    pub username: String,
    pub email: String,
}

pub struct UnverifiedUser {
    pub username: String,
    pub email: String,
    pub verification_token: String, // 항상 존재
}

pub enum User {
    Verified(VerifiedUser),
    Unverified(UnverifiedUser),
}

impl User {
    pub fn verify(self, token: &str) -> Result<VerifiedUser, VerificationError> {
        match self {
            User::Unverified(user) if user.verification_token == token => {
                Ok(VerifiedUser {
                    username: user.username,
                    email: user.email,
                })
            }
            User::Unverified(_) => Err(VerificationError::InvalidToken),
            User::Verified(user) => Ok(user), // 이미 검증됨
        }
    }
}

// ✅ 불가능한 상태를 만들 수 없음
```

## 2. Typestate 패턴

### HTTP Connection 상태 관리

```rust
use std::marker::PhantomData;

// 상태 타입들
pub struct Disconnected;
pub struct Connected;
pub struct Authenticated;

pub struct HttpConnection<State> {
    url: String,
    _state: PhantomData<State>,
}

impl HttpConnection<Disconnected> {
    pub fn new(url: String) -> Self {
        Self {
            url,
            _state: PhantomData,
        }
    }

    pub fn connect(self) -> Result<HttpConnection<Connected>, ConnectionError> {
        println!("Connecting to {}", self.url);
        // 실제 연결 로직
        Ok(HttpConnection {
            url: self.url,
            _state: PhantomData,
        })
    }
}

impl HttpConnection<Connected> {
    pub fn authenticate(
        self,
        credentials: &Credentials,
    ) -> Result<HttpConnection<Authenticated>, AuthError> {
        println!("Authenticating...");
        // 인증 로직
        Ok(HttpConnection {
            url: self.url,
            _state: PhantomData,
        })
    }

    pub fn disconnect(self) -> HttpConnection<Disconnected> {
        println!("Disconnecting...");
        HttpConnection {
            url: self.url,
            _state: PhantomData,
        }
    }
}

impl HttpConnection<Authenticated> {
    pub fn send_request(&self, request: &Request) -> Response {
        println!("Sending authenticated request to {}", self.url);
        // 요청 전송
        Response::default()
    }

    pub fn disconnect(self) -> HttpConnection<Disconnected> {
        println!("Disconnecting...");
        HttpConnection {
            url: self.url,
            _state: PhantomData,
        }
    }
}

// ✅ 사용 예시
fn typestate_example() -> Result<(), Box<dyn std::error::Error>> {
    let conn = HttpConnection::new("https://api.example.com".to_string());

    // ❌ 컴파일 에러: Disconnected 상태에서는 send_request 불가
    // conn.send_request(&request);

    let conn = conn.connect()?;

    // ❌ 컴파일 에러: Connected 상태에서는 send_request 불가
    // conn.send_request(&request);

    let conn = conn.authenticate(&credentials)?;

    // ✅ OK: Authenticated 상태에서만 가능
    conn.send_request(&request);

    Ok(())
}
```

### Builder의 Typestate

```rust
use std::marker::PhantomData;

pub struct NoTitle;
pub struct HasTitle;
pub struct NoBody;
pub struct HasBody;

pub struct ArticleBuilder<Title, Body> {
    title: Option<String>,
    body: Option<String>,
    tags: Vec<String>,
    _title: PhantomData<Title>,
    _body: PhantomData<Body>,
}

impl ArticleBuilder<NoTitle, NoBody> {
    pub fn new() -> Self {
        Self {
            title: None,
            body: None,
            tags: Vec::new(),
            _title: PhantomData,
            _body: PhantomData,
        }
    }
}

impl<Body> ArticleBuilder<NoTitle, Body> {
    pub fn title(self, title: String) -> ArticleBuilder<HasTitle, Body> {
        ArticleBuilder {
            title: Some(title),
            body: self.body,
            tags: self.tags,
            _title: PhantomData,
            _body: PhantomData,
        }
    }
}

impl<Title> ArticleBuilder<Title, NoBody> {
    pub fn body(self, body: String) -> ArticleBuilder<Title, HasBody> {
        ArticleBuilder {
            title: self.title,
            body: Some(body),
            tags: self.tags,
            _title: PhantomData,
            _body: PhantomData,
        }
    }
}

impl<Title, Body> ArticleBuilder<Title, Body> {
    pub fn tag(mut self, tag: String) -> Self {
        self.tags.push(tag);
        self
    }
}

pub struct Article {
    title: String,
    body: String,
    tags: Vec<String>,
}

// build는 모든 필수 필드가 설정된 경우에만 가능
impl ArticleBuilder<HasTitle, HasBody> {
    pub fn build(self) -> Article {
        Article {
            title: self.title.unwrap(), // 타입 시스템이 Some 보장
            body: self.body.unwrap(),   // 타입 시스템이 Some 보장
            tags: self.tags,
        }
    }
}

// ✅ 사용 예시
fn builder_example() {
    let article = ArticleBuilder::new()
        .title("Rust Type System".to_string())
        .body("Content here...".to_string())
        .tag("rust".to_string())
        .tag("programming".to_string())
        .build(); // ✅ OK

    // ❌ 컴파일 에러: title이 없음
    // let article = ArticleBuilder::new()
    //     .body("Content".to_string())
    //     .build();
}
```

## 3. API 설계 시 타입 활용

### 검색 쿼리 빌더

```rust
pub struct SearchQuery {
    text: String,
    filters: Vec<Filter>,
    sort: Option<SortBy>,
    page: Page,
}

pub struct SearchQueryBuilder {
    text: Option<String>,
    filters: Vec<Filter>,
    sort: Option<SortBy>,
    page: Page,
}

impl SearchQueryBuilder {
    pub fn new() -> Self {
        Self {
            text: None,
            filters: Vec::new(),
            sort: None,
            page: Page::default(),
        }
    }

    pub fn text(mut self, text: String) -> Self {
        self.text = Some(text);
        self
    }

    pub fn filter(mut self, filter: Filter) -> Self {
        self.filters.push(filter);
        self
    }

    pub fn sort(mut self, sort: SortBy) -> Self {
        self.sort = Some(sort);
        self
    }

    pub fn page(mut self, page: Page) -> Self {
        self.page = page;
        self
    }

    pub fn build(self) -> Result<SearchQuery, BuildError> {
        let text = self.text.ok_or(BuildError::MissingField("text"))?;

        Ok(SearchQuery {
            text,
            filters: self.filters,
            sort: self.sort,
            page: self.page,
        })
    }
}

// 타입 상태 버전 (더 엄격)
pub struct NoText;
pub struct WithText;

pub struct TypedSearchQueryBuilder<T> {
    text: Option<String>,
    filters: Vec<Filter>,
    sort: Option<SortBy>,
    page: Page,
    _text_state: PhantomData<T>,
}

impl TypedSearchQueryBuilder<NoText> {
    pub fn new() -> Self {
        Self {
            text: None,
            filters: Vec::new(),
            sort: None,
            page: Page::default(),
            _text_state: PhantomData,
        }
    }

    pub fn text(self, text: String) -> TypedSearchQueryBuilder<WithText> {
        TypedSearchQueryBuilder {
            text: Some(text),
            filters: self.filters,
            sort: self.sort,
            page: self.page,
            _text_state: PhantomData,
        }
    }
}

impl<T> TypedSearchQueryBuilder<T> {
    pub fn filter(mut self, filter: Filter) -> Self {
        self.filters.push(filter);
        self
    }

    pub fn sort(mut self, sort: SortBy) -> Self {
        self.sort = Some(sort);
        self
    }

    pub fn page(mut self, page: Page) -> Self {
        self.page = page;
        self
    }
}

impl TypedSearchQueryBuilder<WithText> {
    pub fn build(self) -> SearchQuery {
        SearchQuery {
            text: self.text.unwrap(), // 안전
            filters: self.filters,
            sort: self.sort,
            page: self.page,
        }
    }
}
```

## 4. 트랜잭션 상태 관리

```rust
pub struct Transaction<State> {
    id: String,
    operations: Vec<Operation>,
    _state: PhantomData<State>,
}

pub struct Started;
pub struct Committed;
pub struct RolledBack;

impl Transaction<Started> {
    pub fn begin(id: String) -> Self {
        println!("Transaction {} started", id);
        Self {
            id,
            operations: Vec::new(),
            _state: PhantomData,
        }
    }

    pub fn execute(&mut self, op: Operation) -> Result<(), ExecutionError> {
        println!("Executing operation in transaction {}", self.id);
        self.operations.push(op);
        Ok(())
    }

    pub fn commit(self) -> Result<Transaction<Committed>, CommitError> {
        println!("Committing transaction {}", self.id);
        // 커밋 로직
        Ok(Transaction {
            id: self.id,
            operations: self.operations,
            _state: PhantomData,
        })
    }

    pub fn rollback(self) -> Transaction<RolledBack> {
        println!("Rolling back transaction {}", self.id);
        Transaction {
            id: self.id,
            operations: self.operations,
            _state: PhantomData,
        }
    }
}

impl Transaction<Committed> {
    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn operations(&self) -> &[Operation] {
        &self.operations
    }
}

impl Transaction<RolledBack> {
    pub fn id(&self) -> &str {
        &self.id
    }
}

// ✅ 사용 예시
fn transaction_example() -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = Transaction::begin("tx-001".to_string());

    tx.execute(Operation::Insert)?;
    tx.execute(Operation::Update)?;

    let tx = tx.commit()?;

    // ❌ 컴파일 에러: 이미 커밋된 트랜잭션은 execute 불가
    // tx.execute(Operation::Delete)?;

    println!("Transaction {} completed with {} operations", tx.id(), tx.operations().len());

    Ok(())
}
```

## 5. 권한 시스템

```rust
pub struct Permission<Level> {
    user_id: String,
    _level: PhantomData<Level>,
}

pub struct ReadOnly;
pub struct ReadWrite;
pub struct Admin;

impl<Level> Permission<Level> {
    pub fn user_id(&self) -> &str {
        &self.user_id
    }
}

impl Permission<ReadOnly> {
    pub fn read_only(user_id: String) -> Self {
        Self {
            user_id,
            _level: PhantomData,
        }
    }

    pub fn read(&self, resource: &Resource) -> Result<Data, PermissionError> {
        println!("User {} reading resource", self.user_id);
        Ok(Data::default())
    }
}

impl Permission<ReadWrite> {
    pub fn read_write(user_id: String) -> Self {
        Self {
            user_id,
            _level: PhantomData,
        }
    }

    pub fn read(&self, resource: &Resource) -> Result<Data, PermissionError> {
        println!("User {} reading resource", self.user_id);
        Ok(Data::default())
    }

    pub fn write(&self, resource: &Resource, data: &Data) -> Result<(), PermissionError> {
        println!("User {} writing to resource", self.user_id);
        Ok(())
    }
}

impl Permission<Admin> {
    pub fn admin(user_id: String) -> Self {
        Self {
            user_id,
            _level: PhantomData,
        }
    }

    pub fn read(&self, resource: &Resource) -> Result<Data, PermissionError> {
        println!("Admin {} reading resource", self.user_id);
        Ok(Data::default())
    }

    pub fn write(&self, resource: &Resource, data: &Data) -> Result<(), PermissionError> {
        println!("Admin {} writing to resource", self.user_id);
        Ok(())
    }

    pub fn delete(&self, resource: &Resource) -> Result<(), PermissionError> {
        println!("Admin {} deleting resource", self.user_id);
        Ok(())
    }
}

// API 함수는 필요한 권한 레벨을 타입으로 명시
pub fn view_document(perm: &Permission<ReadOnly>, doc_id: &str) -> Result<Document, Error> {
    // ReadOnly 권한으로 충분
    Ok(Document::default())
}

pub fn edit_document(perm: &Permission<ReadWrite>, doc_id: &str, content: &str) -> Result<(), Error> {
    // ReadWrite 권한 필요
    Ok(())
}

pub fn delete_document(perm: &Permission<Admin>, doc_id: &str) -> Result<(), Error> {
    // Admin 권한 필요
    Ok(())
}

// ✅ 사용 예시
fn permission_example() {
    let readonly = Permission::read_only("user1".to_string());
    let readwrite = Permission::read_write("user2".to_string());
    let admin = Permission::admin("admin1".to_string());

    view_document(&readonly, "doc1"); // ✅ OK
    // edit_document(&readonly, "doc1", "content"); // ❌ 컴파일 에러

    edit_document(&readwrite, "doc1", "content"); // ✅ OK
    // delete_document(&readwrite, "doc1"); // ❌ 컴파일 에러

    delete_document(&admin, "doc1"); // ✅ OK
}
```

## 6. 단계별 프로세스

```rust
pub struct OrderProcess<Stage> {
    order_id: String,
    _stage: PhantomData<Stage>,
}

pub struct Created;
pub struct PaymentProcessed;
pub struct Shipped;
pub struct Delivered;

impl OrderProcess<Created> {
    pub fn create(order_id: String) -> Self {
        Self {
            order_id,
            _stage: PhantomData,
        }
    }

    pub fn process_payment(self) -> Result<OrderProcess<PaymentProcessed>, PaymentError> {
        println!("Processing payment for order {}", self.order_id);
        Ok(OrderProcess {
            order_id: self.order_id,
            _stage: PhantomData,
        })
    }
}

impl OrderProcess<PaymentProcessed> {
    pub fn ship(self) -> OrderProcess<Shipped> {
        println!("Shipping order {}", self.order_id);
        OrderProcess {
            order_id: self.order_id,
            _stage: PhantomData,
        }
    }
}

impl OrderProcess<Shipped> {
    pub fn deliver(self) -> OrderProcess<Delivered> {
        println!("Delivering order {}", self.order_id);
        OrderProcess {
            order_id: self.order_id,
            _stage: PhantomData,
        }
    }
}

impl OrderProcess<Delivered> {
    pub fn complete(self) -> String {
        println!("Order {} completed", self.order_id);
        self.order_id
    }
}

// ✅ 정해진 순서대로만 진행 가능
fn order_example() -> Result<(), PaymentError> {
    let order = OrderProcess::create("ORD-001".to_string());
    let order = order.process_payment()?;
    let order = order.ship();
    let order = order.deliver();
    let order_id = order.complete();

    // ❌ 단계를 건너뛸 수 없음
    // let order = OrderProcess::create("ORD-002".to_string());
    // let order = order.ship(); // 컴파일 에러

    Ok(())
}
```

## 체크리스트

타입 주도 설계 체크리스트:

- [ ] 모순된 상태 조합이 타입으로 불가능하게 만들어졌는가?
- [ ] Boolean 플래그 대신 enum 사용
- [ ] Optional 필드들이 서로 관련 있으면 enum으로 묶기
- [ ] 상태 전이를 타입으로 표현
- [ ] Builder에 필수 필드를 타입으로 강제
- [ ] 권한/단계를 타입 파라미터로 표현
- [ ] API가 잘못된 사용을 컴파일 타임에 방지
- [ ] PhantomData로 런타임 오버헤드 없음을 확인

## 참고 자료

- [Making Impossible States Impossible](https://www.youtube.com/watch?v=IcgmSRJHu_8)
- [Type-Driven Development](https://blog.ploeh.dk/2015/08/10/type-driven-development/)
- [The Typestate Pattern in Rust](http://cliffle.com/blog/rust-typestate/)
