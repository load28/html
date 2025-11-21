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

### 6. 헥사고날 아키텍처
[가이드 문서](.claude/skills/rust-type-programming/guides/hexagonal-architecture.md)

핵심 주제:
- Ports and Adapters 패턴
- 도메인 중심 설계
- 트레이트 기반 의존성 역전
- 레이어별 책임 분리
- Cargo 워크스페이스 구조

### 7. 코딩 컨벤션
[가이드 문서](.claude/skills/rust-type-programming/guides/conventions.md)

핵심 주제:
- 타입 선언 규칙
- 에러 처리 규칙
- 불변성 규칙
- 문서화 규칙
- 네이밍 및 모듈 구조
