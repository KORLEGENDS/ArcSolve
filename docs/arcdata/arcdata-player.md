## ArcData Player 뷰어 API

ArcData는 ArcSolve 내에서 **파일 기반 문서(PDF, 영상, 오디오 등)를 조회하기 위한 통합 뷰어 레이어**입니다.  
이 문서는 그 중 **Player(영상/오디오/YouTube) 관련 API와 데이터 흐름**을 정리합니다.

> ArcData 전반(ArcWork 연동, 탭 메타데이터, 파일 타입 확장 전략 등)에 대한 개요는  
> [`arcdata-api.md`](./arcdata-api.md)를 참고하세요.  
> PDF 뷰어 내부 구조는 [`arcdata-pdf.md`](./arcdata-pdf.md)에 정리되어 있습니다.

---

## 1. 전체 구조 (Player 계층)

Player 관련 주요 구성요소는 다음과 같습니다.

- `ArcData.tsx`
  - ArcData 도메인의 **엔트리 포인트 컴포넌트**
  - props: `{ documentId: string }`
  - 역할:
    - `useDocumentFiles()`로 현재 사용자 기준 `DocumentDTO[]` 목록 조회
    - `documentId`에 해당하는 문서를 찾고, `kind` / `fileMeta.mimeType` / `fileMeta.storageKey`를 기반으로
      - PDF면 `ArcDataPDFHost`
      - 영상/오디오/YouTube면 `ArcDataPlayerHost`
      - 그 외 타입은 아직 미지원으로 처리

