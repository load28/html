# 소유권 & 라이프타임 가이드

## 개요

소유권과 라이프타임은 러스트의 메모리 안전성을 보장하는 핵심 개념입니다.
엔터프라이즈 코드에서는 명시적이고 예측 가능한 소유권 관리가 중요합니다.

## 원칙

1. **소유권 명확화**: 누가 데이터를 소유하는지 항상 명확해야 함
2. **차용 최소화**: 불필요한 차용을 피하고 소유권 이전을 고려
3. **라이프타임 명시**: 컴파일러 추론에 의존하지 말고 명시적으로 선언
4. **불변성 우선**: 가변 차용은 꼭 필요한 경우에만

## 1. 소유권 패턴

### 소유권 vs 차용

```rust
// ❌ 불필요한 차용
fn process_string(s: &String) -> usize {
    s.len()
}

// ✅ &str로 더 유연하게
fn process_string(s: &str) -> usize {
    s.len()
}

// ❌ 소유권 이전 후 다시 사용
fn bad_ownership() {
    let s = String::from("hello");
    let len = consume_string(s);
    // println!("{}", s); // 컴파일 에러
}

fn consume_string(s: String) -> usize {
    s.len()
}

// ✅ 차용으로 해결
fn good_ownership() {
    let s = String::from("hello");
    let len = borrow_string(&s);
    println!("{}", s); // OK
}

fn borrow_string(s: &str) -> usize {
    s.len()
}
```

### Builder 패턴의 소유권

```rust
pub struct RequestBuilder {
    url: String,
    headers: Vec<(String, String)>,
    body: Option<Vec<u8>>,
}

impl RequestBuilder {
    pub fn new(url: String) -> Self {
        Self {
            url,
            headers: Vec::new(),
            body: None,
        }
    }

    // self를 소유하여 체이닝 가능
    pub fn header(mut self, key: String, value: String) -> Self {
        self.headers.push((key, value));
        self
    }

    // self를 소유하여 체이닝 가능
    pub fn body(mut self, body: Vec<u8>) -> Self {
        self.body = Some(body);
        self
    }

    // 최종적으로 소유권 이전
    pub fn build(self) -> Request {
        Request {
            url: self.url,
            headers: self.headers,
            body: self.body,
        }
    }
}

pub struct Request {
    url: String,
    headers: Vec<(String, String)>,
    body: Option<Vec<u8>>,
}

// ✅ 사용
fn use_builder() {
    let request = RequestBuilder::new("https://api.example.com".to_string())
        .header("Content-Type".to_string(), "application/json".to_string())
        .body(b"{}".to_vec())
        .build();
}
```

## 2. 명시적 라이프타임

### 기본 라이프타임 명시

```rust
// ❌ 라이프타임 생략 (컴파일러 추론)
fn first_word(s: &str) -> &str {
    s.split_whitespace().next().unwrap_or("")
}

// ✅ 명시적 라이프타임
fn first_word<'a>(s: &'a str) -> &'a str {
    s.split_whitespace().next().unwrap_or("")
}
```

### 구조체의 라이프타임

```rust
// 참조를 포함하는 구조체는 항상 라이프타임 명시
pub struct UserView<'a> {
    name: &'a str,
    email: &'a str,
    created_at: &'a str,
}

impl<'a> UserView<'a> {
    pub fn new(name: &'a str, email: &'a str, created_at: &'a str) -> Self {
        Self {
            name,
            email,
            created_at,
        }
    }

    pub fn display(&self) -> String {
        format!("{} <{}>", self.name, self.email)
    }
}

// ✅ 사용
fn use_view() {
    let name = String::from("John");
    let email = String::from("john@example.com");
    let created = String::from("2024-01-01");

    let view = UserView::new(&name, &email, &created);
    println!("{}", view.display());
}
```

### 복잡한 라이프타임 관계

