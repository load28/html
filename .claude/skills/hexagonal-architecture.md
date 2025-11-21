# Hexagonal Architecture (헥사고날 아키텍처)

프로젝트는 반드시 헥사고날 아키텍처(Ports and Adapters 패턴)를 따라야 합니다.

## 핵심 원칙

- **도메인 중심 설계**: 비즈니스 로직이 프레임워크와 인프라에 독립적
- **의존성 역전**: 도메인이 외부에 의존하지 않고, 외부가 도메인에 의존
- **포트와 어댑터**: 명확한 경계를 통한 외부 시스템 통합
- **테스트 용이성**: 각 레이어를 독립적으로 테스트 가능

## 아키텍처 구조

```
src/
├── domain/           # 핵심 비즈니스 로직 (Pure)
│   ├── entities/     # 도메인 엔티티
│   ├── value-objects/ # 값 객체
│   └── services/     # 도메인 서비스
│
├── application/      # 유스케이스 오케스트레이션
│   ├── ports/        # 인터페이스 정의
│   │   ├── in/       # Inbound Ports (Use Cases)
│   │   └── out/      # Outbound Ports (Repository, External APIs)
│   └── services/     # 애플리케이션 서비스
│
└── infrastructure/   # 외부 세계와의 연결
    ├── adapters/     # Adapters 구현
    │   ├── in/       # Controllers, CLI, Event Handlers
    │   └── out/      # Repository 구현, API Clients
    ├── config/       # 설정 및 DI
    └── persistence/  # DB, Cache 등
```

## 레이어별 책임

### 1. Domain Layer (도메인 레이어)
**순수 비즈니스 로직, 외부 의존성 없음**

```typescript
// domain/entities/User.ts
export class User {
  constructor(
    private readonly id: UserId,
    private email: Email,
    private readonly createdAt: Date
  ) {}

  changeEmail(newEmail: Email): void {
    // 비즈니스 규칙 검증
    if (this.email.equals(newEmail)) {
      throw new DomainError('Email is same as current');
    }
    this.email = newEmail;
  }
}

// domain/value-objects/Email.ts
export class Email {
  private constructor(private readonly value: string) {}

  static create(email: string): Result<Email, ValidationError> {
    if (!this.isValid(email)) {
      return Result.fail(new ValidationError('Invalid email'));
    }
    return Result.ok(new Email(email));
  }

  private static isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

**규칙:**
- ❌ 프레임워크, 라이브러리 의존 금지
- ❌ DB, HTTP, 파일 시스템 직접 접근 금지
- ✅ 순수 비즈니스 규칙만 포함
- ✅ Value Objects로 타입 안전성 보장

### 2. Application Layer (애플리케이션 레이어)
**유스케이스 오케스트레이션, 포트 정의**

```typescript
// application/ports/in/RegisterUserUseCase.ts
export interface RegisterUserUseCase {
  execute(command: RegisterUserCommand): Promise<Result<User, ApplicationError>>;
}

// application/ports/out/UserRepository.ts
export interface UserRepository {
  save(user: User): Promise<Result<void, RepositoryError>>;
  findByEmail(email: Email): Promise<Result<User | null, RepositoryError>>;
}

// application/services/RegisterUserService.ts
export class RegisterUserService implements RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService
  ) {}

  async execute(command: RegisterUserCommand): Promise<Result<User, ApplicationError>> {
    // 1. 도메인 객체 생성
    const emailResult = Email.create(command.email);
    if (emailResult.isFailure()) {
      return Result.fail(new ApplicationError(emailResult.error));
    }

    // 2. 비즈니스 규칙 검증
    const existingUser = await this.userRepository.findByEmail(emailResult.value);
    if (existingUser.value) {
      return Result.fail(new ApplicationError('User already exists'));
    }

    // 3. 도메인 로직 실행
    const user = User.create(emailResult.value);

    // 4. 영속화
    await this.userRepository.save(user);

    // 5. 외부 서비스 호출
    await this.emailService.sendWelcome(user);

    return Result.ok(user);
  }
}
```

**규칙:**
- ✅ Ports(인터페이스)로 의존성 정의
- ✅ 유스케이스 단위로 서비스 분리
- ✅ 도메인 객체 오케스트레이션
- ❌ 구체적인 구현체 의존 금지

### 3. Infrastructure Layer (인프라 레이어)
**어댑터 구현, 외부 시스템 연결**

```typescript
// infrastructure/adapters/in/UserController.ts
@Controller('/users')
export class UserController {
  constructor(
    private readonly registerUser: RegisterUserUseCase
  ) {}

  @Post('/register')
  async register(@Body() dto: RegisterUserDto): Promise<Response> {
    const command = new RegisterUserCommand(dto.email);
    const result = await this.registerUser.execute(command);

    if (result.isFailure()) {
      return Response.badRequest(result.error);
    }

    return Response.created(result.value);
  }
}

// infrastructure/adapters/out/PostgresUserRepository.ts
export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async save(user: User): Promise<Result<void, RepositoryError>> {
    try {
      await this.db.query(
        'INSERT INTO users (id, email, created_at) VALUES ($1, $2, $3)',
        [user.getId(), user.getEmail(), user.getCreatedAt()]
      );
      return Result.ok();
    } catch (error) {
      return Result.fail(new RepositoryError(error));
    }
  }

  async findByEmail(email: Email): Promise<Result<User | null, RepositoryError>> {
    // DB 조회 로직
  }
}

