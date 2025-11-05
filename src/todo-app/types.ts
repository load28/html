/**
 * 투두 아이템 타입 정의
 */
export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

/**
 * 필터 타입
 */
export type FilterType = 'all' | 'active' | 'completed';
