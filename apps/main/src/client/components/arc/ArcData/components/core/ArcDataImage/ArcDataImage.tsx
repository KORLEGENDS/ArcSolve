'use client';

import Image from 'next/image';

export interface ArcDataImageProps {
  src: string;
  mimeType?: string | null;
  name?: string | null;
  isExternal?: boolean;
}

/**
 * ArcDataImage
 * - 순수 이미지 뷰어 (부가 UI 없음)
 */
export function ArcDataImage({
  src,
  name,
  isExternal = false,
}: ArcDataImageProps): React.ReactElement {
  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <div className="relative h-full w-full">
        <Image
          src={src}
          alt={name ?? 'ArcData image'}
          fill
          draggable={false}
          priority
          unoptimized={isExternal}
          sizes="100vw"
          className="object-contain"
        />
      </div>
    </div>
  );
}

export default ArcDataImage;

