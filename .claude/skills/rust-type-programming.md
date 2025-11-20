# Rust Enterprise Type Programming Guide

엔터프라이즈급 러스트 타입 프로그래밍을 위한 엄격한 가이드입니다.

## 원칙

- **타입 안전성 우선**: 컴파일 타임에 최대한 많은 에러를 잡습니다
- **명시적 타입**: 타입 추론에 의존하기보다 명시적으로 선언합니다
- **불변성 기본**: 가변성은 명시적으로만 사용합니다
- **에러 타입화**: 모든 에러를 타입으로 표현합니다

## 가이드 레퍼런스

### 1. 타입 안전성
[가이드 문서](.claude/skills/rust-type-programming/guides/type-safety.md)

핵심 주제:
- Newtype 패턴으로 타입 레벨 보장
- Phantom Types로 상태 타입화
- 타입 레벨 불변조건 표현
- Zero-cost abstractions

### 2. 에러 핸들링
[가이드 문서](.claude/skills/rust-type-programming/guides/error-handling.md)

핵심 주제:
- 커스텀 에러 타입 설계
- thiserror와 anyhow 활용
- Result 타입 체이닝
- 에러 컨텍스트 전파

### 3. 타입 주도 설계
[가이드 문서](.claude/skills/rust-type-programming/guides/type-driven-design.md)

핵심 주제:
- 불가능한 상태를 표현 불가능하게
- Builder 패턴의 타입 상태
- Typestate 패턴
- API 설계 시 타입 활용

### 4. 제네릭 & 트레이트
[가이드 문서](.claude/skills/rust-type-programming/guides/generics-traits.md)

핵심 주제:
- 트레이트 바운드 설계
- Associated Types vs Generic Parameters
- Trait Objects vs Static Dispatch
- 고급 트레이트 패턴

### 5. 스마트 포인터 & 라이프타임
[가이드 문서](.claude/skills/rust-type-programming/guides/ownership-lifetimes.md)

핵심 주제:
- 라이프타임 명시적 선언
- 스마트 포인터 선택 가이드
- Interior Mutability 패턴
- Arc, Rc, RefCell 활용

### 6. 매크로 & 코드 생성
[가이드 문서](.claude/skills/rust-type-programming/guides/macros-codegen.md)

핵심 주제:
- Derive 매크로 활용
- Procedural 매크로 패턴
- 타입 안전한 DSL 설계
- compile_error! 활용

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

## 금지 패턴

다음 패턴은 엔터프라이즈 코드에서 피해야 합니다:

```rust
// ❌ 타입 숨김
fn process(data: &str) -> String

// ✅ 명시적 타입
fn process(data: UserId) -> Result<UserProfile, ProcessError>

// ❌ unwrap 남용
let value = result.unwrap();

// ✅ 명시적 에러 처리
let value = result.map_err(|e| ProcessError::from(e))?;

// ❌ 프리미티브 타입 직접 사용
fn transfer(amount: f64, account: String)

// ✅ Newtype 사용
fn transfer(amount: Money, account: AccountId) -> Result<Receipt, TransferError>
```

## 적용 방법

이 가이드를 코드에 적용할 때:

1. 먼저 도메인 타입 정의부터 시작
2. 에러 타입을 명시적으로 설계
3. 공개 API의 타입 시그니처 먼저 작성
4. 구현은 타입이 강제하는 대로
5. 컴파일러가 불가능한 상태를 거부하도록