```rust
// 여러 라이프타임 파라미터
pub struct Context<'short, 'long: 'short> {
    // 'long은 'short보다 오래 살아야 함
    config: &'long Config,
    request: &'short Request,
}

impl<'short, 'long: 'short> Context<'short, 'long> {
    pub fn new(config: &'long Config, request: &'short Request) -> Self {
        Self { config, request }
    }

    pub fn process(&self) -> Response {
        // config와 request 모두 사용 가능
        Response::default()
    }
}

pub struct Config {
    max_connections: usize,
}

pub struct Request {
    path: String,
}

#[derive(Default)]
pub struct Response {
    status: u16,
}
```

### 정적 라이프타임

```rust
// 'static은 프로그램 전체 수명
pub const APP_NAME: &'static str = "MyApp";

pub struct AppConfig {
    // 'static 문자열 리터럴
    name: &'static str,
    version: &'static str,
}

impl AppConfig {
    pub const fn new() -> Self {
        Self {
            name: "MyApp",
            version: "1.0.0",
        }
    }
}

// ⚠️ 'static을 요구하는 것은 신중히
pub fn register_callback(f: Box<dyn Fn() + 'static>) {
    // 콜백이 프로그램 종료까지 살아야 함
}
```

## 3. 스마트 포인터

### Box<T> - 힙 할당

```rust
// ✅ 재귀 타입
pub enum List {
    Cons(i32, Box<List>),
    Nil,
}

// ✅ 큰 데이터 이동
pub struct LargeData {
    buffer: [u8; 1024 * 1024], // 1MB
}

pub fn process_large_data() -> Box<LargeData> {
    // 스택 오버플로우 방지
    Box::new(LargeData {
        buffer: [0; 1024 * 1024],
    })
}

// ✅ Trait Object
pub trait Handler {
    fn handle(&self, request: &Request) -> Response;
}

pub struct Router {
    handlers: Vec<Box<dyn Handler>>,
}

impl Router {
    pub fn add_handler(&mut self, handler: Box<dyn Handler>) {
        self.handlers.push(handler);
    }
}
```

### Rc<T> - 참조 카운팅 (단일 스레드)

```rust
use std::rc::Rc;

pub struct Node {
    value: i32,
    children: Vec<Rc<Node>>,
}

impl Node {
    pub fn new(value: i32) -> Rc<Self> {
        Rc::new(Self {
            value,
            children: Vec::new(),
        })
    }

    pub fn add_child(self: &mut Rc<Self>, child: Rc<Node>) {
        // Rc::get_mut는 참조 카운트가 1일 때만 성공
        if let Some(node) = Rc::get_mut(self) {
            node.children.push(child);
        }
    }
}

// ✅ 그래프 구조
fn use_rc() {
    let root = Node::new(1);
    let child1 = Node::new(2);
    let child2 = Node::new(3);

    // 여러 부모가 같은 자식을 가리킬 수 있음
    let shared_child = Node::new(4);

    // root가 child1, child2를 소유
    // child1과 child2가 shared_child를 공유
}
```

### Arc<T> - 원자적 참조 카운팅 (멀티 스레드)

```rust
use std::sync::Arc;
use std::thread;

pub struct SharedConfig {
    pub api_key: String,
    pub timeout: u64,
}

pub fn use_arc() {
    let config = Arc::new(SharedConfig {
        api_key: "secret".to_string(),
        timeout: 30,
    });

    let mut handles = vec![];

    for i in 0..3 {
        let config_clone = Arc::clone(&config);
        let handle = thread::spawn(move || {
            println!("Thread {} using API key: {}", i, config_clone.api_key);
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }
}
```

### RefCell<T> - 내부 가변성 (Interior Mutability)

```rust
use std::cell::RefCell;

pub struct Logger {
    logs: RefCell<Vec<String>>,
}

impl Logger {
    pub fn new() -> Self {
        Self {
            logs: RefCell::new(Vec::new()),
        }
    }

    // &self인데도 내부 수정 가능
    pub fn log(&self, message: String) {
        self.logs.borrow_mut().push(message);
    }

    pub fn get_logs(&self) -> Vec<String> {
        self.logs.borrow().clone()
    }
}

// ⚠️ RefCell은 런타임 차용 규칙 검사
// 동시에 가변/불변 차용하면 panic
fn refcell_panic() {
    let logger = Logger::new();
    let logs_ref = logger.logs.borrow(); // 불변 차용

    // panic! 동시에 가변 차용 시도
    // logger.log("error".to_string());

    drop(logs_ref); // 불변 차용 종료
    logger.log("error".to_string()); // OK
}
```

