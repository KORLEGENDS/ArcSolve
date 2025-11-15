'use client';

import { ArcYouChatRoom, ArcYouChatRoomList } from '@/client/components/arc/ArcYou/ArcYouChat';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Input } from '@/client/components/ui/input';
import { useState } from 'react';

export default function ArcYouDemoPage() {
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  return (
    <main className="min-h-screen w-full p-6">
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>ArcYouChat 데모</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 h-[600px]">
              {/* 좌측: 채팅방 목록 */}
              <div className="w-64 border-r border-border overflow-y-auto">
                <div className="p-2">
                  <ArcYouChatRoomList type="direct" />
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-muted-foreground">열고 싶은 채팅방 ID를 아래에 입력하세요.</p>
                    <Input
                      placeholder="채팅방 ID 입력"
                      value={selectedRoomId}
                      onChange={(event) => setSelectedRoomId(event.target.value)}
                    />
                  </div>
                </div>
              </div>
              {/* 우측: 선택된 채팅방 */}
              <div className="flex-1 p-4 border rounded-lg bg-muted/30">
                {selectedRoomId ? (
                  <ArcYouChatRoom id={selectedRoomId} />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    채팅방 ID를 입력하면 해당 방이 로드됩니다.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

