'use client';

import {
  ArcYouChatRoomList,
  type ArcYouChatRoomListItemProps,
} from '@/client/components/arc/ArcYou/ArcYouChat';
import { Button } from '@/client/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/client/components/ui/dialog';
import { Input } from '@/client/components/ui/input';
import { Label } from '@/client/components/ui/label';
import { useArcyouChat } from '@/client/states/queries/useArcyouChat';
import { Plus } from 'lucide-react';
import * as React from 'react';

export function RightSidebarContent() {
  const { data: roomsData, isLoading, error, createRoom, isCreating } = useArcyouChat();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [roomName, setRoomName] = React.useState('');
  const [roomDescription, setRoomDescription] = React.useState('');

  const handleCreateRoom = React.useCallback(async () => {
    if (!roomName.trim()) return;

    try {
      await createRoom({
        name: roomName.trim(),
        description: roomDescription.trim() || null,
      });
      // 성공 시 폼 초기화 및 다이얼로그 닫기
      setRoomName('');
      setRoomDescription('');
      setIsDialogOpen(false);
    } catch (err) {
      console.error('채팅방 생성 실패:', err);
      // 에러는 React Query가 처리하므로 여기서는 로그만 출력
    }
  }, [roomName, roomDescription, createRoom]);

  // API 데이터를 컴포넌트 props 형식으로 변환
  const rooms: ArcYouChatRoomListItemProps[] = React.useMemo(() => {
    if (!roomsData) return [];

    return roomsData.map((room) => ({
      title: room.name,
      description: room.description || undefined,
      onClick: () => {
        console.log(`채팅방 선택: ${room.name} (${room.id})`);
        // TODO: 채팅방 선택 로직 구현
      },
      menuOptions: [
        {
          label: '대화방 정보',
          onClick: () => {
            console.log(`대화방 정보: ${room.name} (${room.id})`);
            // TODO: 대화방 정보 모달 표시
          },
        },
        {
          label: '알림 끄기',
          onClick: () => {
            console.log(`알림 끄기: ${room.name} (${room.id})`);
            // TODO: 알림 설정 변경
          },
        },
        {
          label: '대화방 나가기',
          onClick: () => {
            console.log(`대화방 나가기: ${room.name} (${room.id})`);
            // TODO: 대화방 나가기 로직 구현
          },
          separator: true,
        },
      ],
    }));
  }, [roomsData]);

  return (
    <div className="h-full w-full flex flex-col">
      {/* 검색 바 및 생성 버튼 */}
      <div className="flex gap-2 mb-2">
        <Input type="search" placeholder="채팅방 검색..." className="flex-1" />
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="icon" className="shrink-0">
              <Plus className="size-4" />
              <span className="sr-only">채팅방 생성</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 채팅방 만들기</DialogTitle>
              <DialogDescription>
                새로운 채팅방을 생성합니다. 생성 후 자동으로 참여됩니다.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="room-name">채팅방 이름</Label>
                <Input
                  id="room-name"
                  placeholder="채팅방 이름을 입력하세요"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && roomName.trim() && !isCreating) {
                      handleCreateRoom();
                    }
                  }}
                  disabled={isCreating}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="room-description">설명 (선택사항)</Label>
                <Input
                  id="room-description"
                  placeholder="채팅방 설명을 입력하세요"
                  value={roomDescription}
                  onChange={(e) => setRoomDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && roomName.trim() && !isCreating) {
                      handleCreateRoom();
                    }
                  }}
                  disabled={isCreating}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => setIsDialogOpen(false)}
                disabled={isCreating}
              >
                취소
              </Button>
              <Button onClick={handleCreateRoom} disabled={!roomName.trim() || isCreating}>
                {isCreating ? '생성 중...' : '생성'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {/* 채팅방 목록 */}
      <div className="flex-1 overflow-y-auto py-2 w-full">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            채팅방 목록을 불러오는 중...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 text-sm text-destructive">
            채팅방 목록을 불러오는 중 오류가 발생했습니다.
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            참여 중인 채팅방이 없습니다.
          </div>
        ) : (
          <ArcYouChatRoomList rooms={rooms} />
        )}
      </div>
    </div>
  );
}