### Cow<T> - Clone on Write

```rust
use std::borrow::Cow;

pub fn process_string(input: &str) -> Cow<str> {
    if input.contains("bad") {
        // 수정 필요 - 소유된 String 생성
        Cow::Owned(input.replace("bad", "good"))
    } else {
        // 수정 불필요 - 차용만
        Cow::Borrowed(input)
    }
}

// ✅ 효율적인 조건부 복사
fn use_cow() {
    let s1 = "hello world";
    let result1 = process_string(s1); // 차용만, 복사 없음

    let s2 = "bad word";
    let result2 = process_string(s2); // 복사 발생

    println!("{}", result1);
    println!("{}", result2);
}
```

## 4. 스마트 포인터 조합

### Arc<Mutex<T>> - 공유 가변 상태

```rust
use std::sync::{Arc, Mutex};
use std::thread;

pub struct Counter {
    value: Arc<Mutex<i32>>,
}

impl Counter {
    pub fn new() -> Self {
        Self {
            value: Arc::new(Mutex::new(0)),
        }
    }

    pub fn increment(&self) {
        let mut value = self.value.lock().unwrap();
        *value += 1;
    }

    pub fn get(&self) -> i32 {
        *self.value.lock().unwrap()
    }

    pub fn clone_handle(&self) -> Self {
        Self {
            value: Arc::clone(&self.value),
        }
    }
}

fn use_arc_mutex() {
    let counter = Counter::new();
    let mut handles = vec![];

    for _ in 0..10 {
        let counter_clone = counter.clone_handle();
        let handle = thread::spawn(move || {
            counter_clone.increment();
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    println!("Final count: {}", counter.get()); // 10
}
```

### Arc<RwLock<T>> - 읽기 우선 잠금

```rust
use std::sync::{Arc, RwLock};
use std::thread;

pub struct Cache {
    data: Arc<RwLock<std::collections::HashMap<String, String>>>,
}

impl Cache {
    pub fn new() -> Self {
        Self {
            data: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }

    pub fn get(&self, key: &str) -> Option<String> {
        let data = self.data.read().unwrap();
        data.get(key).cloned()
    }

    pub fn set(&self, key: String, value: String) {
        let mut data = self.data.write().unwrap();
        data.insert(key, value);
    }

    pub fn clone_handle(&self) -> Self {
        Self {
            data: Arc::clone(&self.data),
        }
    }
}

fn use_rwlock() {
    let cache = Cache::new();

    // 쓰기 스레드
    {
        let cache_clone = cache.clone_handle();
        thread::spawn(move || {
            cache_clone.set("key1".to_string(), "value1".to_string());
        });
    }

    // 여러 읽기 스레드 (동시 실행 가능)
    for i in 0..5 {
        let cache_clone = cache.clone_handle();
        thread::spawn(move || {
            if let Some(value) = cache_clone.get("key1") {
                println!("Thread {}: {}", i, value);
            }
        });
    }
}
```

### Rc<RefCell<T>> - 단일 스레드 공유 가변성

```rust
use std::rc::Rc;
use std::cell::RefCell;

pub struct Graph {
    nodes: Vec<Rc<RefCell<Node>>>,
}

pub struct Node {
    value: i32,
    neighbors: Vec<Rc<RefCell<Node>>>,
}

impl Node {
    pub fn new(value: i32) -> Rc<RefCell<Self>> {
        Rc::new(RefCell::new(Self {
            value,
            neighbors: Vec::new(),
        }))
    }

    pub fn add_neighbor(&mut self, neighbor: Rc<RefCell<Node>>) {
        self.neighbors.push(neighbor);
    }
}

impl Graph {
    pub fn new() -> Self {
        Self { nodes: Vec::new() }
    }

    pub fn add_edge(&mut self, from: Rc<RefCell<Node>>, to: Rc<RefCell<Node>>) {
        from.borrow_mut().add_neighbor(Rc::clone(&to));
    }
}

fn use_graph() {
    let mut graph = Graph::new();

    let node1 = Node::new(1);
    let node2 = Node::new(2);
    let node3 = Node::new(3);

    graph.add_edge(Rc::clone(&node1), Rc::clone(&node2));
    graph.add_edge(Rc::clone(&node2), Rc::clone(&node3));
    graph.add_edge(Rc::clone(&node3), Rc::clone(&node1)); // 순환 참조
}
```

