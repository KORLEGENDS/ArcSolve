/**
 * ArcYou 공통 WebSocket 유틸 훅
 *
 * - `/api/arcyou/chat/ws/token` 엔드포인트에서 JWT 토큰을 발급받고
 * - `NEXT_PUBLIC_CHAT_WS_URL` 로 WebSocket을 생성한 뒤
 * - 호출자에게 WebSocket 인스턴스와 토큰을 넘겨주는 공통 로직을 캡슐화합니다.
 *
 * 실제 프로토콜 처리(rooms.watch, room.join, message.created 등)는
 * onSetup 콜백에서 각 도메인 훅/컴포넌트가 담당합니다.
 */

import { clientEnv } from '@/share/configs/environments/client-constants';
import { useEffect } from 'react';

export interface ArcYouGatewaySocketOptions {
  /**
   * 생성된 WebSocket 인스턴스를 보관할 ref
   * - 호출 측에서 send/close 등에 사용
   */
  wsRef: React.RefObject<WebSocket | null>;
  /**
   * WebSocket이 생성된 직후 호출되는 콜백
   * - 여기에서 open/message/error/close 핸들러를 등록하고
   * - `{ op: 'auth', token }` 전송 등 프로토콜별 초기화를 수행합니다.
   */
  onSetup: (ws: WebSocket, token: string) => void;
  /**
   * 연결 활성화 여부
   * - false일 경우 토큰 발급 및 WebSocket 연결을 시도하지 않습니다.
   */
  enabled?: boolean;
  /**
   * 의존성 배열
   * - 동일한 wsUrl/옵션에서 재연결이 필요할 때 사용합니다.
   * - 예: roomId가 바뀔 때마다 새로운 소켓을 열고 싶다면 deps에 roomId를 포함합니다.
   */
  deps?: React.DependencyList;
}

export function useArcYouGatewaySocket(options: ArcYouGatewaySocketOptions) {
  const { wsRef, onSetup, enabled = true, deps = [] } = options;

  useEffect(() => {
    const wsUrl = clientEnv.NEXT_PUBLIC_CHAT_WS_URL;
    if (!enabled || !wsUrl) {
      return;
    }

    let closed = false;
    let ws: WebSocket | null = null;

    (async () => {
      try {
        const r = await fetch('/api/arcyou/chat/ws/token', { method: 'GET' });
        if (!r.ok) {
          return;
        }

        const { token } = (await r.json()) as { token: string };
        if (closed) return;

        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        onSetup(ws, token);
      } catch {
        // 토큰 발급 실패나 WebSocket 생성 실패는 사용자 경험에 치명적이지 않으므로 조용히 무시
      }
    })();

    return () => {
      closed = true;
      try {
        ws?.close();
      } catch {
        // ignore
      }
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
}


