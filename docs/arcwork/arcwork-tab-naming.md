## ArcWork 탭 네이밍 규칙 (id / name / type)

이 문서는 ArcWork에서 **탭을 표현할 때 사용하는 공통 필드 이름**을 명확히 정의합니다.  
ArcWork와 연동하는 모든 도메인(ArcYou, ArcData, ArcWork 자체 등)은 **반드시 `id / name / type` 3가지를 기준으로 탭 메타데이터를 주고받습니다.**

---

## 1. 공통 필드 정의

ArcWork에서 하나의 탭을 표현할 때 사용하는 기본 메타데이터는 다음 세 가지입니다.

- **id**
  - 의미: 탭의 **고유 식별자**이자 도메인 리소스 식별자
    - 예: 채팅방 ID, 문서 ID, 노트 ID 등
  - 용도:
    - flexlayout 탭 노드의 `id`로 사용
    - 동일 `id`인 탭은 **하나의 탭**으로 간주 (이미 열려 있으면 이동/활성화)
    - 도메인 컴포넌트에서 API 호출 시 그대로 사용 (예: `GET /api/arcyou/chat-room/{id}`)
  - 규칙:
    - 문자열(UUID 권장)
    - 도메인 내에서 **논리적으로 유일**한 값이어야 함

- **name**
  - 의미: 탭에 표시되는 **사람이 읽는 제목**(타이틀)
  - 용도:
    - flexlayout 탭 노드의 `name`으로 사용
    - 탭 헤더에 그대로 표시
    - 이름 변경(예: 채팅방 이름 변경, 문서 제목 변경) 시 UI 탭 제목과 동기화
  - 규칙:
    - **반드시 값이 있어야 하는 필수 필드입니다. `name`이 비어 있는 상태로 탭을 만들 수 없으며, `id`로의 fallback을 허용하지 않습니다.**
    - i18n이 필요한 경우, 컴포넌트 내부에서 처리하고 여기에는 최종 문자열을 넣습니다.

- **type**
  - 의미: ArcWork factory에서 렌더링할 **컴포넌트 타입 키**
  - 용도:
    - flexlayout 탭 노드의 `component` 값으로 사용
    - ArcWork factory(`createFactory`, `defaultArcWorkFactory`)에서 `node.getComponent()`를 통해 어떤 React 컴포넌트를 렌더링할지 결정
      - 예: `type === 'arcyou-chat-room'` → `ArcYouChatRoom` 렌더링
  - 규칙:
    - 문자열 키
    - 도메인/기능/뷰를 구분할 수 있도록 일관된 패턴 사용(예: `'arcyou-chat-room'`, `'arcdata-document-view'` 등)
    - 같은 `type`은 항상 같은 React 컴포넌트 또는 래퍼를 의미해야 합니다.

요약하면:

- **id**: “어떤 리소스인가?” (resource identity)
- **name**: “탭에 뭐라고 보일 것인가?” (display title)
- **type**: “어떤 컴포넌트로 그릴 것인가?” (component key)

---

## 2. ArcWork 내부 JSON 매핑 규칙

ArcWork 전역 스토어(예: `service-store`)는 위의 메타데이터를 flexlayout 모델 JSON에 다음과 같이 매핑합니다.

- 입력: `{ id, name, type }`
- flexlayout 탭 노드 JSON:
  - `type: 'tab'`
  - `id: id`
  - `name: name`
  - `component: type`

즉, ArcWork 입장에서는 **항상** 다음 구조를 가진 탭 노드를 생성/조작합니다.

- `id` → flexlayout 탭의 ID (중복 검사 및 활성화에 사용)
- `name` → 탭 제목
- `component` → factory에서 사용하는 타입 키 (`type`에서 그대로 옮겨짐)

이 규칙은 다음과 같은 API에서 공통으로 사용됩니다.

- 탭 열기/활성화:
  - `open({ id, name, type })`
  - `ensureOpen({ id, name, type })`
- 드래그 앤 드롭:
  - `startAddTabDrag(event, { id, name, type })`
  - 외부 드래그 핸들러에서 `dataTransfer`에 `{ id, name, type }` JSON 저장/복원

---

## 3. DnD와 중복 검사에서의 id / name / type 사용

### 3.1. DnD 동작 개요

1. **드래그 시작 시**
   - 리스트 아이템(예: ArcYou 채팅방 목록, ArcData 문서 목록)에서
   - `startAddTabDrag(e, { id, name, type })`를 호출