## 5. 선택 가이드

```rust
// ✅ 단일 소유권
struct Data {
    value: String, // 소유
}

// ✅ 차용 (짧은 수명)
fn process(data: &Data) {
    // 임시로 사용
}

// ✅ Box - 힙 할당, 큰 데이터, Trait Object
fn use_box() -> Box<dyn std::error::Error> {
    Box::new(std::io::Error::new(std::io::ErrorKind::Other, "error"))
}

// ✅ Rc - 단일 스레드 공유 소유권
use std::rc::Rc;
fn use_rc_data(data: Rc<Data>) {
    let clone = Rc::clone(&data);
    // 여러 곳에서 공유
}

// ✅ Arc - 멀티 스레드 공유 소유권
use std::sync::Arc;
fn use_arc_data(data: Arc<Data>) {
    let clone = Arc::clone(&data);
    std::thread::spawn(move || {
        // 스레드 간 공유
    });
}

// ✅ RefCell - 단일 스레드 내부 가변성
use std::cell::RefCell;
struct Container {
    data: RefCell<Vec<String>>,
}

// ✅ Mutex - 멀티 스레드 가변성
use std::sync::Mutex;
struct ThreadSafeContainer {
    data: Mutex<Vec<String>>,
}

// ✅ RwLock - 읽기 많고 쓰기 적을 때
use std::sync::RwLock;
struct ReadHeavyContainer {
    data: RwLock<Vec<String>>,
}
```

## 6. 안티패턴

```rust
// ❌ 불필요한 clone
fn bad_clone() {
    let s = String::from("hello");
    process_owned(s.clone()); // 불필요한 복사
    println!("{}", s);
}

fn process_owned(s: String) {
    println!("{}", s);
}

// ✅ 차용 사용
fn good_borrow() {
    let s = String::from("hello");
    process_borrowed(&s); // 복사 없음
    println!("{}", s);
}

fn process_borrowed(s: &str) {
    println!("{}", s);
}

// ❌ 과도한 RefCell
struct BadDesign {
    field1: RefCell<i32>,
    field2: RefCell<String>,
    field3: RefCell<Vec<u8>>,
}

// ✅ 전체를 RefCell로
struct GoodDesign {
    inner: RefCell<Inner>,
}

struct Inner {
    field1: i32,
    field2: String,
    field3: Vec<u8>,
}

// ❌ Arc 남용
fn bad_arc() {
    let data = Arc::new(42);
    process_arc(Arc::clone(&data)); // 단일 스레드인데 Arc 사용
}

fn process_arc(data: Arc<i32>) {
    println!("{}", data);
}

// ✅ 그냥 참조
fn good_ref() {
    let data = 42;
    process_ref(&data);
}

fn process_ref(data: &i32) {
    println!("{}", data);
}
```

## 체크리스트

소유권 & 라이프타임 체크리스트:

- [ ] 소유권 이전 vs 차용을 명확히 선택
- [ ] &String 대신 &str 사용
- [ ] &Vec<T> 대신 &[T] 사용
- [ ] 라이프타임은 명시적으로 선언
- [ ] Clone은 정말 필요할 때만
- [ ] 스마트 포인터는 적재적소에
- [ ] RefCell/Mutex는 꼭 필요한 경우만
- [ ] 순환 참조 주의 (Weak 사용 고려)

## 참고 자료

- [Rust Book - Ownership](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html)
- [Rust Book - Lifetimes](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html)
- [Rust Book - Smart Pointers](https://doc.rust-lang.org/book/ch15-00-smart-pointers.html)
- [Too Many Lists](https://rust-unofficial.github.io/too-many-lists/)
