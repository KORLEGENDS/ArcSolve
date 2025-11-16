'use client';

import { ArcData } from '@/client/components/arc/ArcData/ArcData';
import { ArcManager } from '@/client/components/arc/ArcManager/ArcManager';
import { FolderOpenDot, MessageSquare, Notebook } from 'lucide-react';
import * as React from 'react';

export function LeftSidebarContent() {
  const tabs = React.useMemo(
    () => [
      { value: 'notes', icon: Notebook, label: '노트' },
      { value: 'files', icon: FolderOpenDot, label: '파일' },
      { value: 'chat', icon: MessageSquare, label: '채팅' },
    ],
    []
  );

  return (
    <ArcManager className="h-full" tabs={tabs} defaultTab="notes">
      <ArcManager.TabPanel value="notes">
        <ArcData type="notes" className="h-full" />
      </ArcManager.TabPanel>
      <ArcManager.TabPanel value="files">
        <ArcData type="files" className="h-full" />
      </ArcManager.TabPanel>
      <ArcManager.TabPanel value="chat">
        <ArcData type="chat" className="h-full" />
      </ArcManager.TabPanel>
    </ArcManager>
  );
}

