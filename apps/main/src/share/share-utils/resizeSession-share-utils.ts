/**
 * 전역 리사이즈 세션/오버레이 유틸
 *
 * 목적
 * - 드래그 리사이즈 중 iframe/웹뷰/오버레이 등으로 인한 포인터 이벤트 유실을 원천 차단합니다
 * - pointer 이벤트로 표준화하고, 종료/취소 케이스를 안전하게 수거합니다
 *
 * 언제 사용하나요?
 * - 리사이즈 드래그 경로에 iframe/웹뷰/복잡한 오버레이가 있을 수 있을 때
 * - 마우스/펜/터치 혼합 입력 환경에서 안정적인 추적/종료가 필요할 때
 *
 * 핵심 동작
 * - 세션 시작 시, 화면 전면 고정 투명 오버레이를 body에 추가하여 히트 타깃을 상위 문서로 고정합니다
 * - 전역(캡처 단계) pointermove/up/cancel + Escape에 리스너를 등록합니다
 * - 종료/취소 시 리스너/오버레이/루트 클래스 토글을 모두 정리합니다
 * - 동시 1개 세션만 유지(새 시작 시 기존 세션 cancel)
 *
 * API 요약
 * - ResizeOverlay.start(options): ResizeSessionHandle
 *   - 요소 레벨(onPointerDown 등)에서 직접 세션을 시작할 때 사용합니다(예: Sidebar 레일)
 *
 * - ResizeOverlay.bindPointerDown({ attachTo, capture, predicate, ...options }): () => void
 *   - 특정 대상(윈도우/문서/엘리먼트)에 pointerdown 리스너를 바인딩하여, 조건(predicate) 충족 시 세션을 시작합니다
 *   - ArcWork처럼 “윈도우 캡처 단계 + .dv-sash 조건”이 필요한 경우에 적합합니다
 *
 * - ResizeOverlay.cancelActive(): void
 *   - 활성 세션이 있으면 취소합니다(언마운트 시 안전 정리용)
 *
 * options 상세(공통)
 * - cursor?: 'ew-resize' | 'ns-resize' | 'grabbing' | 'col-resize' | 'row-resize'
 *   - 드래그 중 표시할 커서(기본: 'ew-resize')
 * - onMove: (e: PointerEvent) => void
 *   - 이동 시 호출되는 콜백(Sidebar처럼 계산을 직접 할 때 필요)
 *   - ArcWork처럼 라이브러리가 계산을 담당하면 빈 함수로 두세요
 * - onEnd?: () => void
 *   - 정상 종료(pointerup) 시 호출
 * - onCancel?: () => void
 *   - 취소(pointercancel/blur/visibilitychange/Escape) 시 호출
 * - rootClassName?: string
 *   - 드래그 동안 토글할 루트 클래스명(시각 피드백/선택적 CSS 훅)
 * - rootClassElement?: Element
 *   - 위 클래스의 토글 대상을 지정(기본: document.documentElement)
 *   - ArcWork처럼 특정 루트 컨테이너에만 클래스가 필요하면 해당 엘리먼트를 전달하세요
 * - zIndex?: number
 *   - 오버레이 z-index(기본: 최상위 근접 2147483646)
 *
 * 보장/제약
 * - 오버레이는 body에 1개 생성되며 pointer-events: auto 로 iframe으로의 히트 테스트를 차단합니다
 * - 전역 리스너는 모두 캡처 단계로 등록됩니다(버블 차단에 영향받지 않음)
 * - 세션은 항상 단일 활성 상태이며, 새 세션 시작 시 기존 세션을 cancel 합니다
 * - 클라이언트 전용 코드입니다(SSR 환경에서는 마운트 이후에만 동작)
 *
 * 사용 예시
 * 1) Sidebar 레일(요소 트리거)
 *   onPointerDown에서 바로 시작하고, onMove에서 폭 계산을 수행합니다
 *   const handlePointerDown = (e: React.PointerEvent) => {
 *     const session = ResizeOverlay.start({
 *       cursor: 'ew-resize',
 *       rootClassName: 'sidebar-resizing',
 *       onMove: handlePointerMove, // 현재 폭 계산 로직 호출
 *       onEnd: () => finalize('end'),
 *       onCancel: () => finalize('cancel'),
 *     });
 *   };
 *
 * 2) ArcWork(.dv-sash, 윈도우 캡처 단계 + 조건 트리거)
 *   useEffect(() => {
 *     const unbind = ResizeOverlay.bindPointerDown({
 *       attachTo: window,
 *       capture: true,
 *       predicate: (e) => !!(e.target as Element | null)?.closest('.dv-sash'),
 *       cursor: 'ew-resize',
 *       rootClassName: 'arcwork-resizing',
 *       rootClassElement: rootRef.current ?? undefined,
 *       onMove: () => {}, // Dockview가 계산 담당
 *     });
 *     return () => {
 *       unbind();
 *       ResizeOverlay.cancelActive();
 *     };
 *   }, []);
 *
 * 3) 커서/루트 클래스 커스터마이즈
 *   - 수직 리사이즈에는 'ns-resize'를, 특정 스타일 훅이 필요하면 rootClassName/rootClassElement를 조합합니다
 *
 * 주의사항
 * - 시작 트리거는 맥락에 맞게 연결해야 합니다: Sidebar는 요소 레벨, ArcWork는 윈도우 캡처 + .dv-sash 조건
 * - onMove 내 연산/리렌더 비용을 최소화하세요(고빈도 호출)
 * - 앱 전역 고정 레이어가 있다면 z-index를 조정해 최상위 보장을 확인하세요
 */

