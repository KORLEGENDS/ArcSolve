# ArcWork — flexlayout-react API 정리와 전역 탭 관리(MVP) 가이드

본 문서는 ArcWork 컴포넌트가 사용하는 flexlayout-react의 핵심 API 시그니처와 이를 기반으로 구현 가능한 “전역 탭 관리” MVP 범위를 정리합니다. 또한, 실제 사용 예시와 제약/주의사항, 레이아웃 영속화 전략을 포함합니다.

---

## 목차
1. 개요 및 핵심 개념
2. 사용 가능한 API 시그니처
   - Actions
   - Layout
   - Model
   - IJsonModel / IJsonTabNode
3. 파생 가능한 기능(MVP 범위)
4. 전역 스토어 설계 개요(service-store.ts)
5. 사용 예시
6. 제약/주의
7. 레이아웃 영속화 전략

---

## 1) 개요 및 핵심 개념
- Model: 레이아웃 트리의 상태를 보관/조작(직렬화/복원 가능).
- Layout: React 컴포넌트. `model`과 `factory`로 탭 렌더링. 외부 드래그를 통해 탭 추가 가능.
- Actions: `model.doAction(Actions.*)`로 레이아웃 트리를 조작(탭 추가/삭제/선택/속성 변경 등).
- Node 계열:
  - TabNode: 개별 탭
  - TabSetNode: 탭들의 컨테이너(헤더/툴바/오버플로우)
  - RowNode: 탭셋들을 배치하는 구조적 노드
- DockLocation: TOP/BOTTOM/LEFT/RIGHT/CENTER 도킹 지점 Enum
- IJsonModel/IJsonTabNode: 레이아웃 직렬화 포맷(저장/복원, 탭 정의)

---

## 2) 사용 가능한 API 시그니처

### 2.1 Actions (import { Actions, DockLocation } from 'flexlayout-react')

- 탭 추가/이동
```ts
model.doAction(Actions.addNode(
  { type: 'tab', id, name, component, config }, // IJsonTabNode
  toNodeId,                                     // 대상 TabSetNode id
  DockLocation.CENTER,                          // 도킹 위치
  -1,                                           // index (-1: 맨 뒤)
  true                                          // select (autoSelectTab override)
));

model.doAction(Actions.moveNode(
  fromNodeId, toNodeId, DockLocation.CENTER, -1, true
));
```

- 탭/탭셋 삭제
```ts
model.doAction(Actions.deleteTab(tabId));
model.doAction(Actions.deleteTabset(tabsetId));
```

- 탭 선택/이름 변경/활성 탭셋 지정/최대화 토글
```ts
model.doAction(Actions.selectTab(tabId));
model.doAction(Actions.renameTab(tabId, '새 제목'));
model.doAction(Actions.setActiveTabset(tabsetId));
model.doAction(Actions.maximizeToggle(tabsetId));
```

- 전역/노드 속성 갱신
```ts
model.doAction(Actions.updateModelAttributes({ splitterSize: 10 }));
model.doAction(Actions.updateNodeAttributes(tabId, { component: 'my-component', name: '탭' }));
```

- 팝아웃/윈도우
```ts
model.doAction(Actions.popoutTab(tabId));
model.doAction(Actions.popoutTabset(tabsetId));
```

### 2.2 Layout 메서드 (ref 통해 접근)
```ts
layoutRef.current?.redraw();
layoutRef.current?.addTabToTabSet(tabsetId, { type: 'tab', id, name, component });
layoutRef.current?.addTabToActiveTabSet({ type: 'tab', id, name, component });
layoutRef.current?.addTabWithDragAndDrop(event, { type: 'tab', id, name, component }, onDrop);
layoutRef.current?.moveTabWithDragAndDrop(event, tabOrTabsetNode);
```

- 외부 드래그 진입 처리
```ts
onExternalDrag?: (event: React.DragEvent<HTMLElement>) =>
  | undefined
  | { json: any; onDrop?: (node?: Node, event?: React.DragEvent<HTMLElement>) => void };
```

### 2.3 Model (직렬화/조회/조작)
```ts
const model = Model.fromJson(jsonModel);
const json = model.toJson();
model.doAction(action);                 // Actions.* 반환값 전달
model.getActiveTabset();                // 현재 활성 TabSetNode
model.getNodeById(nodeId);              // 특정 노드 조회
model.visitNodes((node, level) => {});  // 전체 노드 순회
```

### 2.4 IJsonModel / IJsonTabNode (직렬화 구조)
- IJsonTabNode 주요 필드
```ts
type IJsonTabNode = {
  type: 'tab';
  id?: string;        // 탭 식별자(명시 권장)
  name?: string;      // 탭 제목
  component?: string; // factory에서 매핑할 컴포넌트 키
  config?: any;       // 컴포넌트 설정 payload
  // ... (min/max/enableClose 등 다양)
}
```

---

## 3) 파생 가능한 기능(MVP 범위)
- 전역 상태 관리 대상
  - 활성 탭 id(=서비스 id), name(탭 제목), type(=component 키)
  - 열린 탭 목록(중복 방지), 필요 시 registry로 “닫혀도 다시 열 수 있는” 메타 유지
  - ArcWork의 `model`/`layoutRef` 참조
  - 직렬화된 마지막 레이아웃(JSON)
- 제공 기능
  - 탭 열기/닫기/활성화
  - 제목/속성 변경
  - 외부 드래그로 탭 생성
  - 팝아웃/최대화
  - 레이아웃 저장/복원(localStorage 우선, 확장 가능)
