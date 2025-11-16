'use client';

import {
  ArcManagerListItem as ArcManagerListItemComponent,
  type ArcManagerListItem,
  type ItemType,
} from './ArcManagerListItem';

export interface ArcManagerListProps {
  items: ArcManagerListItem[];
  className?: string;
}

export function ArcManagerList({ items, className }: ArcManagerListProps) {
  return (
    <div className={className}>
      {items.map((item) => (
        <ArcManagerListItemComponent key={item.id} {...item} />
      ))}
    </div>
  );
}

export type { ArcManagerListItem, ItemType };
