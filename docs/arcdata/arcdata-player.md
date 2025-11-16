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
    - 최종 재생 URL(`src`)을 결정해 `ArcDataPlayer`에 전달

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
   - 응답의 `download.url`을 `src`로 사용합니다.

3. **에러 처리**
   - `useDocumentDownloadUrl`에서 에러가 발생하면 콘솔 로그만 남기고 `null`을 반환합니다(MVP 기준).
   - `src`가 최종적으로 결정되지 않거나, 아직 로딩 중이면 렌더링하지 않습니다.

요약하면:

- YouTube / 외부 미디어 → `storageKey` 그대로 재생  
- ArcSolve R2에 저장된 파일 → `/download-url` 서명 URL 발급 후 재생

---

## 4. ArcDataPlayer 컴포넌트 API

파일 위치:  
`apps/main/src/client/components/arc/ArcData/components/core/ArcDataPlayer/ArcDataPlayer.tsx`

### 4.1. Props

```ts
export interface ArcDataPlayerProps {
  src: string;
  mimeType?: string | null;
  title?: string;
  className?: string;
  zoom?: number; // 25~500 (width 비율, %)
  config?: Record<string, unknown>;
  onReady?: () => void;
  onError?: (error: unknown) => void;
}
```

### 4.2. 동작 요약

- 내부적으로 `react-player`를 다음과 같이 래핑합니다.

```tsx
<AnyReactPlayer
  src={src}
  width="100%"
  height={isAudio ? '64px' : '100%'}
  controls
  config={config}
  playsInline
  onReady={handleReadyInternal}
  onError={onError}
  title={title}
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

> 주의: `react-player` v3 기준으로 URL prop 이름은 `src`입니다.  
> (과거 문서/예제에서 `url`을 사용하는 경우가 있으나, 현재 구현에서는 `src`를 사용해야 합니다.)

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


