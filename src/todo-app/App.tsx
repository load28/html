import React, { useState, useMemo } from 'react';
import type { Todo, FilterType } from './types';
import './styles.css';

/**
 * 선언형 프로그래밍으로 작성된 투두 앱
 *
 * 핵심 원칙:
 * 1. 상태는 불변성을 유지하며 변경
 * 2. UI는 상태에서 파생되어 자동으로 렌더링
 * 3. 함수형 프로그래밍 패러다임 사용 (map, filter)
 * 4. 선언적인 이벤트 핸들링
 */
export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  // 선언형: 필터링된 투두 리스트는 상태로부터 자동으로 계산됨
  const filteredTodos = useMemo(() => {
    const filterFunctions: Record<FilterType, (todo: Todo) => boolean> = {
      all: () => true,
      active: (todo) => !todo.completed,
      completed: (todo) => todo.completed,
    };

    return todos.filter(filterFunctions[filter]);
  }, [todos, filter]);

  // 선언형: 통계 정보는 상태로부터 자동으로 계산됨
  const stats = useMemo(() => ({
    total: todos.length,
    active: todos.filter(todo => !todo.completed).length,
    completed: todos.filter(todo => todo.completed).length,
  }), [todos]);

  // 순수 함수: 투두 추가 (불변성 유지)
  const addTodo = (text: string) => {
    if (!text.trim()) return;

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: text.trim(),
      completed: false,
      createdAt: new Date(),
    };

    setTodos(prevTodos => [...prevTodos, newTodo]);
    setInputValue('');
  };

  // 순수 함수: 투두 토글 (불변성 유지)
  const toggleTodo = (id: string) => {
    setTodos(prevTodos =>
      prevTodos.map(todo =>
        todo.id === id
          ? { ...todo, completed: !todo.completed }
          : todo
      )
    );
  };

  // 순수 함수: 투두 삭제 (불변성 유지)
  const deleteTodo = (id: string) => {
    setTodos(prevTodos => prevTodos.filter(todo => todo.id !== id));
  };

  // 순수 함수: 투두 수정 (불변성 유지)
  const editTodo = (id: string, newText: string) => {
    if (!newText.trim()) return;

    setTodos(prevTodos =>
      prevTodos.map(todo =>
        todo.id === id
          ? { ...todo, text: newText.trim() }
          : todo
      )
    );
  };

  // 순수 함수: 완료된 투두 모두 삭제 (불변성 유지)
  const clearCompleted = () => {
    setTodos(prevTodos => prevTodos.filter(todo => !todo.completed));
  };

  // 순수 함수: 모두 토글 (불변성 유지)
  const toggleAll = () => {
    const allCompleted = todos.every(todo => todo.completed);
    setTodos(prevTodos =>
      prevTodos.map(todo => ({ ...todo, completed: !allCompleted }))
    );
  };

  // 선언형 이벤트 핸들러
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTodo(inputValue);
  };

  return (
    <div className="todo-app">
      <header className="todo-header">
        <h1>투두 리스트</h1>
        <p className="subtitle">선언형 프로그래밍으로 작성된 투두 앱</p>
      </header>

      {/* 입력 폼 - 선언형 방식 */}
      <form onSubmit={handleSubmit} className="todo-form">
        <input
          type="text"
          className="todo-input"
          placeholder="할 일을 입력하세요..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          autoFocus
        />
        <button type="submit" className="add-button">
          추가
        </button>
      </form>

      {/* 통계 정보 - 상태로부터 자동 계산 */}
      <div className="stats">
        <span>전체: {stats.total}</span>
        <span>진행중: {stats.active}</span>
        <span>완료: {stats.completed}</span>
      </div>

      {/* 필터 버튼 - 선언형 방식 */}
      <div className="filters">
        {(['all', 'active', 'completed'] as FilterType[]).map(filterType => (
          <button
            key={filterType}
            className={`filter-button ${filter === filterType ? 'active' : ''}`}
            onClick={() => setFilter(filterType)}
          >
            {filterType === 'all' ? '전체' : filterType === 'active' ? '진행중' : '완료'}
          </button>
        ))}
      </div>

      {/* 액션 버튼 */}
      {todos.length > 0 && (
        <div className="actions">
          <button onClick={toggleAll} className="action-button">
            {todos.every(todo => todo.completed) ? '모두 미완료로' : '모두 완료로'}
          </button>
          {stats.completed > 0 && (
            <button onClick={clearCompleted} className="action-button danger">
              완료된 항목 삭제
            </button>
          )}
        </div>
      )}

      {/* 투두 리스트 - 선언형 렌더링 */}
      <ul className="todo-list">
        {filteredTodos.length === 0 ? (
          <li className="empty-message">
            {filter === 'all'
              ? '할 일이 없습니다. 새로운 할 일을 추가해보세요!'
              : filter === 'active'
              ? '진행중인 할 일이 없습니다.'
              : '완료된 할 일이 없습니다.'}
          </li>
        ) : (
          filteredTodos.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={toggleTodo}
              onDelete={deleteTodo}
              onEdit={editTodo}
            />
          ))
        )}
      </ul>
    </div>
  );
};

/**
 * 투두 아이템 컴포넌트 (선언형)
 */
interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(todo.text);

  const handleEdit = () => {
    if (isEditing) {
      onEdit(todo.id, editValue);
    }
    setIsEditing(!isEditing);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEdit();
    } else if (e.key === 'Escape') {
      setEditValue(todo.text);
      setIsEditing(false);
    }
  };

  return (
    <li className={`todo-item ${todo.completed ? 'completed' : ''}`}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        className="todo-checkbox"
      />

      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleEdit}
          className="todo-edit-input"
          autoFocus
        />
      ) : (
        <span
          className="todo-text"
          onDoubleClick={() => !todo.completed && setIsEditing(true)}
        >
          {todo.text}
        </span>
      )}

      <div className="todo-actions">
        {!todo.completed && (
          <button
            onClick={handleEdit}
            className="edit-button"
            title="수정"
          >
            ✏️
          </button>
        )}
        <button
          onClick={() => onDelete(todo.id)}
          className="delete-button"
          title="삭제"
        >
          🗑️
        </button>
      </div>
    </li>
  );
};
