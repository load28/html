// API 설정
const API_BASE_URL = 'http://localhost:3000/api';
const CURRENT_USER_ID = 1; // 데모용 사용자 ID

// 검색 엔진 타입
type SearchEngine = 'elasticsearch' | 'postgresql';

// 상태 관리
interface AppState {
  searchEngine: SearchEngine;
  query: string;
  selectedTags: string[];
  dateFrom: string;
  dateTo: string;
  sortBy: 'relevance' | 'date' | 'popularity';
  fuzzySearch: boolean;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  hasMore: boolean;
}

const state: AppState = {
  searchEngine: 'elasticsearch',
  query: '',
  selectedTags: [],
  dateFrom: '',
  dateTo: '',
  sortBy: 'relevance',
  fuzzySearch: true,
  currentPage: 1,
  totalPages: 1,
  isLoading: false,
  hasMore: false,
};

// DOM 요소
const searchEngineSelect = document.getElementById('searchEngine') as HTMLSelectElement;
const fuzzySearchCheckbox = document.getElementById('fuzzySearch') as HTMLInputElement;
const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const suggestionsEl = document.getElementById('suggestions') as HTMLElement;
const searchStatsEl = document.getElementById('searchStats') as HTMLElement;
const filterToggle = document.getElementById('filterToggle') as HTMLButtonElement;
const trendingToggle = document.getElementById('trendingToggle') as HTMLButtonElement;
const filterPanel = document.getElementById('filterPanel') as HTMLElement;
const trendingPanel = document.getElementById('trendingPanel') as HTMLElement;
const trendingList = document.getElementById('trendingList') as HTMLElement;
const filterCount = document.getElementById('filterCount') as HTMLElement;
const sortBySelect = document.getElementById('sortBy') as HTMLSelectElement;
const popularTagsEl = document.getElementById('popularTags') as HTMLElement;
const selectedTagsEl = document.getElementById('selectedTags') as HTMLElement;
const dateFromInput = document.getElementById('dateFrom') as HTMLInputElement;
const dateToInput = document.getElementById('dateTo') as HTMLInputElement;
const applyFiltersBtn = document.getElementById('applyFilters') as HTMLButtonElement;
const clearFiltersBtn = document.getElementById('clearFilters') as HTMLButtonElement;
const loadingEl = document.getElementById('loading') as HTMLElement;
const resultsInfoEl = document.getElementById('resultsInfo') as HTMLElement;
const resultsEl = document.getElementById('results') as HTMLElement;
const loadMoreEl = document.getElementById('loadMore') as HTMLElement;
const loadMoreBtn = document.getElementById('loadMoreBtn') as HTMLButtonElement;
const emptyStateEl = document.getElementById('emptyState') as HTMLElement;

/**
 * 디바운스 함수 (성능 최적화)
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return function (this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * API 호출 함수
 */
async function fetchAPI(endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.append(key, value.toString());
      }
    }
  });

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

/**
 * 게시물 검색 (Elasticsearch 또는 PostgreSQL)
 */
async function searchPosts(loadMore: boolean = false) {
  if (state.isLoading) return;

  state.isLoading = true;
  showLoading(true);

  if (!loadMore) {
    state.currentPage = 1;
    resultsEl.innerHTML = '';
  }

  const startTime = Date.now();

  try {
    const baseEndpoint =
      state.searchEngine === 'elasticsearch' ? '/es/search/posts' : '/search/posts';

    const params: Record<string, any> = {
      userId: CURRENT_USER_ID,
      query: state.query,
      tags: state.selectedTags,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      page: state.currentPage,
      limit: 20,
    };

    // Elasticsearch 전용 파라미터
    if (state.searchEngine === 'elasticsearch') {
      params.sortBy = state.sortBy;
      params.fuzzy = state.fuzzySearch;
    }

    const response = await fetchAPI(baseEndpoint, params);

    if (response.success) {
      const { posts, total, totalPages, hasMore, searchTime, maxScore } =
        response.data;

      state.totalPages = totalPages;
      state.hasMore = hasMore;

      const clientTime = Date.now() - startTime;

      if (posts.length === 0 && !loadMore) {
        showEmptyState(true);
        showResultsInfo(false);
        hideSearchStats();
      } else {
        showEmptyState(false);
        displayPosts(posts, loadMore);
        updateResultsInfo(total);
        updateSearchStats(total, searchTime || clientTime, maxScore);
      }

      updateLoadMoreButton();
    }
  } catch (error) {
    console.error('Search failed:', error);
    alert('검색에 실패했습니다. 서버가 실행 중인지 확인해주세요.');
  } finally {
    state.isLoading = false;
    showLoading(false);
  }
}