- 동기화 포인트
  - `onModelChange`/`onAction`에서 전역 스토어 업데이트
  - 초기 마운트 시 `setModel`/`setLayoutRef`
  - 저장은 debounce로 빈번한 쓰기 방지

---

## 4) 전역 스토어 설계 개요 (`apps/main/src/client/states/stores/service-store.ts`)

### State
- `model?: Model`
- `layoutRef?: Layout | null`
- `activeTabId: string | null`
- `openTabsById: Map<string, { id: string; name: string; type: string }>`
- `registryById: Map<string, { id: string; name: string; type: string }>`
- `lastSavedLayout?: IJsonModel`

### Actions
- 참조 설정: `setModel(model)`, `setLayoutRef(ref)`
- 등록/해제: `registerService(meta)`, `unregisterService(id)`
- 열기/닫기/활성화: `open({ id, name, type }, opts?)`, `openById(id)`, `closeById(id)`, `activateById(id)`
- 일괄: `closeAll()`, `closeOthers(ids)`
- 동기화: `syncFromModel()`
- 저장/복원: `saveLayout()`, `restoreLayout()`

### Selectors
- `useActiveTabId()`, `useOpenTabs()`, `useTabMeta(id)`, `useIsOpen(id)`, `useCanRestore(id)`

### 구현 패턴
- `zustand` + `subscribeWithSelector` 사용(렌더 최소화)
- ArcWork 측 이벤트(`onModelChange`/`onAction`/`onExternalDrag`)에서 액션 호출

---

## 5) 사용 예시

### 5.1 탭 열기
```ts
import { Actions, DockLocation } from 'flexlayout-react';

// 대상 tabsetId가 명확한 경우
model.doAction(Actions.addNode(
  { type: 'tab', id: 'service:editor', name: '에디터', component: 'editor' },
  tabsetId,
  DockLocation.CENTER,
  -1,
  true
));

// 활성 탭셋으로 추가
layoutRef.current?.addTabToActiveTabSet({
  type: 'tab', id: 'service:chat', name: '채팅', component: 'arcyou-chat-room'
});
```

### 5.2 탭 닫기/활성화/이름 변경/속성 변경
```ts
model.doAction(Actions.deleteTab('service:editor'));
model.doAction(Actions.selectTab('service:chat'));
model.doAction(Actions.renameTab('service:chat', '채팅(고객지원)'));
model.doAction(Actions.updateNodeAttributes('service:chat', { component: 'chat', name: '채팅' }));
```

### 5.3 외부 드래그로 탭 생성
```ts
// ArcWork의 onExternalDrag에서
function onExternalDrag(e: React.DragEvent<HTMLElement>) {
  const payload = tryParse(e.dataTransfer?.getData('application/x-arcservice'));
  if (!payload) return undefined;
  const { id, name, type } = payload;
  return {
    json: { type: 'tab', id, name, component: type },
    onDrop: (node) => {
      // 전역 스토어 업데이트 등 후처리
    },
  };
}
```

### 5.4 레이아웃 저장/복원(localStorage)
```ts
// 저장(디바운스 권장)
const saveLayout = () => {
  const json = model.toJson();
  localStorage.setItem('arcwork:layout', JSON.stringify(json));
};

// 복원(초기 마운트 시)
const saved = localStorage.getItem('arcwork:layout');
if (saved) {
  const json = JSON.parse(saved);
  const restored = Model.fromJson(json);
  // setModel(restored) 등
}
```

---

## 6) 제약/주의
- 탭 대상 tabset 미지정 시 기본 대상
  - 활성 탭셋(`model.getActiveTabset()`), 없으면 첫 탭셋(`model.getFirstTabSet()` 등)로 열기 전략 필요
- id 고유성 보장
  - `IJsonTabNode.id`는 고유 식별자(서비스 id). 중복 시 이동/선택이 예측 불가
- 빈번한 저장은 디바운스
  - `onModelChange` 발생 빈도가 높으므로 `saveLayout()` 호출은 디바운스로 제한
- 선택/이름/속성 변경은 Actions 기반
  - 사용자 동작과 프로그램적 동작이 섞일 수 있으므로 단일 소스(스토어)를 통해 반영/동기화
- 팝아웃 사용 시
  - 팝아웃 탭의 윈도우 리소스(window/document) 접근 주의(라이브러리 제공 방법 사용)

---

## 7) 레이아웃 영속화 전략
### MVP: localStorage
- 장점: 서버 의존 없음, 간단/빠름
- 단점: 브라우저/디바이스 간 동기화 불가

### 확장: 서버 동기화(옵션)
- 메인 서버 API로 사용자별 레이아웃 저장/복원
- 병합 전략
  - 서버 우선/클라이언트 우선/최신 타임스탬프 우선 등 선택
- 보안/검증
  - `IJsonModel` 검증(Zod) 및 서버 저장 전 필터링 필요

---

부록: 빠른 체크리스트
- [ ] 탭 열기/닫기/선택/이름/속성 변경은 Actions 사용
- [ ] 외부 드래그: onExternalDrag → { json, onDrop }
- [ ] 활성/열린 탭은 스토어로 단일 소스 관리
- [ ] 레이아웃 저장은 디바운스, 복원은 초기화 시 적용
- [ ] id 고유성, 기본 tabset 전략 준수


