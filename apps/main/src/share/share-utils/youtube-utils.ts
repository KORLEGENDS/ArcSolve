/**
 * YouTube 유틸리티
 * - URL로부터 videoId 추출
 * - oEmbed를 이용한 동영상 제목(title) 조회
 */

export interface YoutubeOEmbedResponse {
  title: string;
  author_name?: string;
  author_url?: string;
  type?: string;
  height?: number;
  width?: number;
  version?: string;
  provider_name?: string;
  provider_url?: string;
  thumbnail_height?: number;
  thumbnail_width?: number;
  thumbnail_url?: string;
  html?: string;
}

/**
 * 지원 가능한 YouTube 호스트 여부
 */
export function isYoutubeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'youtu.be' ||
    host === 'www.youtu.be' ||
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host.endsWith('.youtube.com')
  );
}

/**
 * 다양한 YouTube URL 형태에서 videoId를 추출합니다.
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 */
export function extractYoutubeVideoId(inputUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(inputUrl);
  } catch {
    return null;
  }

  if (!isYoutubeHost(url.hostname)) return null;

  // 1) watch?v=VIDEO_ID
  const v = url.searchParams.get('v');
  if (v && /^[a-zA-Z0-9_-]{6,}$/.test(v)) return v;

  // 2) youtu.be/VIDEO_ID
  if (url.hostname.toLowerCase().includes('youtu.be')) {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
    if (id && /^[a-zA-Z0-9_-]{6,}$/.test(id)) return id;
  }

  // 3) /embed/VIDEO_ID, /shorts/VIDEO_ID, /v/VIDEO_ID
  const segments = url.pathname.split('/').filter(Boolean);
  const i = segments.findIndex((s) => ['embed', 'shorts', 'v'].includes(s));
  if (i >= 0 && segments[i + 1]) {
    const id = segments[i + 1];
    if (id && /^[a-zA-Z0-9_-]{6,}$/.test(id)) return id;
  }

  return null;
}

/**
 * videoId를 canonical watch URL로 변환합니다.
 */
export function toYoutubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

/**
 * YouTube oEmbed 엔드포인트 URL 생성
 * 참고: https://www.youtube.com/oembed?url=...&format=json
 */
export function buildYoutubeOEmbedUrl(videoUrl: string): string {
  const url = new URL('https://www.youtube.com/oembed');
  url.searchParams.set('url', videoUrl);
  url.searchParams.set('format', 'json');
  return url.toString();
}

/**
 * YouTube oEmbed로부터 제목(title)을 조회합니다.
 * - 입력: 다양한 형태의 YouTube 링크
 * - 동작: 가능하면 videoId를 추출하여 canonical watch URL로 요청 → 호환성 향상
 * - 실패 시 null 반환
 */
export async function fetchYoutubeTitle(inputUrl: string, options?: {
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<string | null> {
  const id = extractYoutubeVideoId(inputUrl);
  const canonicalUrl = id ? toYoutubeWatchUrl(id) : inputUrl;

  const oembedUrl = buildYoutubeOEmbedUrl(canonicalUrl);

  // 타임아웃 구성
  const controller = new AbortController();
  const timeout = typeof options?.timeoutMs === 'number' && options.timeoutMs > 0
    ? options.timeoutMs
    : 6000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(oembedUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options?.signal ?? controller.signal,
      // oEmbed는 공개 엔드포인트. 별도 인증 헤더 불필요
      cache: 'no-store',
    } as RequestInit);

    if (!res.ok) return null;
    const data = (await res.json()) as Partial<YoutubeOEmbedResponse>;
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    return title.length > 0 ? title : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * YouTube 제목을 가져오되, 실패 시 제공된 기본값으로 대체합니다.
 */
export async function resolveYoutubeTitle(inputUrl: string, fallbackName = 'YouTube Video'):
  Promise<string> {
  const title = await fetchYoutubeTitle(inputUrl).catch(() => null);
  return title ?? fallbackName;
}