export type ResizeCursor = 'ew-resize' | 'ns-resize' | 'grabbing' | 'col-resize' | 'row-resize';

export interface ResizeSessionOptions {
  cursor?: ResizeCursor;
  onMove: (e: PointerEvent) => void;
  onEnd?: () => void;
  onCancel?: () => void;
  rootClassName?: string;
  /**
   * Optional element to toggle rootClassName on. Defaults to document.documentElement.
   */
  rootClassElement?: Element;
  zIndex?: number;
}

export interface ResizeSessionHandle {
  active: boolean;
  end: () => void;
  cancel: () => void;
}

let activeSession: {
  overlayEl: HTMLDivElement;
  removeListeners: () => void;
  handle: ResizeSessionHandle;
} | null = null;

function createOverlay(zIndex: number, cursor: ResizeCursor | undefined): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-resize-overlay', 'true');
  const style = overlay.style as CSSStyleDeclaration;
  style.position = 'fixed';
  style.inset = '0px';
  style.zIndex = String(zIndex);
  style.background = 'transparent';
  style.pointerEvents = 'auto';
  style.cursor = cursor ?? 'ew-resize';
  style.touchAction = 'none';
  return overlay;
}

function safeRemove(node: Element | null): void {
  if (!node) return;
  try {
    if (node.parentNode) node.parentNode.removeChild(node);
  } catch {
    // noop
  }
}

export const ResizeOverlay = {
  start(options: ResizeSessionOptions): ResizeSessionHandle {
    const { cursor, onMove, onEnd, onCancel, rootClassName, rootClassElement, zIndex = 2147483646 } = options;

    // 기존 세션이 있다면 취소 후 교체
    if (activeSession) {
      activeSession.handle.cancel();
    }

    const overlayEl = createOverlay(zIndex, cursor);
    document.body.appendChild(overlayEl);

    const classTarget = rootClassElement ?? document.documentElement;
    if (rootClassName) {
      classTarget.classList.add(rootClassName);
    }

    let ended = false;

    const handlePointerMove = (e: PointerEvent): void => {
      if (ended) return;
      onMove(e);
    };

    const finalize = (kind: 'end' | 'cancel'): void => {
      if (ended) return;
      ended = true;

      removeListeners();
      safeRemove(overlayEl);
      if (rootClassName) {
        classTarget.classList.remove(rootClassName);
      }
      activeSession = null;

      if (kind === 'end') onEnd?.();
      else onCancel?.();
    };

    const handlePointerUp = (): void => finalize('end');
    const handlePointerCancel = (): void => finalize('cancel');
    const handleKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') finalize('cancel');
    };

    const removeListeners = (): void => {
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerup', handlePointerUp, true);
      document.removeEventListener('pointercancel', handlePointerCancel, true);
      document.removeEventListener('keydown', handleKeydown, true);
    };

    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('pointercancel', handlePointerCancel, true);
    document.addEventListener('keydown', handleKeydown, true);

    const handle: ResizeSessionHandle = {
      active: true,
      end: () => finalize('end'),
      cancel: () => finalize('cancel'),
    };

    activeSession = { overlayEl, removeListeners, handle };

    return handle;
  },
  /**
   * Bind a pointerdown trigger to start a resize session when predicate returns true.
   * Returns an unbind function.
   */
  bindPointerDown(options: ResizeSessionOptions & {
    attachTo: Window | Document | Element;
    capture?: boolean;
    predicate: (e: PointerEvent) => boolean;
  }): () => void {
    const { attachTo, capture = false, predicate, ...startOptions } = options as any;
    const listener = (e: Event): void => {
      const pe = e as PointerEvent;
      try {
        if (predicate(pe)) {
          // Start a session; calculation is delegated to caller via onMove
          ResizeOverlay.start(startOptions as ResizeSessionOptions);
        }
      } catch {
        // ignore predicate errors
      }
    };

    (attachTo as Window | Document | Element).addEventListener('pointerdown', listener as EventListener, capture);
    return (): void => {
      (attachTo as Window | Document | Element).removeEventListener('pointerdown', listener as EventListener, capture);
    };
  },
  /** Cancel any active overlay session, if present. */
  cancelActive(): void {
    if (activeSession) {
      activeSession.handle.cancel();
    }
  },
};

export type { ResizeSessionOptions as ResizeSessionStartOptions };


