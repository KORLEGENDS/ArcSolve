'use client';

import * as React from 'react';

export type ArcManagerDragData = {
  source: 'arcmanager';
  documentId: string;
  path: string;
  name: string;
  kind: 'file' | 'note' | 'folder';
  itemType: 'folder' | 'item';
  mimeType?: string | null;
};

export type ArcManagerDropItem = {
  documentId: string;
  kind: 'file' | 'note' | 'folder';
  name: string;
  path: string;
  mimeType?: string | null;
};

export interface ArcManagerDropZoneProps {
  onSelect: (item: ArcManagerDropItem) => void;
  allowedKinds?: Array<'file' | 'note' | 'folder'>;
  className?: string;
  label?: React.ReactNode;
}

function parseArcManagerDragData(dt: DataTransfer | null): ArcManagerDragData | null {
  if (!dt) return null;
  const raw = dt.getData('application/x-arcmanager-item');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ArcManagerDragData>;
    if (parsed.source !== 'arcmanager' || !parsed.documentId || !parsed.name || !parsed.path) {
      return null;
    }
    return {
      source: 'arcmanager',
      documentId: parsed.documentId,
      path: parsed.path,
      name: parsed.name,
      kind: parsed.kind ?? 'file',
      itemType: parsed.itemType ?? 'item',
      mimeType: parsed.mimeType ?? null,
    };
  } catch {
    return null;
  }
}

export function ArcManagerDropZone({
  onSelect,
  allowedKinds,
  className,
  label,
}: ArcManagerDropZoneProps): React.ReactElement {
  const [isActive, setIsActive] = React.useState(false);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    const data = parseArcManagerDragData(event.dataTransfer);
    if (!data) {
      setIsActive(false);
      return;
    }
    if (allowedKinds && !allowedKinds.includes(data.kind)) {
      setIsActive(false);
      return;
    }
    event.preventDefault();
    setIsActive(true);
  };

  const handleDragLeave = () => {
    setIsActive(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const data = parseArcManagerDragData(event.dataTransfer);
    setIsActive(false);
    if (!data) return;
    if (allowedKinds && !allowedKinds.includes(data.kind)) return;

    onSelect({
      documentId: data.documentId,
      kind: data.kind,
      name: data.name,
      path: data.path,
      mimeType: data.mimeType,
    });
  };

  return (
    <div
      data-arcwork-drop-sink="true"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={[
        'flex flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-xs text-muted-foreground transition-colors',
        isActive ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/40',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label ?? (
        <>
          <p className="mb-1 font-medium">ArcManager에서 문서를 드래그해서 여기에 놓으세요.</p>
          <p className="text-[11px] text-muted-foreground/80">
            파일 트리에서 파일을 끌어다 놓으면 노트에 참조를 추가할 수 있습니다.
          </p>
        </>
      )}
    </div>
  );
}