- `hosts/ArcDataPlayerHost.tsx`
  - Player 전용 호스트 컴포넌트
  - 역할:
    - `documentId`, `mimeType`, `storageKey`를 입력으로 받음
    - `storageKey`가 **외부 URL(https://)** 인지, R2에 저장된 내부 키인지 판별
    - R2 저장 파일이면 `/api/document/{id}/download-url`로 서명 URL 발급
    - `PlayerManager`를 통해 최종 재생 URL(`src`)을 로드하고 `ArcDataPlayer`에 전달

- `components/core/ArcDataPlayer/ArcDataPlayer.tsx`
  - 실제 재생을 담당하는 **Player 뷰어 컴포넌트**
  - 내부적으로 `react-player`를 thin wrapper 형태로 감쌉니다.
  - `src`, `mimeType`, `zoom` 등의 props를 받아, 단일 `<ReactPlayer>` 인스턴스를 렌더링합니다.

---

## 2. ArcData에서 Player 분기 로직

파일 타입 판별과 Player 분기는 `ArcData.tsx`에서 이루어집니다.

### 2.1. 지원하는 MIME 타입

- Player 대상으로 인식되는 조건:
  - `mimeType`이 `video/*` 로 시작
  - 또는 `mimeType`이 `audio/*` 로 시작
  - 또는 `mimeType === 'video/youtube'`
  - 또는 `storageKey`가 `https://www.youtube.com/...`, `https://youtu.be/...` 등 YouTube URL인 경우

즉, **YouTube 문서는 DB에 다음과 같이 저장됩니다.**

- `kind = 'file'`
- `fileMeta.mimeType = 'video/youtube'`
- `fileMeta.storageKey = 'https://www.youtube.com/watch?v=...'`

이러한 문서는 ArcData 엔트리에서 Player 대상으로 분류되어 `ArcDataPlayerHost`로 라우팅됩니다.

### 2.2. ArcData 엔트리 요약

ArcData는 대략 다음과 같은 흐름으로 Player 호스트를 선택합니다(개념 요약).

```ts
// 1. 문서 목록 조회
const { data: documents } = useDocumentFiles();

// 2. 대상 문서 선택
const document = documents.find((d) => d.documentId === documentId);
if (!document || document.kind !== 'file') return null;

const mimeType = document.fileMeta?.mimeType ?? null;
const storageKey = document.fileMeta?.storageKey ?? null;

// 3. 타입 판별
const isPDF = mimeType === 'application/pdf';
const isVideo = typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('video/');
const isAudio = typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('audio/');

const isExternalUrl =
  typeof storageKey === 'string' &&
  (storageKey.startsWith('http://') || storageKey.startsWith('https://'));

const isYoutubeMime = typeof mimeType === 'string' && mimeType.toLowerCase() === 'video/youtube';
const isYoutubeUrl =
  isExternalUrl &&
  typeof storageKey === 'string' &&
  /(?:youtube\.com|youtu\.be)\//i.test(storageKey);

const isPlayer = isVideo || isAudio || isYoutubeMime || isYoutubeUrl;

// 4. 분기
if (isPDF) {
  return <ArcDataPDFHost documentId={documentId} />;
}

if (isPlayer) {
  return (
    <ArcDataPlayerHost
      documentId={documentId}
      mimeType={mimeType}
      storageKey={storageKey}
    />
  );
}
```

---

## 3. ArcDataPlayerHost API

파일 위치:  
`apps/main/src/client/components/arc/ArcData/hosts/ArcDataPlayerHost.tsx`

### 3.1. Props

```ts
export interface ArcDataPlayerHostProps {
  documentId: string;
  mimeType?: string | null;
  storageKey?: string | null;
}
```

### 3.2. 재생 URL 결정 규칙

1. **외부 URL 여부 판단**
   - `storageKey`가 `http://` 또는 `https://`로 시작하면 **외부 URL**로 간주합니다.
   - 이 경우 R2 서명 URL 발급을 하지 않고, `storageKey` 자체를 `src`로 사용합니다.
   - YouTube 문서는 이 경로를 통해 직접 재생됩니다.

2. **내부 R2 파일인 경우**
   - `storageKey`가 상대 경로나 S3 키 형식(`users/{userId}/...`)이면 내부 파일로 간주합니다.
   - `useDocumentDownloadUrl(documentId, { inline: true, enabled: !isExternalUrl })`를 호출해
     `/api/document/{id}/download-url`에서 서명 URL을 발급받습니다.
   - 응답의 `download.url`을 **원본 재생 URL(`rawSrc`)로 사용**합니다.

3. **PlayerManager를 통한 미디어 로드**
   - `rawSrc`가 준비되면, `PlayerManager.load(documentId, rawSrc, { mode: 'stream', mimeType })`를 호출합니다.
   - 현재 구현에서는 **모든 미디어를 `mode: 'stream'`으로 처리**하여,
     - 외부 URL/서명 URL을 그대로 `ArcDataPlayer`에 넘겨 스트리밍합니다.
   - 반환된 `LoadedMedia`의 `src`와 `mimeType`을 상태에 저장해 `ArcDataPlayer`에 전달합니다.

4. **에러 처리**
   - `useDocumentDownloadUrl`에서 에러가 발생하면 콘솔 로그만 남기고 `null`을 반환합니다(MVP 기준).
   - `PlayerManager.load`에서 에러가 나면 콘솔에 상세 로그를 남기고 렌더링을 생략합니다.
   - `rawSrc` 또는 `mediaSrc`가 준비되지 않았으면 렌더링하지 않습니다.

요약하면:

- YouTube / 외부 미디어 → `storageKey`를 `rawSrc`로 받아 `PlayerManager`를 거쳐 스트리밍  
- ArcSolve R2에 저장된 파일 → `/download-url` 서명 URL 발급 후, 해당 URL을 `rawSrc`로 사용해 스트리밍

---

## 4. ArcDataPlayer 컴포넌트 API

파일 위치:  
`apps/main/src/client/components/arc/ArcData/components/core/ArcDataPlayer/ArcDataPlayer.tsx`

### 4.1. Props

```ts
export interface ArcDataPlayerScriptItem {
  id: string;
  start: number; // 초 단위
  end: number;   // 초 단위
  text: string;
  speaker?: string | null;
}

export interface ArcDataPlayerTranscriptOptions {
  /**
   * 초기 포커스 모드
   * - 'focus' (기본값): 현재 대본만 또렷하게, 나머지는 블러/감쇠
   * - 'full' : 모든 대본을 동일하게 표시
   */
  initialFocusMode?: 'focus' | 'full';
}

export interface ArcDataPlayerProps {
  src: string;
  mimeType?: string | null;
  title?: string;
  className?: string;
  zoom?: number; // 25~500 (width 비율, %)
  config?: Record<string, unknown>;

  // 재생 제어 (기본 ArcData 흐름에서는 사용하지 않는 고급 옵션)
  loop?: boolean; // 루프 재생 여부 (기본 false)
  playing?: boolean; // 재생 상태 제어 (기본 undefined, 내부 이벤트로 관리)
  currentTime?: number; // 외부에서 재생 위치(초)를 직접 제어할 때 사용 (고급/실험용)

  onReady?: () => void;
  onError?: (error: unknown) => void;

  /**
   * (옵션) 시킹 이벤트 콜백
   * - 대본 클릭 등으로 특정 시점으로 점프할 때 호출됨
   * - 외부에서 currentTime을 직접 관리하는 경우에만 사용 권장
   */
  onSeekTo?: (time: number) => void;

  /**
   * (옵션) 대본/스크립트 데이터
   * - start/end는 초 단위
   * - ArcData 상위 도메인(예: ArcWork)에서 전달
   */
  scriptItems?: ArcDataPlayerScriptItem[];
  transcriptOptions?: ArcDataPlayerTranscriptOptions;
}
```

### 4.2. 동작 요약

- 내부적으로 `react-player`를 다음과 같이 래핑합니다.

```tsx
<AnyReactPlayer
  ref={playerRef}
  src={src}
  width="100%"
  height={isAudio ? '64px' : '100%'}
  controls
  config={config}
  loop={loop}
  playing={playing}
  playsInline
  onReady={handleReady}
  onError={onError}
  title={title}
  onTimeUpdate={handleTimeUpdate}
  onDurationChange={handleDurationChange}
  onPlay={handlePlay}
  onPause={handlePause}
  onEnded={handleEnded}
/>
```

- **src**:
  - 재생할 미디어 URL (YouTube / R2 서명 URL / 기타 스트리밍 URL)
- **mimeType**:
  - `audio/*`로 시작하면 단순 오디오 플레이어로 인식해 height를 `64px`로 고정합니다.
  - 그 외에는 전체 height를 사용해 영상 플레이어로 렌더링합니다.
- **zoom**:
  - Player 컨테이너의 width를 `%`로 제어합니다.
  - 예: `zoom = 100` → 너비 100%, `zoom = 80` → 너비 80% (가운데 정렬)
- **config**:
  - `react-player`의 `config` prop 그대로 전달됩니다.
  - 필요 시 `config={{ youtube: { playerVars: { modestbranding: 1 } } }}` 등으로 세부 옵션을 조정할 수 있습니다.
  - ArcData의 기본 흐름에서는 `ArcDataPlayerHost`가 필요한 설정을 모두 주입하며,
    일반 클라이언트 코드에서는 직접 건드리지 않는 것을 권장합니다.

- **loop / playing / currentTime / onSeekTo**:
  - `loop`:
    - `react-player`의 loop 옵션을 그대로 전달합니다.
    - ArcData 기본 사용에서는 필요하지 않지만, 특수한 플레이어 데모/실험에서 사용할 수 있는 고급 옵션입니다.
  - `playing`:
    - 외부에서 재생/일시정지 상태를 강제로 제어해야 할 때 사용할 수 있습니다.
    - ArcData 기본 흐름에서는 내부 이벤트(`onPlay`, `onPause`, `onEnded`)로 상태를 관리하며, 이 값을 넘기지 않는 것이 기본입니다.
  - `currentTime`:
    - 외부에서 재생 위치를 직접 제어해야 하는 고급/실험용 옵션입니다.
    - 예: 별도의 타임라인 컴포넌트가 있고, 그 타임라인을 기준으로 Player/Transcript를 모두 동기화하고 싶을 때 사용 가능합니다.
  - `onSeekTo(time)`:
    - 대본 클릭 등으로 시킹이 발생했을 때, 외부 타임라인/상태에게 "time 위치로 이동했다"는 사실을 알려주기 위한 콜백입니다.
    - ArcData 기본 흐름에서는 내부에서만 시킹을 처리하므로 이 콜백을 사용하지 않습니다.

> 주의: `react-player` v3 기준으로 URL prop 이름은 `src`입니다.  
> (과거 문서/예제에서 `url`을 사용하는 경우가 있으나, 현재 구현에서는 `src`를 사용해야 합니다.)

### 4.3. 내부 훅 구조 (`usePlayerController`, `usePlayerTranscript`)

ArcDataPlayer 내부 구현은 다음 두 개의 훅으로 책임을 분리합니다.

- `usePlayerController`
  - 위치: `apps/main/src/client/components/arc/ArcData/hooks/player/usePlayerController.ts`
  - 역할:
    - `ReactPlayer` 인스턴스 ref(`playerRef`) 관리
    - `currentTime`, `duration`, `isPlaying` 상태를 **스크립트 유무와 관계없이 항상 관리**
    - `loop`, `playing`, `currentTime`, `onSeekTo`와 연동되는 이벤트 핸들러 제공
      (`handleReady`, `handleTimeUpdate`, `handleDurationChange`,
      `handlePlay`, `handlePause`, `handleEnded`, `handleSeekTo`, `handleTogglePlay`)
    - 외부에서 `currentTime`을 제어하는 경우(`externalCurrentTime` 제공)에는
      내부 시간을 직접 변경하지 않고, `onSeekTo` 콜백을 통해 상위 상태와 동기화

- `usePlayerTranscript`
  - 위치: `apps/main/src/client/components/arc/ArcData/hooks/player/usePlayerTranscript.ts`
  - 역할:
    - `scriptItems`와 `currentTime`을 입력으로 받아 **현재 활성 스크립트(activeScript)** 계산
    - `duration`이 비어 있는 경우 마지막 스크립트의 `end` 값을 기준으로 `effectiveDuration` 계산
    - 자동 스크롤용 ref(`activeItemRef`)와 포커스 모드 상태(`isBlurred`)를 관리
    - 스크롤/클릭 인터랙션을 위한 핸들러 제공
      (`handleScroll`, `handleScriptClick`, `formatTime`)

정리하면, ArcDataPlayer는:

- `usePlayerController`로 **플레이어 공통 상태/이벤트를 한 곳에서 관리**하고,
- `scriptItems`가 존재하는 경우에만 `usePlayerTranscript`를 통해  
  Transcript(대본) 하이라이트/자동 스크롤/클릭 시킹 UX를 추가로 제공하는 구조입니다.

---

## 6. Transcript(대본) 연동

### 6.1. 데이터 구조

ArcDataPlayer는 `scriptItems`가 전달된 경우, 하단에 **대본 패널**을 함께 렌더링합니다.

- `scriptItems: ArcDataPlayerScriptItem[]`
  - `start`, `end`: 초 단위 구간
  - `text`: 대본 내용
  - `speaker`: 선택적 화자 정보
- `transcriptOptions.initialFocusMode`
  - `'focus'`(기본값): 현재 구간만 또렷하게, 나머지는 블러 처리
  - `'full'`: 모든 대본을 동일하게 표시

### 6.2. 동작 규칙 (ScriptTeleprompter 패턴)

내부 구현은 `ScriptTeleprompter` 예제와 동일한 UX 규칙을 따릅니다.

1. **재생 위치 동기화**
   - `react-player`의 `onTimeUpdate`, `onDurationChange` 콜백을 사용해
     - `currentTime`
     - `duration`
     상태를 ArcDataPlayer 내부에서 관리합니다.
   - `currentTime`과 `scriptItems`를 비교해  
     `start <= currentTime < end` 인 항목을 **현재 활성 대본(activeScript)** 으로 판단합니다.

2. **자동 스크롤 & 블러 포커스**
   - 규칙 2: 활성 대본이 변경되면
     - `isBlurred`를 `true`로 되돌려 **포커스 모드**로 복구
     - 해당 DOM 요소에 `scrollIntoView({ behavior: 'smooth', block: 'center' })` 호출
     - 내부 플래그(`isAutoScrollingRef`)로 자동 스크롤 중인지 추적

3. **사용자 스크롤**
   - 규칙 1: 사용자가 대본 영역을 직접 스크롤하면
     - 자동 스크롤 중이 아닌 경우에만 `isBlurred = false` 로 전환
     - 전체 대본을 동일한 명도/선명도로 보는 **전체 보기 모드**가 됩니다.

4. **대본 클릭 → 해당 시점으로 점프**
   - 규칙 3: 사용자가 특정 대본을 클릭하면
     - 해당 항목의 `start` 시점으로 점프를 요청
     - 내부적으로는 `react-player` 인스턴스에 대해
       - v3 기준 `player.currentTime = start` 또는
       - 구버전 호환을 위해 `player.seekTo(start, 'seconds')`
       를 우선적으로 시도합니다.
     - 점프 이후 `isBlurred = true` 로 되돌려 포커스 모드로 복구합니다.

5. **재생/일시정지 상태와의 연동**
   - Player에서 발생하는 `onPlay`, `onPause`, `onEnded` 이벤트를 감지해
     - `isPlaying` 상태를 관리
     - 대본 헤더에서는 `lucide-react` 아이콘을 사용한 **Play/Pause 토글 버튼**으로
       현재 상태를 표시하고, 클릭 시 ReactPlayer 인스턴스에 `play() / pause()`를 호출합니다.

요약하면, ArcDataPlayer는:

- 미디어 재생은 `react-player` v3 API에 맞추어 처리하면서,
- `scriptItems`가 주어졌을 때만 **자동 하이라이트 + 자동 스크롤 + 클릭 시킹**이 동작하도록
  얇은 Transcript 레이어를 함께 제공하는 구조입니다.

---

## 5. YouTube 문서 생성 플로우

Player가 YouTube를 어떻게 인식/재생하는지 이해하려면, **YouTube 문서 생성 플로우**를 함께 보는 것이 중요합니다.

### 5.1. 클라이언트 (ArcManager)

관련 파일:

- `apps/main/src/client/components/arc/ArcManager/ArcManager.tsx`
- [`docs/arcmanager/arcmanager-api.md`](../arcmanager/arcmanager-api.md)

동작 요약:

1. 파일 탭 툴바 우측에 **“YouTube 링크 추가” 버튼**이 있습니다.
2. 클릭 시 현재 디렉토리 아래에 인라인 입력 행이 표시되며, 사용자가 YouTube URL을 입력합니다.
3. Enter / blur 시:
   - URL이 `youtube.com` 또는 `youtu.be` 도메인인지 간단히 검증
   - 유효하면 `useDocumentYoutubeCreate().createYoutube({ url, parentPath })` 호출
   - 성공 후 `useDocumentFiles()`를 다시 refetch하여 트리를 갱신

### 5.2. 서버 API (`POST /api/document/youtube`)

관련 파일:

- `apps/main/src/app/(backend)/api/document/youtube/route.ts`
- `apps/main/src/share/schema/zod/document-youtube-zod.ts`
- `apps/main/src/share/schema/repositories/document-repository.ts`

요약:

1. 요청 스키마:

```ts
type YoutubeDocumentCreateRequest = {
  url: string;        // YouTube URL
  parentPath: string; // '' = 루트, 그 외 ltree 경로
};
```

2. 서버에서 이름 결정:
   - `fetchYoutubeTitle(url)`로 YouTube oEmbed API에서 title 조회
   - 성공 시 해당 title을 사용
   - 실패 시 `"YouTube"`로 fallback

3. `DocumentRepository.createExternalFile` 호출:

```ts
await repository.createExternalFile({
  userId,
  parentPath: input.parentPath,
  name: finalName,          // 표시용 이름 (UTF-8)
  mimeType: 'video/youtube',
  storageKey: input.url,    // 그대로 YouTube URL
});
```

4. DB에는 다음과 같이 저장됩니다.

- `kind = 'file'`
- `path` = `parentPath + '.' + toLtreeLabel(name)` (slugify 기반 ASCII 경로)
- `name` = YouTube title (또는 `"YouTube"`)
- `fileMeta`:
  - `mimeType = 'video/youtube'`
  - `fileSize = 0`
  - `storageKey = 입력된 YouTube URL`

이렇게 저장된 문서는 ArcManager에서 일반 파일과 동일하게 보이고,  
ArcData 탭에서는 **Player 호스트를 통해 YouTube 영상으로 재생**됩니다.

---

## 6. 렌더링/상호작용 시퀀스 요약 (Player)

1. 사용자가 ArcManager 파일 트리에서 YouTube 문서를 드래그 → ArcWork 탭으로 드롭합니다.
2. ArcWork는 `{ id: documentId, name, type: 'arcdata-document' }` 메타데이터로 새 탭을 생성합니다.
3. `ArcWorkContent` factory에서 `component === 'arcdata-document'`인 탭에 대해 `<ArcData documentId={id} />`를 렌더링합니다.
4. `ArcData`는 `useDocumentFiles()`로 문서 목록을 조회하고, 대상 문서를 Player 대상 여부(isVideo/isAudio/isYoutube)로 판별합니다.
5. Player 대상이면 `<ArcDataPlayerHost documentId mimeType storageKey />`를 렌더링합니다.
6. `ArcDataPlayerHost`는 외부 URL 여부에 따라:
   - YouTube/외부 URL → `storageKey`를 그대로 `src`로 사용
   - 내부 R2 파일 → `/api/document/{id}/download-url` 서명 URL을 발급받아 `src`로 사용
7. `ArcDataPlayer`는 `src`를 `react-player`에 넘겨 실제 재생을 수행합니다.

이 흐름을 통해, ArcData는 **PDF와 동일한 ArcWork/ArcManager 통합 패턴**을 유지하면서도,  
YouTube/영상/오디오 문서를 자연스럽게 Player 탭으로 재생할 수 있습니다.

---

## 7. PlayerManager와 로딩 모드 확장 포인트

Player 계층은 `ArcDataPlayerManager`(싱글톤 인스턴스 `playerManager`)를 통해 미디어 로드를 추상화합니다.

### 7.1. PlayerManager 개요

파일 위치:  
`apps/main/src/client/components/arc/ArcData/managers/ArcDataPlayerManager.ts`

핵심 타입은 다음과 같습니다.

```ts
export type MediaKey = string;
export type LoadMode = 'blob' | 'stream';

export interface LoadOptions {
  mode: LoadMode;
  mimeType?: string;
  headers?: Record<string, string>;
  onProgress?: (loaded: number, total: number | null) => void;
  signal?: AbortSignal;
}

export interface LoadedMedia {
  key: MediaKey;
  src: string; // blob: 또는 http/https URL
  mimeType?: string;
  mode: LoadMode;
}
```

- **stream 모드**
  - 입력이 URL(string)이어야 합니다.
  - 캐시를 사용하지 않고, 입력 URL을 그대로 `src`로 반환합니다.
  - 현재 ArcData Player는 모든 미디어를 `mode: 'stream'`으로 로드합니다.
- **blob 모드**
  - URL/Blob/ArrayBuffer를 받아 실제 바이너리 데이터를 다운로드하고, `Blob` + `object URL`을 생성합니다.
  - `mediaCache`에 LRU 정책으로 보관하며, `refCount`와 타임아웃 기반으로 정리합니다.

### 7.2. 향후 확장 아이디어

현재는 단순 스트리밍만 필요하므로 `mode: 'stream'`만 사용하지만,  
향후 다음과 같은 기능을 추가할 때 `mode: 'blob'`으로 전환하는 것이 유리합니다.

- 동영상/오디오 **로컬 분석** (샷 분할, 스펙트럼 분석, 오프라인 인덱싱 등)
- 특정 구간의 **썸네일/파형 이미지 생성**
- 동일 미디어에 대한 **여러 뷰어/도구 간 바이너리 공유**

권장 전략:

1. ArcDataPlayerHost에서 `mimeType`과 파일 크기(추가 메타가 있다면)를 기준으로,
   - 작은 파일 → `stream`
   - 큰/자주 쓰이는 파일 → `blob`
   으로 분기할 수 있습니다.
2. `ArcDataPlayerManager.load(..., { mode: 'blob' })`로 한 번 로드하면,
   - Player는 `loaded.src`(object URL)를 사용해 재생하고,
   - 분석/썸네일 로직은 동일 `MediaKey`로 이미 다운로드된 blob을 재활용할 수 있습니다.

이처럼 ArcDataPlayerManager를 중심으로 미디어 로드를 통합해두면,  
현재의 단순 스트리밍 구조에서 추후 고급 기능으로 자연스럽게 확장할 수 있습니다.


