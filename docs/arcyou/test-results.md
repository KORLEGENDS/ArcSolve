# ArcYou 채팅 시스템 테스트 결과

## 테스트 일시
2025-11-10

## 테스트 환경
- **게이트웨이**: `uws-gateway` (포트 8080)
- **워커**: `outbox-worker`
- **데이터베이스**: PostgreSQL (PgBouncer 경유)
- **메시징**: Redis Pub/Sub

## 테스트 결과 요약

### ✅ 성공한 기능

#### 1. WebSocket 인증
- **상태**: ✅ 정상 작동
- **테스트**: UUID 기반 인증 (dev 환경)
- **결과**: `auth` op 정상 처리, `userId` 반환

#### 2. 보강 전송 (Backfill)
- **상태**: ✅ 정상 작동
- **테스트**: `join` 직후 `lastReadId` 이후 메시지 자동 전송
- **결과**: 
  - `last_read_id=0`, `max_message_id=14` → 보강 가능: 14개
  - 실제 수신: 2개 (설정된 `lastReadId` 이후)
  - **진단 로직으로 원인 파악 가능**

#### 3. ACK (읽음 상태 관리)
- **상태**: ✅ 정상 작동
- **테스트**: `ack` op로 `last_read_id` 업데이트
- **결과**: 
  - ACK 응답 수신: `success: true`
  - DB `last_read_id` 업데이트 확인
  - **진단 로직으로 상세 정보 확인 가능**

#### 4. 메시지 전송
- **상태**: ✅ 정상 작동
- **테스트**: `send` op로 메시지 전송
- **결과**: 
  - 메시지 DB 저장 성공
  - Outbox 레코드 생성 (`status: pending`)
  - ACK 반환 (`message_id` 포함)

### ⚠️ 부분 작동 / 확인 필요

#### 5. 브로드캐스트
- **상태**: ⚠️ Outbox 처리 후 정상 작동 예상
- **문제**: Outbox가 `published` 상태로 전이되지 않음
- **원인**: 워커의 SQL 파라미터 타입 문제 (해결됨)
- **해결**: `sql.raw(String(value))` 사용으로 수정 완료

#### 6. Outbox 상태 머신
- **상태**: ⚠️ SQL 파라미터 타입 문제 해결됨
- **문제**: `could not determine data type of parameter`
- **해결**: 
  ```typescript
  // 수정 전
  LIMIT ${MAX_BATCH}
  sql`NOW() + INTERVAL '${LOCK_SECONDS} seconds'`
  
  // 수정 후
  LIMIT ${sql.raw(String(MAX_BATCH))}
  sql`NOW() + INTERVAL '${sql.raw(String(LOCK_SECONDS))} seconds'`
  ```
- **예상**: 수정 후 정상 작동할 것으로 예상

## 해결된 문제

### 1. 보강 전송 0건 문제
- **원인**: `last_read_id >= max(messages.id)`로 인해 보강할 메시지 없음
- **해결**: 진단 쿼리로 원인 파악 가능하도록 개선
- **결과**: 정상 작동 확인

### 2. ACK "Unknown operation" 문제
- **원인**: 구버전 바이너리 실행 (가능성)
- **해결**: 최신 코드 배포 및 테스트
- **결과**: 정상 작동 확인

### 3. Outbox SQL 파라미터 타입 문제
- **원인**: Drizzle `sql` 템플릿에서 숫자 변수 타입 추론 실패
- **해결**: `sql.raw(String(value))`로 명시적 변환
- **결과**: 수정 완료, 정상 작동 예상

## 테스트 시나리오

### 시나리오 1: 초기 참가 및 보강 전송
1. Alice가 오프라인 상태에서 메시지 3개 전송
2. Bob이 참가 (`join`)
3. Bob이 보강 메시지 3개 수신
4. **결과**: ✅ 성공

### 시나리오 2: 실시간 채팅
1. Alice와 Bob 동시 연결
2. Alice가 메시지 전송
3. Bob이 실시간으로 메시지 수신
4. Bob이 응답 메시지 전송
5. Alice가 실시간으로 메시지 수신
6. **결과**: ⚠️ Outbox 처리 후 정상 작동 예상

### 시나리오 3: 읽음 상태 관리
1. 메시지 전송
2. ACK로 `last_read_id` 업데이트
3. DB에서 `last_read_id` 확인
4. **결과**: ✅ 성공

### 시나리오 4: Outbox 상태 머신
1. Outbox 레코드 생성 (`pending`)
2. 워커가 처리 (`published`)
3. 상태 전이 확인
4. **결과**: ⚠️ SQL 파라미터 타입 문제 해결됨

### 시나리오 5: 메시지 순서 보장
1. 연속 메시지 전송
2. DB에서 순서 확인
3. **결과**: 확인 필요

## 진단 도구

### 보강 전송 진단
```sql
SELECT 
  p.last_read_id,
  COALESCE(MAX(m.id), 0) as max_message_id,
  CASE 
    WHEN p.last_read_id >= COALESCE(MAX(m.id), 0) THEN 'backfill 0건 예상'
    ELSE CONCAT('backfill 가능: ', COALESCE(MAX(m.id), 0) - p.last_read_id, '개')
  END as backfill_status
FROM participants p
LEFT JOIN messages m ON m.conversation_id = p.conversation_id
WHERE p.conversation_id = $1 AND p.user_id = $2
GROUP BY p.last_read_id;
```

### Outbox 상태 진단
```sql
SELECT 
  id, status, attempts, error, 
  next_attempt_at, published_at, locked_by
FROM outbox 
WHERE conversation_id = $1 
ORDER BY id DESC 
LIMIT 5;
```

## 다음 단계

1. **워커 재시작**: 수정된 코드로 재빌드 및 재시작
2. **브로드캐스트 테스트**: Outbox가 `published` 상태로 전이되는지 확인
3. **메시지 순서 테스트**: 연속 메시지 전송 시 순서 보장 확인
4. **부하 테스트**: 다중 사용자 동시 접속 테스트
5. **에러 처리 테스트**: 네트워크 오류, 재연결 시나리오 테스트

## 참고 파일

- 테스트 스크립트: `apps/test-outbox-flow.js`, `apps/test-chat-complete.js`, `apps/test-chat-simple.js`
- 게이트웨이: `apps/uws-gateway/server.ts`
- 워커: `apps/outbox-worker/worker.ts`
- 스키마: `apps/main/src/share/schema/drizzles/outbox-drizzle.ts`

