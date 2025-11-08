export function assetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_ASSET_BASE_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}


