# 선언형 투두 앱 (Declarative Todo App)

React와 TypeScript로 작성된 선언형 프로그래밍 패러다임을 따르는 투두 애플리케이션입니다.

## 🎯 선언형 프로그래밍이란?

선언형 프로그래밍은 **"어떻게(How)"** 보다 **"무엇을(What)"** 에 집중하는 프로그래밍 패러다임입니다.

### 명령형 vs 선언형 비교

#### 명령형 프로그래밍 (Imperative)
```typescript
// 어떻게 할지를 단계별로 명시
const filteredTodos = [];
for (let i = 0; i < todos.length; i++) {
  if (todos[i].completed === false) {
    filteredTodos.push(todos[i]);
  }
}
```

#### 선언형 프로그래밍 (Declarative)
```typescript
// 무엇을 원하는지만 명시
const filteredTodos = todos.filter(todo => !todo.completed);
```

## 🌟 이 앱의 선언형 특징

### 1. 상태 기반 UI 렌더링
UI는 상태(state)로부터 자동으로 파생됩니다.
```typescript
const filteredTodos = useMemo(() => {
  return todos.filter(filterFunctions[filter]);
}, [todos, filter]);
```

### 2. 불변성(Immutability) 유지
상태를 직접 변경하지 않고 새로운 상태를 생성합니다.
```typescript
// ❌ 명령형 (직접 변경)
todos[0].completed = true;

// ✅ 선언형 (새로운 객체 생성)
setTodos(prevTodos =>
  prevTodos.map(todo =>
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  )
);
```

### 3. 순수 함수(Pure Functions)
부작용 없이 입력에 대한 출력만 반환합니다.
```typescript
const toggleTodo = (id: string) => {
  setTodos(prevTodos =>
    prevTodos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    )
  );
};
```

### 4. 선언적 데이터 변환
배열 메서드(map, filter, reduce)를 활용한 데이터 처리
```typescript
const stats = useMemo(() => ({
  total: todos.length,
  active: todos.filter(todo => !todo.completed).length,
  completed: todos.filter(todo => todo.completed).length,
}), [todos]);
```

### 5. 컴포넌트 기반 구조
UI를 재사용 가능한 컴포넌트로 분리
```typescript
<TodoItem
  key={todo.id}
  todo={todo}
  onToggle={toggleTodo}
  onDelete={deleteTodo}
  onEdit={editTodo}
/>
```

## 🚀 실행 방법

### 개발 모드
```bash
yarn dev:todo
```

### 프로덕션 빌드
```bash
yarn build:todo
```

## 📋 기능

- ✅ 투두 추가/수정/삭제
- ✅ 완료 상태 토글
- ✅ 필터링 (전체/진행중/완료)
- ✅ 통계 표시
- ✅ 모두 완료/미완료 전환
- ✅ 완료된 항목 일괄 삭제
- ✅ 더블 클릭으로 수정
- ✅ 반응형 디자인

## 🎨 기술 스택

- **React 19** - UI 라이브러리
- **TypeScript** - 타입 안정성
- **CSS3** - 스타일링
- **Parcel** - 번들러

## 📁 프로젝트 구조

```
src/todo-app/
├── index.html      # HTML 진입점
├── index.tsx       # React 진입점
├── App.tsx         # 메인 앱 컴포넌트
├── types.ts        # TypeScript 타입 정의
├── styles.css      # 스타일
└── README.md       # 문서
```

## 🎓 학습 포인트

이 프로젝트를 통해 다음을 학습할 수 있습니다:

1. **React Hooks** - useState, useMemo
2. **함수형 프로그래밍** - map, filter, every
3. **불변성** - 스프레드 연산자, 배열 메서드
4. **TypeScript** - 타입 정의, 제네릭
5. **선언형 UI** - 상태 기반 렌더링

## 💡 선언형 프로그래밍의 장점

1. **가독성** - 코드가 더 읽기 쉽고 이해하기 쉬움
2. **유지보수성** - 로직이 명확하여 수정이 용이
3. **테스트 용이성** - 순수 함수는 테스트하기 쉬움
4. **버그 감소** - 불변성으로 인한 예측 가능한 동작
5. **병렬 처리** - 부작용이 없어 병렬 처리 가능

## 📚 참고 자료

- [React 공식 문서](https://react.dev/)
- [함수형 프로그래밍 소개](https://en.wikipedia.org/wiki/Functional_programming)
- [선언형 프로그래밍](https://en.wikipedia.org/wiki/Declarative_programming)
