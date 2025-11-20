# 리소스 접근 규칙

## ⚠️ 필수 준수사항

**모든 리소스는 반드시 `ResourceProvider`를 통해서만 접근하세요.**

```python
# ✅ 올바른 사용
from src.resources.resource_provider import resource_provider

async def my_function():
    # 데이터베이스 접근
    pg = await resource_provider.database.get_postgresql(config)
    redis = await resource_provider.database.get_redis(config)
    
    # 서비스 접근
    checkpointer = await resource_provider.service.get_checkpointer(...)
```

```python
# ❌ 금지된 사용
from src.resources.database.postgresql.postgresql_manager import PostgreSQLManager
from src.resources.service.service_manager import service_provider

# 직접 생성 - 싱글톤 깨짐!
pg = PostgreSQLManager(config)
```

## 접근 계층

```
resource_provider (단일 진입점)
├── .database (DatabaseProvider)
│   ├── .get_postgresql()
│   ├── .get_redis()
│   └── .get_r2()
└── .service (ServiceProvider)
    └── .get_checkpointer()
```

## 위반 시 문제점

- 🚨 싱글톤 패턴 깨짐
- 🚨 리소스 중복 생성
- 🚨 메모리 낭비
- 🚨 연결 풀 비효율

## 초기화

```python
# 애플리케이션 시작 시
await resource_provider.initialize_all()

# 종료 시
await resource_provider.close_all()
```

## DI(의존성 주입) 원칙과 순환 임포트 방지

이번 리팩토링 교훈을 반영하여 다음 원칙을 반드시 준수하세요.

- Manager는 전역 싱글톤(`resource_provider`, `service_provider`)을 모듈 최상단에서 임포트하지 않습니다.
- Manager가 다른 Manager 기능이 필요하면, ServiceProvider가 생성 시점에 콜백/프락시를 "주입"합니다.
- 의존 방향은 상위 → 하위(Provider → Manager)로만 흐릅니다. 하위는 상위를 모릅니다.

### 왜 필요한가?

- 모듈 최상단에서 전역 객체를 임포트하면 다음과 같은 순환 고리가 쉽게 생깁니다:
  - `resource_provider → service_manager → search_manager → resource_provider`
- 이 경우 `partially initialized module` ImportError가 발생합니다. 생성 시 주입으로 전환하면 해당 문제가 사라집니다.

### 역할 정리

- Provider
  - 생성(Factory) + 캐싱(Singleton) + 생명주기(close/health) 관리
  - 예: `ServiceProvider.get_embedding()`, `get_search()`, `get_parser()`
  - 하위가 필요로 하는 리소스(`database_provider` 등)는 `set_*` 또는 생성자 인자로 주입
- Manager
  - 도메인 로직 수행(임베딩, 파싱, 검색 등)
  - 필요한 의존성은 생성 시 주입 받아 내부에서만 사용
  - 전역 싱글톤/Provider 직접 임포트 금지

### 안티패턴(금지)

```python
# search_manager.py (금지)
from src.resources.resource_provider import resource_provider

async def embed_query(self, q: str):
    em = await resource_provider.service.get_embedding()
    return await em.encode_texts_cached([q], usage="query")
```

### 올바른 패턴(권장)

```python
# service_manager.py
mgr = SearchManager(
    database_provider=self._database_provider,
    embedding_accessor=lambda: self.get_embedding(),  # async 콜백 주입
)

# search_manager.py
class SearchManager:
    def __init__(self, database_provider=None, embedding_accessor=None):
        self._database_provider = database_provider
        self._embedding_accessor = embedding_accessor  # Callable[[], Awaitable[EmbedManager]]

    async def _get_em(self):
        if self._embedding_accessor is None:
            raise RuntimeError("embedding accessor not set")
        return await self._embedding_accessor()

    async def embed_query(self, q: str):
        em = await self._get_em()
        return await em.encode_texts_cached([q], usage="query")
```

### 테스트 가이드

- Manager 단위 테스트 시, 주입 포인트(예: `embedding_accessor`)에 목/스텁을 넣어 독립적으로 검증하세요.
- 통합 테스트는 `await resource_provider.initialize_all()` 후 `await resource_provider.service.get_search()` 호출 경로로 확인하세요.

### 체크리스트

- [ ] 모듈 최상단에서 전역 Provider/Resource 임포트하지 않기
- [ ] Manager 생성은 항상 Provider에서 수행하기
- [ ] 교차 의존이 필요한 경우 콜백/프락시로 주입하기
- [ ] 린트/리로드 시 순환 임포트 경고/에러가 없는지 확인하기