/**
 * 게시물 표시
 */
function displayPosts(posts: any[], append: boolean = false) {
  const postsHTML = posts
    .map(
      (post) => `
    <div class="post-card">
      <div class="post-header">
        <img src="${post.user_avatar || '/default-avatar.jpg'}" alt="${
        post.user_name
      }" class="post-avatar" onerror="this.src='/default-avatar.jpg'" />
        <div class="post-author-info">
          <div class="post-author-name">${post.user_name}</div>
          <div class="post-date">${formatDate(post.created_at)}</div>
        </div>
        ${
          post._score
            ? `<div class="post-score" title="관련도 점수">⭐ ${post._score.toFixed(
                2
              )}</div>`
            : ''
        }
      </div>
      <h3 class="post-title">${highlightText(post.title || '제목 없음')}</h3>
      <p class="post-content">${highlightText(truncateText(post.content, 200))}</p>
      ${
        post.tags && post.tags.length > 0
          ? `<div class="post-tags">
          ${post.tags.map((tag: string) => `<span class="post-tag">#${tag}</span>`).join('')}
        </div>`
          : ''
      }
      <div class="post-stats">
        <span>❤️ ${post.likes_count}</span>
        <span>💬 ${post.comments_count}</span>
      </div>
    </div>
  `
    )
    .join('');

  if (append) {
    resultsEl.innerHTML += postsHTML;
  } else {
    resultsEl.innerHTML = postsHTML;
  }
}

/**
 * 하이라이팅 처리 (Elasticsearch 결과)
 */
function highlightText(text: string): string {
  // 이미 <mark> 태그가 있으면 그대로 사용
  if (text && text.includes('<mark>')) {
    return text;
  }
  return text || '';
}

/**
 * 인기 태그 로드
 */
async function loadPopularTags() {
  try {
    const endpoint =
      state.searchEngine === 'elasticsearch' ? '/es/search/tags' : '/search/tags';

    const response = await fetchAPI(endpoint, {
      userId: CURRENT_USER_ID,
      limit: 10,
    });

    if (response.success && response.data.length > 0) {
      displayPopularTags(response.data);
    }
  } catch (error) {
    console.error('Failed to load popular tags:', error);
  }
}

/**
 * 인기 태그 표시
 */
function displayPopularTags(tags: string[]) {
  popularTagsEl.innerHTML = tags
    .map((tag) => `<div class="tag" data-tag="${tag}">#${tag}</div>`)
    .join('');

  // 태그 클릭 이벤트
  popularTagsEl.querySelectorAll('.tag').forEach((tagEl) => {
    tagEl.addEventListener('click', () => {
      const tag = tagEl.getAttribute('data-tag')!;
      toggleTag(tag);
    });
  });

  updateSelectedTags();
}

/**
 * 태그 토글
 */
function toggleTag(tag: string) {
  const index = state.selectedTags.indexOf(tag);

  if (index > -1) {
    state.selectedTags.splice(index, 1);
  } else {
    state.selectedTags.push(tag);
  }

  updateSelectedTags();
  updateFilterCount();
}

/**
 * 선택된 태그 업데이트
 */
