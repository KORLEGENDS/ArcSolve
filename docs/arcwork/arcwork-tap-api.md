## ArcWork 탭 API 가이드

이 문서는 ArcWork에서 탭을 추가/이동/활성화/닫기 및 드래그 앤 드롭(DnD)을 커스텀하려는 작업자를 위한 실무 가이드입니다. ArcWork는 flexlayout-react를 기반으로 하며, 전역 스토어를 통해 공통 API를 제공합니다.

### 핵심 개념
- id: 탭의 고유 식별자이자 서비스 식별자. 동일 id는 동일 탭을 의미합니다. 컴포넌트에 직접 전달되어 API 호출에 사용됩니다.
- type: ArcWork factory에서 매핑할 컴포넌트 키(IJsonTabNode.component).
- name: 탭 제목(IJsonTabNode.name).
- 일관된 UX: 처음 드래그/이미 열린 탭 드래그 모두 "놓은 위치로 탭이 배치"됩니다.
  - 없으면 새 탭 생성(add)
  - 있으면 기존 탭 이동(move)

### 사용 시나리오
1) 버튼/메뉴로 탭 열기(없으면 생성, 있으면 활성화)
```tsx
import { useArcWorkEnsureOpenTab } from '@/client/states/stores/arcwork-layout-store';

const ensureOpen = useArcWorkEnsureOpenTab();
ensureOpen({ id: '123', type: 'note-view', name: '노트 123' });
```

2) 리스트에서 드래그로 탭 열기/이동(통합)
```tsx
import { useArcWorkStartAddTabDrag } from '@/client/states/stores/arcwork-layout-store';

const startAddTabDrag = useArcWorkStartAddTabDrag();

// 드래그 시작 핸들러
onDragStart={(e) => {
  startAddTabDrag(e, {
    id: room.id, // UUID 그대로 사용
    type: 'arcyou-chat-room',
    name: room.name, // 필수: 탭 제목
  });
}}
```

3) 외부 드래그 폴백(레이아웃 참조가 없을 때)
- 기본적으로 ArcWork는 onExternalDrag 기본 핸들러를 사용합니다.
- 레이아웃 ref가 아직 준비되지 않은 환경에서는 dataTransfer에 JSON을 넣어 전달할 수 있습니다.
```tsx
import { setArcWorkTabDragData } from '@/client/states/stores/arcwork-layout-store';

onDragStart={(e) => {
  setArcWorkTabDragData(e, { id, type, name }); // name 필수
}}
```

### 전역 스토어 API (요약)
- useArcWorkOpenTab(): open({ id, type, name, tabsetId? }): boolean
  - `name`은 필수입니다. 탭 제목을 반드시 제공해야 합니다.
- useArcWorkEnsureOpenTab(): ensureOpen(input): boolean
- useArcWorkActivateTab(): activate(id): boolean
- useArcWorkCloseTab(): close(id): boolean
- useArcWorkStartAddTabDrag():
  - startAddTabDrag(event, input, options?): boolean
  - `input`은 `{ id, type, name }` 형태이며, `name`은 필수입니다.
  - options.dragImage?: ReactNode, options.imageOffset?: { x: number; y: number }
  - 존재하면 moveTabWithDragAndDrop, 미존재 시 addTabWithDragAndDrop
- useArcWorkMakeExternalDragHandler(): onExternalDrag 핸들러 팩토리(ArcWork가 기본 적용)
- setArcWorkTabDragData(event, input): DataTransfer에 페이로드 설정(폴백/외부 드래그용)
  - `input`은 `{ id, type, name }` 형태이며, `name`은 필수입니다.
- 저장/복원
  - useArcWorkSaveLayout(), useArcWorkRestoreLayout(), useArcWorkSetStorageKey()
  - ArcWork는 onModelChange에서 자동 저장(기본 200ms 디바운스)

### ArcWork 연동 사항
- Layout ref는 ArcWork에서 callback ref로 전역 스토어에 등록되어 DnD API에서 사용됩니다.
- onExternalDrag는 명시하지 않으면 스토어의 기본 핸들러가 자동 적용됩니다.
- factory 매핑은 type 문자열에 따라 실제 컴포넌트를 렌더링합니다. 새로운 탭 타입을 추가하려면 factory에 매핑을 추가하세요.

예: 'arcyou-chat-room' 타입 매핑
```tsx
const factory = (node: TabNode) => {
  const component = node.getComponent();
  if (component === 'arcyou-chat-room') {
    const roomId = node.getId(); // id를 직접 사용
    return <ArcYouChatRoom id={roomId} />;
  }
  if (component === 'placeholder') return <div>{node.getName()}</div>;
  return null;
};
```

### 팁과 주의사항
- id 고유성 및 사용
  - 동일 id는 동일 탭을 의미합니다. 사용자 드래그로 동일 id를 다시 드랍하면 "새 탭"이 아니라 "기존 탭 이동"이 수행됩니다.
  - id는 컴포넌트에 직접 전달되며, API 호출에 그대로 사용됩니다. UUID 형식 그대로 사용하는 것을 권장합니다.
- 성능/저장
  - 저장은 200ms 디바운스가 기본이며, 별도 조정은 ArcWork props(autoSaveDelayMs)로 가능합니다.
- 드래그 이미지
  - 시각적 품질을 개선하려면 options.dragImage를 사용하세요.
  - 예: startAddTabDrag(e, meta, { dragImage: <GhostCard />, imageOffset: { x: 8, y: 8 } })
- 탭셋 지정 열기
  - 프로그래매틱 open 시 특정 탭셋에 열려면 open({ ..., tabsetId })를 사용하세요. DnD는 드랍 위치가 우선합니다.

### 문제 해결
- 드래그해도 도킹 가이드가 안 보임
  - 목록 아이템에 draggable 및 onDragStart가 설정되어 있는지 확인
  - ArcWork가 화면에 마운트됐는지, Layout ref가 등록됐는지 확인(ArcWork는 기본 처리)
  - 외부 드래그 폴백이 필요한 경우 setArcWorkTabDragData 사용
- 중복 id 에러
  - 통합 DnD 구현으로 기본적으로 발생하지 않습니다. addOnly 로직을 직접 작성한 경우 move/exists 분기를 추가하세요.
- 탭이 렌더링되지 않음
  - type이 factory에 매핑되어 있는지 확인
  - factory에서 node.getId()를 올바르게 사용하는지 확인

### 빠른 레시피
- "목록에서 드래그로 탭 열기/이동"
```tsx
const startAddTabDrag = useArcWorkStartAddTabDrag();
onDragStart={(e) => startAddTabDrag(e, { id, type, name })} // name 필수
```
- "버튼 클릭으로 열기(없으면 생성/있으면 선택)"
```tsx
const ensureOpen = useArcWorkEnsureOpenTab();
ensureOpen({ id, type, name }) // name 필수
```

### 참고 문서
- docs/arcwork/arcwork-api-and-mvp.md: 전체 구조, flexlayout-react 액션/모델 개요, 영속화 개념


