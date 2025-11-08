import { createElement, type ElementType, type ReactNode } from 'react';

export interface IconProps {
  className?: string;
  size?: number | string;
  'aria-hidden'?: boolean;
}

export type IconRenderer = (props?: IconProps) => ReactNode;

export interface IconRegistryNode {
  [key: string]: IconRegistryNode | IconRenderer;
}

export type ExtractTokens<
  T,
  Prefix extends string = ''
> = T extends IconRenderer
  ? Prefix extends ''
    ? never
    : Prefix
  : {
      [Key in keyof T]: ExtractTokens<
        T[Key],
        Prefix extends ''
          ? Extract<Key, string>
          : `${Prefix}.${Extract<Key, string>}`
      >
    }[keyof T];

export const createIconRenderer = <
  P extends {
    className?: string;
    size?: number | string;
    'aria-hidden'?: boolean;
  } & Record<string, unknown>
>(Component: ElementType<P>, defaults?: Partial<P>): IconRenderer => {
  const Renderer: IconRenderer = (props) => {
    const mergedProps = { ...(defaults ?? {}) } as P;
    if (props?.className !== undefined) {
      mergedProps.className = props.className as P['className'];
    }
    if (props?.size !== undefined) {
      mergedProps.size = props.size as P['size'];
    }
    if (props?.['aria-hidden'] !== undefined) {
      mergedProps['aria-hidden'] = props['aria-hidden'] as P['aria-hidden'];
    }
    return createElement(Component, mergedProps);
  };
  return Renderer;
};

export const isRenderer = (node: IconRegistryNode | IconRenderer): node is IconRenderer =>
  typeof node === 'function';

export const traverseRegistry = (
  node: IconRegistryNode | IconRenderer,
  segments: readonly string[],
  index = 0
): IconRenderer | undefined => {
  if (isRenderer(node)) {
    return index === segments.length ? node : undefined;
  }
  const key = segments[index];
  if (!key) return undefined;
  const next = node[key];
  if (!next) return undefined;
  return traverseRegistry(next, segments, index + 1);
};

export const resolveIconRenderer = (token: string, registry: IconRegistryNode): IconRenderer | undefined => {
  if (!token) return undefined;
  const segments = token.split('.');
  return traverseRegistry(registry, segments, 0);
};

export const createIconFromToken = (token: string, registry: IconRegistryNode, fallback: IconRenderer, props?: IconProps): ReactNode => {
  const renderer = resolveIconRenderer(token, registry) ?? fallback;
  return renderer({
    className: props?.className,
    size: props?.size ?? 14,
    'aria-hidden': props?.['aria-hidden'] ?? true,
  });
};

export type ArcManagerFileConfig = {
  default: IconRenderer;
  folder: IconRenderer;
  brands: {
    youtube: IconRenderer;
  };
  extensions: {
    csv: IconRenderer;
    doc: IconRenderer;
    docx: IconRenderer;
    html: IconRenderer;
    jpg: IconRenderer;
    jpeg: IconRenderer;
    pdf: IconRenderer;
    png: IconRenderer;
    ppt: IconRenderer;
    svg: IconRenderer;
    txt: IconRenderer;
    xls: IconRenderer;
    zip: IconRenderer;
  };
  groups: {
    image: IconRenderer;
    video: IconRenderer;
    audio: IconRenderer;
    archive: IconRenderer;
    spreadsheet: IconRenderer;
    code: IconRenderer;
    text: IconRenderer;
    document: IconRenderer;
    presentation: IconRenderer;
    pdf: IconRenderer;
    other: IconRenderer;
  };
};

export const classifyMime = (
  mimeType?: string | null
): keyof ArcManagerFileConfig['groups'] => {
  if (!mimeType) return 'other';
  const mt = mimeType.toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('video/')) return 'video';
  if (mt.startsWith('audio/')) return 'audio';
  if (mt === 'application/pdf') return 'pdf';
  if (
    mt === 'application/zip' ||
    mt === 'application/x-zip-compressed' ||
    mt.includes('compressed') ||
    mt === 'application/x-tar' ||
    mt.includes('gzip')
  )
    return 'archive';
  if (
    mt.startsWith('text/') ||
    mt === 'application/json' ||
    mt === 'application/xml' ||
    mt === 'application/x-yaml' ||
    mt === 'text/markdown'
  )
    return 'text';
  if (
    mt === 'application/msword' ||
    mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
    return 'document';
  if (
    mt === 'application/vnd.ms-powerpoint' ||
    mt === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  )
    return 'presentation';
  if (
    mt === 'application/vnd.ms-excel' ||
    mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mt === 'text/csv'
  )
    return 'spreadsheet';
  if (
    mt === 'application/javascript' ||
    mt === 'text/javascript' ||
    mt === 'application/typescript' ||
    mt === 'application/x-sh' ||
    mt === 'text/x-python' ||
    mt === 'text/x-go' ||
    mt === 'text/x-java'
  )
    return 'code';
  return 'other';
};

export const pickTablerByName = (name: string | undefined | null, extensions: ArcManagerFileConfig['extensions']): IconRenderer | undefined => {
  if (!name) return undefined;
  const last = name.split('.').pop();
  if (!last) return undefined;
  const ext = last.toLowerCase();
  return extensions[ext as keyof typeof extensions];
};

export const createResolveRegistryFileIcon = (params: {
  name?: string;
  mimeType?: string | null;
}, fileConfig: ArcManagerFileConfig): IconRenderer => {
  const mimeType = params?.mimeType;
  if (mimeType === 'video/youtube') {
    return fileConfig.brands.youtube;
  }
  const tablerIcon = pickTablerByName(params?.name, fileConfig.extensions);
  if (tablerIcon) return tablerIcon;
  const group = classifyMime(mimeType);
  return fileConfig.groups[group] ?? fileConfig.default;
};

export const createRenderRegistryFileIcon = (params: {
  name?: string;
  mimeType?: string | null;
  className?: string;
  size?: number | string;
  'aria-hidden'?: boolean;
}, fileConfig: ArcManagerFileConfig): ReactNode => {
  const renderer = createResolveRegistryFileIcon({
    name: params?.name,
    mimeType: params?.mimeType,
  }, fileConfig);
  return renderer({
    className: params?.className,
    size: params?.size ?? 24,
    'aria-hidden': params?.['aria-hidden'],
  });
};