function updateSelectedTags() {
  if (state.selectedTags.length === 0) {
    selectedTagsEl.innerHTML =
      '<p style="color: #999;">선택된 태그가 없습니다</p>';
  } else {
    selectedTagsEl.innerHTML = state.selectedTags
      .map(
        (tag) => `
      <div class="selected-tag">
        <span>#${tag}</span>
        <span class="remove-tag" data-tag="${tag}">✕</span>
      </div>
    `
      )
      .join('');

    // 태그 제거 이벤트
    selectedTagsEl.querySelectorAll('.remove-tag').forEach((removeEl) => {
      removeEl.addEventListener('click', () => {
        const tag = removeEl.getAttribute('data-tag')!;
        toggleTag(tag);
      });
    });
  }

  // 인기 태그에도 선택 상태 반영
  popularTagsEl.querySelectorAll('.tag').forEach((tagEl) => {
    const tag = tagEl.getAttribute('data-tag')!;
    if (state.selectedTags.includes(tag)) {
      tagEl.classList.add('selected');
    } else {
      tagEl.classList.remove('selected');
    }
  });
}

/**
 * 자동완성 제안 표시 (Elasticsearch)
 */
const showSuggestions = debounce(async (query: string) => {
  if (query.length < 2 || state.searchEngine !== 'elasticsearch') {
    suggestionsEl.classList.add('hidden');
    return;
  }

  try {
    const response = await fetchAPI('/es/search/autocomplete', {
      userId: CURRENT_USER_ID,
      query,
      limit: 5,
    });

    if (response.success && response.data.length > 0) {
      suggestionsEl.innerHTML = response.data
        .map(
          (suggestion: string) =>
            `<div class="suggestion-item">${suggestion}</div>`
        )
        .join('');
      suggestionsEl.classList.remove('hidden');

      // 제안 클릭 이벤트
      suggestionsEl.querySelectorAll('.suggestion-item').forEach((item) => {
        item.addEventListener('click', () => {
          searchInput.value = item.textContent || '';
          state.query = searchInput.value;
          suggestionsEl.classList.add('hidden');
          searchPosts();
        });
      });
    } else {
      suggestionsEl.classList.add('hidden');
    }
  } catch (error) {
    console.error('Failed to get suggestions:', error);
  }
}, 300);

/**
 * 인기 검색어 로드 (Elasticsearch)
 */
async function loadTrendingSearches() {
  if (state.searchEngine !== 'elasticsearch') {
    trendingList.innerHTML = '<p>Elasticsearch 모드에서만 사용 가능합니다</p>';
    return;
  }

  try {
    const response = await fetchAPI('/es/search/trending', { limit: 10 });

    if (response.success && response.data.length > 0) {
      trendingList.innerHTML = response.data
        .map(
          (item: any) => `
        <div class="trending-item" data-query="${item.query}">
          <span class="trending-query">${item.query}</span>
          <span class="trending-count">${item.count}회</span>
        </div>
      `
        )
        .join('');

      // 클릭 이벤트
      trendingList.querySelectorAll('.trending-item').forEach((item) => {
        item.addEventListener('click', () => {
          const query = item.getAttribute('data-query')!;
          searchInput.value = query;
          state.query = query;
          trendingPanel.classList.add('hidden');
          searchPosts();
        });
      });
    } else {
      trendingList.innerHTML = '<p>최근 검색 기록이 없습니다</p>';
    }
  } catch (error) {
    console.error('Failed to load trending searches:', error);
    trendingList.innerHTML = '<p>인기 검색어를 불러올 수 없습니다</p>';
  }
}

/**
 * 검색 통계 업데이트
 */
function updateSearchStats(total: number, searchTime: number, maxScore?: number) {
  let statsHTML = `검색 시간: <strong>${searchTime}ms</strong>`;

  if (maxScore !== undefined) {
    statsHTML += ` | 최고 관련도: <strong>${maxScore.toFixed(2)}</strong>`;
  }

  statsHTML += ` | 엔진: <strong>${state.searchEngine === 'elasticsearch' ? 'Elasticsearch' : 'PostgreSQL'}</strong>`;

  searchStatsEl.innerHTML = statsHTML;
  searchStatsEl.classList.remove('hidden');
}

function hideSearchStats() {
  searchStatsEl.classList.add('hidden');
}