2. **ArcWork 레이아웃이 이미 준비된 경우**
   - 현재 flexlayout 모델에서 `id`로 탭을 검색
   - 있으면: `moveTabWithDragAndDrop`으로 **기존 탭 이동**
   - 없으면: `addTabWithDragAndDrop`으로 **새 탭 생성**
3. **ArcWork 레이아웃이 아직 없거나 외부 드래그인 경우**
   - `dataTransfer`에 `{ id, name, type }` JSON을 저장
   - ArcWork의 `onExternalDrag` 핸들러가 이를 읽어 탭 노드를 생성

### 3.2. 중복/존재 여부 판단 기준

- **중복 판단은 오직 `id` 기반**입니다.
  - 같은 `id`를 다시 드래그하거나 `ensureOpen({ id, ... })`를 호출하면:
    - “새 탭 생성”이 아니라 “기존 탭 활성화/이동”으로 처리됩니다.
- `name`과 `type`은 아래 용도로만 사용합니다.
  - `name`: 탭 타이틀 표시, 도메인 이름 변경 시 UI 동기화
  - `type`: 어떤 React 컴포넌트를 렌더링할지 결정

---

## 4. 도메인별 사용 가이드 (ArcYou / ArcData 등)

### ArcYou 예시 (채팅방 탭)

- 채팅방 리스트 아이템에서:
  - `id`: `room.id` (채팅방 UUID)
  - `name`: `room.name` (채팅방 이름)
  - `type`: `'arcyou-chat-room'`
- 탭 드래그:
  - `startAddTabDrag(e, { id: room.id, name: room.name, type: 'arcyou-chat-room' })`
- 탭 더블클릭(또는 버튼 클릭)으로 열기:
  - `ensureOpen({ id: room.id, name: room.name, type: 'arcyou-chat-room' })`
- ArcWork factory:
  - `node.getComponent() === 'arcyou-chat-room'`인 경우 `ArcYouChatRoom` 컴포넌트를 렌더링
  - `node.getId()`를 채팅방 ID로 사용

### ArcData 예시 (문서 탭)

- 문서 리스트 아이템에서:
  - `id`: `document.document_id`
  - `name`: 문서 제목 또는 파일명
  - `type`: 예: `'arcdata-document'`
- 탭 열기/드래그 모두 위와 동일 패턴으로 처리

---

## 5. 새 탭 타입 추가 시 체크리스트

새로운 탭 타입(예: PDF 뷰어, 요약 노트 뷰, 설정 패널 등)을 추가할 때는 아래 순서를 따릅니다.

1. **도메인에서 id / name / type 결정**
   - `id`: 도메인 리소스 ID (또는 논리적 식별자)
   - `name`: 탭에서 보여줄 제목
   - `type`: 고유한 컴포넌트 키 문자열
2. **UI/리스트/버튼에서 공통 입력 구성**
   - `const meta = { id, name, type };`
   - 클릭 시: `ensureOpen(meta)`
   - 드래그 시: `startAddTabDrag(e, meta)`
3. **ArcWork factory에 타입 매핑 추가**
   - `node.getComponent()`가 `type`과 일치할 때 적절한 React 컴포넌트를 렌더링
   - 컴포넌트에는 `node.getId()`와 필요한 props를 전달
4. **중복/이동 동작 확인**
   - 동일 `id` 드래그 시 “이미 열린 탭이 이동/활성화되는지” 확인
5. **문서/코멘트에 id / name / type 의미 명시**
   - 도메인 코드에서도 동일 용어로 설명을 맞춰서, 팀 내 혼동을 줄입니다.

---

## 6. 요약

- ArcWork와 연동하는 모든 탭 메타데이터는 **`id / name / type`** 세 가지 필드를 기준으로 합니다.
- **id**는 “무엇을 나타내는 탭인지”를 식별하는 **리소스 ID**이며, 탭 존재 여부/중복 여부 판단의 기준이 됩니다.
- **name**은 탭 헤더에 표시되는 **제목 문자열**입니다.
- **type**은 ArcWork factory가 어떤 **React 컴포넌트를 렌더링할지 결정하는 키**입니다.
- 드래그 앤 드롭, 버튼/메뉴 탭 열기, 탭 이름 변경 등 모든 플로우에서 이 세 필드를 일관되게 사용합니다.