// infrastructure/config/DependencyInjection.ts
export class DI {
  static configureUserModule(): void {
    // Repositories
    container.bind<UserRepository>(TYPES.UserRepository)
      .to(PostgresUserRepository);

    // Use Cases
    container.bind<RegisterUserUseCase>(TYPES.RegisterUserUseCase)
      .to(RegisterUserService);
  }
}
```

**규칙:**
- ✅ Ports를 구현하는 Adapters
- ✅ 프레임워크, 라이브러리 사용
- ✅ DI Container로 의존성 주입
- ❌ 도메인 로직 포함 금지

## 의존성 규칙

```
Infrastructure (Adapters)
       ↓
   Application (Ports & Use Cases)
       ↓
    Domain (Entities, Value Objects)
```

**절대 규칙:**
- Domain은 어떤 레이어에도 의존하지 않음
- Application은 Domain에만 의존
- Infrastructure는 Application과 Domain에 의존

## 포트(Ports) 설계 원칙

### Inbound Ports (주도 포트)
외부에서 애플리케이션을 호출하는 인터페이스

```typescript
// application/ports/in/GetUserQuery.ts
export interface GetUserQuery {
  execute(userId: string): Promise<Result<UserDTO, QueryError>>;
}
```

**특징:**
- Use Case를 나타냄
- Application 레이어에 정의
- Infrastructure의 Inbound Adapter가 호출

### Outbound Ports (피동 포트)
애플리케이션이 외부를 호출하는 인터페이스

```typescript
// application/ports/out/EmailService.ts
export interface EmailService {
  sendWelcome(user: User): Promise<Result<void, EmailError>>;
}

// application/ports/out/UserRepository.ts
export interface UserRepository {
  save(user: User): Promise<Result<void, RepositoryError>>;
}
```

**특징:**
- 외부 의존성을 추상화
- Application 레이어에 정의
- Infrastructure의 Outbound Adapter가 구현

## 테스트 전략

### 1. Domain Layer 테스트
```typescript
describe('User', () => {
  it('should change email with valid email', () => {
    const user = User.create(Email.create('old@email.com').value);
    const newEmail = Email.create('new@email.com').value;

    user.changeEmail(newEmail);

    expect(user.getEmail()).toEqual(newEmail);
  });
});
```

### 2. Application Layer 테스트 (Mock 사용)
```typescript
describe('RegisterUserService', () => {
  it('should register new user', async () => {
    const mockRepo = mock<UserRepository>();
    const mockEmailService = mock<EmailService>();
    const service = new RegisterUserService(mockRepo, mockEmailService);

    when(mockRepo.findByEmail(any())).thenResolve(Result.ok(null));
    when(mockRepo.save(any())).thenResolve(Result.ok());

    const result = await service.execute(
      new RegisterUserCommand('test@email.com')
    );

    expect(result.isSuccess()).toBe(true);
    verify(mockRepo.save(any())).once();
  });
});
```

### 3. Infrastructure Layer 테스트 (통합 테스트)
```typescript
describe('PostgresUserRepository', () => {
  it('should save user to database', async () => {
    const db = await createTestDatabase();
    const repo = new PostgresUserRepository(db);
    const user = User.create(Email.create('test@email.com').value);

    await repo.save(user);

    const saved = await repo.findByEmail(user.getEmail());
    expect(saved.value).toEqual(user);
  });
});
```

## 체크리스트

새로운 기능 추가 시:

- [ ] Domain에 엔티티/값 객체 정의
- [ ] Application에 Inbound Port(Use Case) 정의
- [ ] Application에 필요한 Outbound Ports 정의
- [ ] Application Service에서 유스케이스 구현
- [ ] Infrastructure에 Inbound Adapter 구현 (Controller 등)
- [ ] Infrastructure에 Outbound Adapter 구현 (Repository 등)
- [ ] DI Container에 바인딩 추가
- [ ] 각 레이어별 테스트 작성
- [ ] 의존성 방향이 올바른지 검증

## 금지 패턴

```typescript
// ❌ Domain이 Infrastructure에 의존
import { Database } from '../infrastructure/db';

export class User {
  async save() {
    await Database.query('INSERT ...');
  }
}

// ❌ Application이 구체 클래스에 의존
import { PostgresUserRepository } from '../infrastructure/adapters/out/PostgresUserRepository';

export class RegisterUserService {
  constructor(private repo: PostgresUserRepository) {}
}

// ❌ Controller에 비즈니스 로직
@Post('/users')
async createUser(@Body() dto: CreateUserDto) {
  if (!dto.email.includes('@')) {
    throw new Error('Invalid email');
  }
  // ...
}
```

## 허용 패턴

```typescript
// ✅ Domain은 순수하게 유지
export class User {
  changeEmail(newEmail: Email): void {
    // 순수 비즈니스 로직만
  }
}

// ✅ Application은 Port(인터페이스)에 의존
export class RegisterUserService {
  constructor(private repo: UserRepository) {} // 인터페이스
}

// ✅ Controller는 Use Case만 호출
@Post('/users')
async createUser(@Body() dto: CreateUserDto) {
  return this.registerUserUseCase.execute(dto);
}
```

## 실전 적용 팁

1. **작은 것부터 시작**: 하나의 도메인 모듈부터 헥사고날 아키텍처 적용
2. **포트를 먼저 설계**: 구현보다 인터페이스를 먼저 정의
3. **도메인 이벤트 활용**: 도메인 간 느슨한 결합 유지
4. **Result/Either 타입**: 에러 처리를 타입 안전하게
5. **DTO 변환**: 레이어 간 데이터 전달 시 적절한 DTO 사용

## 참고 자료

- [Hexagonal Architecture by Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)
- [DDD, Hexagonal, Onion, Clean, CQRS](https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/)