/**
 * 필터 개수 업데이트
 */
function updateFilterCount() {
  let count = 0;
  if (state.selectedTags.length > 0) count += state.selectedTags.length;
  if (state.dateFrom) count++;
  if (state.dateTo) count++;

  if (count > 0) {
    filterCount.textContent = `(${count})`;
    filterCount.style.display = 'inline';
  } else {
    filterCount.style.display = 'none';
  }
}

/**
 * 검색 결과 정보 업데이트
 */
function updateResultsInfo(total: number) {
  resultsInfoEl.textContent = `${total}개의 게시물을 찾았습니다`;
  showResultsInfo(true);
}

/**
 * 더 보기 버튼 업데이트
 */
function updateLoadMoreButton() {
  if (state.hasMore) {
    loadMoreEl.classList.remove('hidden');
  } else {
    loadMoreEl.classList.add('hidden');
  }
}

/**
 * UI 표시/숨김 함수들
 */
function showLoading(show: boolean) {
  loadingEl.classList.toggle('hidden', !show);
}

function showEmptyState(show: boolean) {
  emptyStateEl.classList.toggle('hidden', !show);
}

function showResultsInfo(show: boolean) {
  resultsInfoEl.classList.toggle('hidden', !show);
}

/**
 * 유틸리티 함수들
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;

  return date.toLocaleDateString('ko-KR');
}

function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength) + '...';
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
  // 검색 엔진 변경
  searchEngineSelect.addEventListener('change', () => {
    state.searchEngine = searchEngineSelect.value as SearchEngine;
    loadPopularTags();
    searchPosts();
  });

  // 퍼지 검색 토글
  fuzzySearchCheckbox.addEventListener('change', () => {
    state.fuzzySearch = fuzzySearchCheckbox.checked;
    if (state.query) {
      searchPosts();
    }
  });

  // 검색 입력 (디바운싱 적용)
  const debouncedSearch = debounce(() => {
    state.query = searchInput.value;
    searchPosts();
  }, 500);

  searchInput.addEventListener('input', () => {
    showSuggestions(searchInput.value);
    debouncedSearch();
  });

  // 정렬 변경
  sortBySelect.addEventListener('change', () => {
    state.sortBy = sortBySelect.value as any;
    if (state.query || state.selectedTags.length > 0) {
      searchPosts();
    }
  });

  // 필터 토글
  filterToggle.addEventListener('click', () => {
    filterPanel.classList.toggle('hidden');
    trendingPanel.classList.add('hidden');
  });

  // 인기 검색어 토글
  trendingToggle.addEventListener('click', () => {
    trendingPanel.classList.toggle('hidden');
    filterPanel.classList.add('hidden');
    if (!trendingPanel.classList.contains('hidden')) {
      loadTrendingSearches();
    }
  });

  // 필터 적용
  applyFiltersBtn.addEventListener('click', () => {
    state.dateFrom = dateFromInput.value;
    state.dateTo = dateToInput.value;
    updateFilterCount();
    searchPosts();
  });

  // 필터 초기화
  clearFiltersBtn.addEventListener('click', () => {
    state.selectedTags = [];
    state.dateFrom = '';
    state.dateTo = '';
    dateFromInput.value = '';
    dateToInput.value = '';
    updateSelectedTags();
    updateFilterCount();
    searchPosts();
  });

  // 더 보기
  loadMoreBtn.addEventListener('click', () => {
    state.currentPage++;
    searchPosts(true);
  });

  // 외부 클릭 시 패널 숨김
  document.addEventListener('click', (e) => {
    const target = e.target as Node;
    if (!searchInput.contains(target)) {
      suggestionsEl.classList.add('hidden');
    }
  });
}

/**
 * 앱 초기화
 */
async function init() {
  console.log('🚀 Initializing Friend Posts Search...');

  setupEventListeners();
  await loadPopularTags();
  searchPosts(); // 초기 검색 (전체 친구 게시물)

  console.log('✓ App initialized with', state.searchEngine, 'search engine');
}

// 앱 시작
init();
