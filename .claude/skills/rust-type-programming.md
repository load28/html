# Rust Enterprise Type Programming Guide

엔터프라이즈급 러스트 타입 프로그래밍을 위한 엄격한 가이드입니다.

## 원칙

- **타입 안전성 우선**: 컴파일 타임에 최대한 많은 에러를 잡습니다
- **명시적 타입**: 타입 추론에 의존하기보다 명시적으로 선언합니다
- **불변성 기본**: 가변성은 명시적으로만 사용합니다
- **에러 타입화**: 모든 에러를 타입으로 표현합니다
- **헥사고날 아키텍처**: 도메인 중심의 계층화된 구조를 사용합니다

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

### 7. 헥사고날 아키텍처
[가이드 문서](.claude/skills/rust-type-programming/guides/hexagonal-architecture.md)

핵심 주제:
- Domain/Application/Adapters 계층 구조
- Ports (트레이트)와 Adapters (구현체)
- 의존성 역전 원칙
- 테스트 가능한 설계
- 타입 안전한 의존성 주입

## 프로젝트 아키텍처

**모든 엔터프라이즈 프로젝트는 헥사고날 아키텍처를 따라야 합니다.**

```
src/
├── domain/           # 핵심 비즈니스 로직 (외부 의존성 없음)
├── application/      # 유스케이스 & 포트 (트레이트)
└── adapters/         # 어댑터 구현 (HTTP, DB, 외부 서비스)
```

핵심 규칙:
- Domain은 순수 러스트 코드 (외부 크레이트 의존 최소화)
- Ports는 트레이트로 정의
- Adapters는 교체 가능하도록 설계
- 의존성 방향: Adapters → Application → Domain

## 코드 리뷰 체크리스트

### 타입 안전성
- [ ] 모든 공개 함수에 명시적 타입 선언
- [ ] unwrap() 대신 적절한 에러 핸들링
- [ ] Newtype으로 도메인 타입 래핑
- [ ] 가변 참조 최소화
- [ ] 트레이트 바운드 명시
- [ ] 라이프타임 파라미터 문서화
- [ ] panic 발생 가능성 문서화
- [ ] 타입 불변조건 주석 작성

### 아키텍처
- [ ] Domain 계층에 외부 의존성 없음
- [ ] Ports는 트레이트로 정의됨
- [ ] Adapters는 교체 가능하도록 설계됨
- [ ] 의존성 방향이 올바름 (외부 → 내부)
- [ ] 각 계층의 에러 타입이 분리됨
- [ ] 유스케이스가 단일 책임 원칙 준수
- [ ] 도메인 로직이 엔티티/값 객체에 위치

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

### 새 프로젝트 시작 시

1. **아키텍처 구조 설정**
   - `src/domain`, `src/application`, `src/adapters` 디렉토리 생성
   - 각 계층의 역할 명확히 정의

2. **도메인 계층부터 설계**
   - 엔티티와 값 객체 정의
   - 도메인 에러 타입 정의
   - 비즈니스 규칙을 타입으로 표현

3. **포트 정의**
   - 필요한 저장소/서비스를 트레이트로 정의
   - 입력/출력 포트 분리

4. **유스케이스 구현**
   - 포트에만 의존하는 비즈니스 로직 작성
   - 각 유스케이스는 단일 책임

5. **어댑터 구현**
   - 실제 구현체 작성 (DB, HTTP 등)
   - 테스트용 Mock 구현체도 함께 작성

6. **타입 안전성 검증**
   - 컴파일러가 불가능한 상태를 거부하는지 확인
   - 모든 에러가 타입으로 표현되는지 확인

### 기존 프로젝트 리팩토링 시

1. 도메인 로직 추출
2. 트레이트로 인터페이스 정의
3. 점진적으로 계층 분리
4. 테스트로 안전성 확보
