import { z } from 'zod';

const youtubeOembedResponseSchema = z.object({
  title: z.string().optional(),
});

/**
 * 주어진 YouTube URL에 대해 oEmbed API를 호출하여 제목을 가져옵니다.
 * - 실패 시 null을 반환합니다.
 */
export async function fetchYoutubeTitle(
  inputUrl: string,
  options?: {
    signal?: AbortSignal;
    timeoutMs?: number;
  },
): Promise<string | null> {
  const oembedUrl = new URL('https://www.youtube.com/oembed');
  oembedUrl.searchParams.set('url', inputUrl);
  oembedUrl.searchParams.set('format', 'json');

  const controller = new AbortController();
  const timeout =
    typeof options?.timeoutMs === 'number' && options.timeoutMs > 0
      ? options.timeoutMs
      : 6000;

  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(oembedUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options?.signal ?? controller.signal,
      cache: 'no-store',
    } as RequestInit);

    if (!res.ok) return null;

    const json = (await res.json()) as unknown;
    const parsed = youtubeOembedResponseSchema.safeParse(json);
    if (!parsed.success) return null;

    const title = typeof parsed.data.title === 'string' ? parsed.data.title.trim() : '';
    return title.length > 0 ? title : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}


