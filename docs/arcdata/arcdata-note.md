# ArcDataNote 개발 가이드

## 현재 상태

ArcDataNote 컴포넌트 구조 정리 및 경로 수정이 완료되었습니다.

### 완료된 작업

1. **컴포넌트 구조 정리**
   - `-static` 컴포넌트 → `ui/static/` 디렉토리로 이동 (25개)
   - `-node` 컴포넌트 → `ui/node/` 디렉토리로 이동 (28개)
   - `-button` 컴포넌트 → `ui/button/` 디렉토리로 이동 (23개)
   - `-buttons` 컴포넌트 → `ui/buttons/` 디렉토리로 이동 (2개)
   - `-toolbar` 컴포넌트 → `ui/toolbar/` 디렉토리로 이동 (4개)
   - `block-` 컴포넌트 → `ui/block/` 디렉토리로 이동 (6개)

2. **경로 수정 완료**
   - 절대 경로(`@/client/components/ui/...`) → 상대 경로(`../../ui/...`) 변경
   - 커스텀 훅 경로 업데이트 (`@/hooks/...` → `@/client/components/arc/ArcData/hooks/note/...`)
   - 상대 경로 문제 해결

3. **필수 패키지 설치 완료**
   - `lowlight` (코드 하이라이팅)
   - `react-dnd`, `react-dnd-html5-backend` (드래그앤드롭)
   - `remark-gfm`, `remark-math` (마크다운)
   - `date-fns` (날짜 처리)
   - `@emoji-mart/data` (이모지)
   - `lodash` (유틸리티)

## 앞으로 해야 할 사항

### 1. 누락된 패키지 설치 (우선순위: 높음)

다음 패키지들을 설치해야 합니다:

```bash
pnpm add @ariakit/react use-file-picker html2canvas-pro pdf-lib react-lite-youtube-embed react-tweet
```

**패키지 목적:**
- `@ariakit/react`: 자동완성 UI 컴포넌트 (inline-combobox)
- `use-file-picker`: 파일 선택 훅 (미디어 업로드, 파일 임포트)
- `html2canvas-pro`: HTML을 이미지로 변환 (에디터 내보내기)
- `pdf-lib`: PDF 생성 (에디터 내보내기)
- `react-lite-youtube-embed`: YouTube 비디오 임베드
- `react-tweet`: 트위터/X 트윗 임베드

**영향 파일:**
- `editor/plugins/copilot-kit.tsx`
- `ui/button/export-toolbar-button.tsx`
- `ui/button/import-toolbar-button.tsx`
- `ui/button/media-toolbar-button.tsx`
- `ui/inline-combobox.tsx`
- `ui/node/media-embed-node.tsx`
- `ui/node/media-placeholder-node.tsx`
- `ui/node/media-video-node.tsx`

### 2. 타입 에러 수정 (우선순위: 중간)

현재 약 17개의 타입 에러가 남아있습니다:

#### 2.1 Implicit Any 타입 에러 (7개)
- `editor/settings-dialog.tsx`: Parameter 'e' implicitly has an 'any' type
- `ui/button/import-toolbar-button.tsx`: Parameter 'result' implicitly has an 'any' type (2개)
- `ui/button/media-toolbar-button.tsx`: Parameter 'result' implicitly has an 'any' type
- `ui/node/media-placeholder-node.tsx`: Parameter 'result' implicitly has an 'any' type
- `ui/inline-combobox.tsx`: Parameter 'newValue', 'event' implicitly has an 'any' type
- `ui/inline-combobox.tsx`: Binding element 'className' implicitly has an 'any' type

**해결 방법:** 각 파라미터에 적절한 타입을 명시하거나 `any` 대신 구체적인 타입 사용

#### 2.2 타입 할당 에러 (6개)
- `editor/use-chat.ts`: 
  - Argument of type 'unknown' is not assignable to parameter of type 'AIToolName'
  - Property 'status' does not exist on type '{}'
  - Property 'comment' does not exist on type '{}'
- `editor/settings-dialog.tsx`: Type '"default"' is not assignable to type '"outline" | "brand" | "ghost" | "point" | null | undefined'
- `ui/button/emoji-toolbar-button.tsx`: TooltipContentProps 타입 불일치
- `ui/button/font-color-toolbar-button.tsx`: TooltipContentProps 타입 불일치
- `ui/node/equation-node.tsx`: Type '"secondary"' is not assignable to button variant type

**해결 방법:** 
- 타입 가드 추가 또는 타입 단언 사용
- 올바른 variant 값 사용
- Tooltip 컴포넌트 props 타입 확인 및 수정

#### 2.3 속성 누락 에러 (4개)
- `ui/block/block-draggable.tsx`: Property 'title' is missing
- `ui/node/column-node.tsx`: Property 'title' is missing

**해결 방법:** 필수 prop인 `title` 추가

#### 2.4 타입 정의 파일 없음 (1개)
- `ui/button/font-color-toolbar-button.tsx`: Could not find a declaration file for module 'lodash/debounce.js'

**해결 방법:** 
- `@types/lodash` 설치 또는
- `lodash/debounce` 대신 다른 방법 사용

### 3. 기능 테스트 (우선순위: 낮음)

패키지 설치 및 타입 에러 수정 후 다음 기능들을 테스트해야 합니다:

1. **에디터 기본 기능**
   - 텍스트 입력 및 편집
   - 블록 드래그 앤 드롭
   - 코드 블록 하이라이팅

2. **미디어 기능**
   - 이미지/비디오/오디오 업로드
   - YouTube 임베드
   - 트위터 임베드

3. **내보내기 기능**
   - 이미지 내보내기 (html2canvas-pro)
   - PDF 내보내기 (pdf-lib)

4. **AI 기능**
   - AI 채팅
   - 자동완성 (copilot)

## 참고사항

### 디렉토리 구조

```
ui/
├── static/          # 정적 렌더링용 컴포넌트 (-static)
├── node/            # 노드 타입 컴포넌트 (-node)
├── button/          # 툴바 버튼 컴포넌트 (-button)
├── buttons/         # 툴바 버튼 그룹 (-buttons)
├── toolbar/         # 툴바 컴포넌트 (-toolbar)
├── block/            # 블록 관련 컴포넌트 (block-)
└── ...              # 기타 공통 컴포넌트
```

### 경로 규칙

- `editor/plugins/` → `ui/`: `../../ui/`
- `editor/plugins/` → `ui/node/`: `../../ui/node/`
- `editor/plugins/` → `ui/static/`: `../../ui/static/`
- `editor/plugins/` → `ui/block/`: `../../ui/block/`
- 공통 UI 컴포넌트: `@/client/components/ui/...`
- 커스텀 훅: `@/client/components/arc/ArcData/hooks/note/...`

