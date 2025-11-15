'use client';

import { ArcYouChatRoomList } from '@/client/components/arc/ArcYou/ArcYouChat';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';

export default function ArcYouChatRoomListDemoPage() {
  return (
    <main className="min-h-screen w-full p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>ArcYouChatRoomList 데모</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">1:1 채팅</h3>
                <ArcYouChatRoomList type="direct" />
              </div>
              <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">그룹 채팅</h3>
                <ArcYouChatRoomList type="group" />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>실제 계정으로 로그인한 상태에서 접근하면 실시간 채팅방 목록이 표시됩니다.</p>
                <p>별도 목업 데이터는 더 이상 사용하지 않으며, ArcYou 서비스와 동일한 로직이 그대로 적용됩니다.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

