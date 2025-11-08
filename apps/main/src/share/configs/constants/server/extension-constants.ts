/**
 * 확장 프로그램(OAuth for Extension) 검증 유틸리티 (MVP)
 *
 * 필요한 환경변수 (.env):
 * - EXT_CLIENT_ID=ext_my_notes
 * - EXT_EXTENSION_ID=abcdefg1234567890abcdefg12345678
 * - EXT_ALLOWED_REDIRECTS=https://abcdefg1234567890.chromiumapp.org/cb
 */

import { z } from 'zod';

const envSchema = z.object({
  EXT_CLIENT_ID: z.string().min(1, 'EXT_CLIENT_ID is required'),
  EXT_EXTENSION_ID: z
    .string()
    .regex(
      /^[a-z0-9]{32}$/i,
      'EXT_EXTENSION_ID must be 32 chars (Chrome extension ID)'
    ),
  EXT_ALLOWED_REDIRECTS: z.string().min(1, 'EXT_ALLOWED_REDIRECTS is required'),
});

const parsedResult = envSchema.safeParse({
  EXT_CLIENT_ID: process.env['EXT_CLIENT_ID'],
  EXT_EXTENSION_ID: process.env['EXT_EXTENSION_ID'],
  EXT_ALLOWED_REDIRECTS: process.env['EXT_ALLOWED_REDIRECTS'],
});

interface ExtensionOAuthConfig {
  clientId: string;
  extensionId: string;
  audience: string;
  redirects: string[];
}

let cachedConfig: ExtensionOAuthConfig | null = null;

function computeConfig(): ExtensionOAuthConfig {
  if (cachedConfig) return cachedConfig;
  if (!parsedResult.success) {
    throw new Error(
      `Missing extension OAuth env: ${JSON.stringify(z.treeifyError(parsedResult.error))} `
    );
  }
  const env = parsedResult.data;
  const redirects = env.EXT_ALLOWED_REDIRECTS.split(',')
    .map((s) => s.trim())
    .filter((s): s is string => s.length > 0);
  const audience = `chrome-extension:${env.EXT_EXTENSION_ID}`;
  cachedConfig = {
    clientId: env.EXT_CLIENT_ID,
    extensionId: env.EXT_EXTENSION_ID,
    audience,
    redirects,
  };
  return cachedConfig;
}

/**
 * 클라이언트/리다이렉트 화이트리스트 검증
 */
export function validateClientAndRedirect(
  clientId: string,
  redirectUri: string
): boolean {
  const cfg = computeConfig();
  if (clientId !== cfg.clientId) return false;
  return cfg.redirects.includes(redirectUri);
}
