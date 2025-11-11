'use client';

import type {
  Action,
  BorderNode,
  DragRectRenderCallback,
  Node as FlexLayoutNode,
  I18nLabel,
  IGlobalAttributes,
  IIcons,
  IJsonModel,
  ITabRenderValues,
  ITabSetRenderValues,
  NodeMouseEvent,
  ShowOverflowMenuCallback,
  TabNode,
  TabSetNode,
  TabSetPlaceHolderCallback,
} from 'flexlayout-react';
import { Layout, Model } from 'flexlayout-react';
// combined.css에는 모든 테마(light, dark)가 포함되어 있으며 클래스명으로 활성화됩니다
import {
  useServiceMakeExternalDragHandler,
  useServiceSaveLayout,
  useServiceSetModel,
  useServiceSetLayoutRef,
} from '@/client/states/stores/service-store';
import 'flexlayout-react/style/combined.css';
import { useTheme } from 'next-themes';
import * as React from 'react';
import { ARCWORK_DEFAULT_THEME, type ArcWorkTheme } from './ArcWork-config';
import './ArcWork.css';
import {
  createClassNameMapper,
  createDragRectRenderCallback,
  createFactory,
  createI18nMapper,
  createIconsConfig,
  createOverflowMenuCallback,
  createTabRenderCallback,
  createTabSetPlaceholderCallback,
  createTabSetRenderCallback,
  defaultArcWorkFactory,
} from './components';

export interface ArcWorkGlobalOptions extends Partial<IGlobalAttributes> {
  /**
   * 레이아웃의 루트 방향을 세로로 설정합니다 (기본값: false - 가로)
   */
  rootOrientationVertical?: boolean;
  /**
   * 스플리터 크기 (픽셀, 기본값: 8)
   */
  splitterSize?: number;
  /**
   * 스플리터 추가 히트 테스트 영역 (픽셀, 기본값: 0)
   */
  splitterExtra?: number;
  /**
   * 스플리터 중앙 핸들 활성화 (기본값: false)
   */
  splitterEnableHandle?: boolean;
  /**
   * 엣지 도킹 활성화 (기본값: true)
   */
  enableEdgeDock?: boolean;
}

export interface ArcWorkProps {
  /**
   * 컨테이너 클래스명
   */
  className?: string;
  /**
   * 기본 레이아웃 모델 또는 JSON 모델 (필수)
   */
  defaultLayout: Model | IJsonModel;
  /**
   * 모델 변경 시 호출되는 콜백
   */
  onModelChange?: (model: Model, action: Action) => void;
  /**
   * 전역 레이아웃 옵션
   */
  globalOptions?: ArcWorkGlobalOptions;
  /**
   * 팩토리 함수 - 탭 컴포넌트를 생성합니다
   */
  factory?: (node: TabNode) => React.ReactNode;
  /**
   * 실시간 리사이즈 활성화 (스플리터 드래그 중 즉시 리사이즈, 기본값: false)
   * 주의: 탭 렌더링이 느릴 경우 끊김 현상이 발생할 수 있습니다
   */
  realtimeResize?: boolean;
  /**
   * 액션 발생 시 호출되는 콜백 (액션을 가로채거나 수정할 수 있습니다)
   * undefined를 반환하면 액션이 취소됩니다
   */
  onAction?: (action: Action) => Action | undefined;
  /**
   * 탭 렌더링 커스터마이징 콜백
   */
  onRenderTab?: (node: TabNode, renderValues: ITabRenderValues) => void;
  /**
   * 탭셋 렌더링 커스터마이징 콜백
   */
  onRenderTabSet?: (tabSetNode: TabSetNode | BorderNode, renderValues: ITabSetRenderValues) => void;
  /**
   * 외부 드래그 앤 드롭 처리 콜백
   */
  onExternalDrag?: (event: React.DragEvent<HTMLElement>) =>
    | undefined
    | {
        json: any;
        onDrop?: (node?: FlexLayoutNode, event?: React.DragEvent<HTMLElement>) => void;
      };
  /**
   * 아이콘 커스터마이징
   */
  icons?: IIcons;
  /**
   * CSS 클래스명 매퍼 (CSS 모듈 사용 시 유용)
   */
  classNameMapper?: (defaultClassName: string) => string;
  /**
   * 다국어 라벨 매퍼
   */
  i18nMapper?: (id: I18nLabel, param?: string) => string | undefined;
  /**
   * 팝아웃 지원 여부 (기본값: userAgent 기반 자동 감지)
   */
  supportsPopout?: boolean;
  /**
   * 팝아웃 윈도우 URL (기본값: 'popout.html')
   */
  popoutURL?: string;
  /**
   * 팝아웃 윈도우 클래스명
   */
  popoutClassName?: string;
  /**
   * 팝아웃 윈도우 이름 (기본값: 'Popout Window')
   */
  popoutWindowName?: string;
  /**
   * 드래그 사각형 렌더링 콜백
   */
  onRenderDragRect?: DragRectRenderCallback;
  /**
   * 컨텍스트 메뉴 핸들러
   */
  onContextMenu?: NodeMouseEvent;
  /**
   * 보조 마우스 클릭 핸들러 (Alt, Meta, Shift 키 또는 중간 버튼 클릭)
   */
  onAuxMouseClick?: NodeMouseEvent;
  /**
   * 탭 오버플로우 메뉴 표시 핸들러
   */
  onShowOverflowMenu?: ShowOverflowMenuCallback;
  /**
   * 빈 탭셋 플레이스홀더 렌더링 콜백
   */
  onTabSetPlaceHolder?: TabSetPlaceHolderCallback;
  /**
   * 반응형 레이아웃 활성화 (기본값: true)
   * ResizeObserver를 사용하여 컨테이너 크기 변경을 감지합니다
   */
  responsive?: boolean;
  /**
   * 레이아웃 변경 시 자동 저장 활성화 (기본값: true)
   * false로 설정하면 자동 저장이 비활성화됩니다
   */
  autoSave?: boolean;
  /**
   * 자동 저장 디바운스 지연 시간 (밀리초, 기본값: 200)
   * 레이아웃 변경 후 이 시간만큼 대기한 후 저장합니다
   */
  autoSaveDelayMs?: number;
}

export function ArcWork({
  className,
  defaultLayout,
  onModelChange,
  globalOptions,
  factory,
  realtimeResize = true,
  onAction,
  onRenderTab,
  onRenderTabSet,
  onExternalDrag,
  icons,
  classNameMapper,
  i18nMapper,
  supportsPopout,
  popoutURL,
  popoutClassName,
  popoutWindowName,
  onRenderDragRect,
  onContextMenu,
  onAuxMouseClick,
  onShowOverflowMenu,
  onTabSetPlaceHolder,
  responsive = true,
  autoSave = true,
  autoSaveDelayMs = 200,
}: ArcWorkProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const layoutRef = React.useRef<Layout | null>(null);
  
  // 자동 저장 관련 훅
  const setServiceModel = useServiceSetModel();
  const setLayoutRef = useServiceSetLayoutRef();
  const saveLayout = useServiceSaveLayout();
  
  // 디바운스 타이머 ref
  const saveTimerRef = React.useRef<number | null>(null);
  const makeExternalDragHandler = useServiceMakeExternalDragHandler();
  
  // 테마 관리: next-themes와 동기화
  const { resolvedTheme } = useTheme();

  // 테마 결정: resolvedTheme 사용, 없으면 기본값 사용
  const theme = React.useMemo<ArcWorkTheme>(() => {
    if (resolvedTheme === 'dark') {
      return 'dark';
    }
    if (resolvedTheme === 'light') {
      return 'light';
    }
    // resolvedTheme이 undefined인 경우(초기 렌더링) 기본값 사용
    return ARCWORK_DEFAULT_THEME;
  }, [resolvedTheme]);

  // 테마 클래스명 생성
  const themeClass = React.useMemo(() => {
    return `flexlayout__theme_${theme}`;
  }, [theme]);

  // 모델 초기화
  const [model] = React.useState<Model>(() => {
    if (defaultLayout instanceof Model) {
      return defaultLayout;
    }
    const jsonModel = defaultLayout as IJsonModel;
    // globalOptions를 JSON 모델에 병합
    if (globalOptions && jsonModel.global) {
      jsonModel.global = { ...jsonModel.global, ...globalOptions };
    } else if (globalOptions) {
      jsonModel.global = globalOptions;
    }
    return Model.fromJson(jsonModel);
  });

  // 모델을 스토어에 등록 (마운트 시 및 model 변경 시)
  React.useEffect(() => {
    setServiceModel(model);
  }, [model, setServiceModel]);

  // 자동 저장 스케줄링 함수
  const scheduleSave = React.useCallback(() => {
    if (!autoSave) return;

    // 기존 타이머 취소
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    // 새로운 타이머 설정
    saveTimerRef.current = window.setTimeout(() => {
      saveLayout();
      saveTimerRef.current = null;
    }, autoSaveDelayMs);
  }, [autoSave, autoSaveDelayMs, saveLayout]);

  // 모델 변경 핸들러 (외부 콜백 + 자동 저장)
  const handleModelChange = React.useCallback(
    (changedModel: Model, action: Action) => {
      // 외부 콜백 호출
      onModelChange?.(changedModel, action);

      // 자동 저장 스케줄링
      scheduleSave();
    },
    [onModelChange, scheduleSave]
  );

  // 언마운트 시 타이머 정리
  React.useEffect(() => {
    return () => {
      setLayoutRef(null);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  // 테마 변경 시 컨테이너 className 업데이트
  React.useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    // 기존 테마 클래스 제거
    containerRef.current.classList.remove('flexlayout__theme_light', 'flexlayout__theme_dark');
    // 새로운 테마 클래스 추가
    containerRef.current.classList.add(themeClass);
  }, [themeClass]);

  // 반응형 레이아웃: ResizeObserver를 사용하여 컨테이너 크기 변경 감지
  React.useEffect(() => {
    if (!responsive || !containerRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      // 레이아웃이 자동으로 리사이즈를 처리하지만, 명시적으로 redraw 호출
      layoutRef.current?.redraw();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [responsive]);

  // 커스텀 컴포넌트 콜백 생성
  const factoryCallback = React.useCallback(
    createFactory(factory || defaultArcWorkFactory),
    [factory]
  );

  const tabRenderCallback = React.useCallback(
    createTabRenderCallback(onRenderTab),
    [onRenderTab]
  );

  const tabSetRenderCallback = React.useCallback(
    createTabSetRenderCallback(onRenderTabSet),
    [onRenderTabSet]
  );

  const dragRectRenderCallback = React.useCallback(
    createDragRectRenderCallback(onRenderDragRect),
    [onRenderDragRect]
  );

  const tabSetPlaceholderCallback = React.useCallback(
    createTabSetPlaceholderCallback(onTabSetPlaceHolder),
    [onTabSetPlaceHolder]
  );

  const overflowMenuCallback = React.useCallback(
    createOverflowMenuCallback(onShowOverflowMenu),
    [onShowOverflowMenu]
  );

  const iconsConfig = React.useMemo(() => createIconsConfig(icons), [icons]);

  const classNameMapperCallback = React.useCallback(
    createClassNameMapper(classNameMapper),
    [classNameMapper]
  );

  const i18nMapperCallback = React.useCallback(
    createI18nMapper(i18nMapper),
    [i18nMapper]
  );

  return (
    <div ref={containerRef} className={`${themeClass} ${className || ''}`} style={{ width: '100%', height: '100%' }}>
      <Layout
        ref={(el) => {
          layoutRef.current = el;
          setLayoutRef(el);
        }}
        model={model}
        factory={factoryCallback}
        onModelChange={handleModelChange}
        realtimeResize={realtimeResize}
        onAction={onAction}
        onRenderTab={tabRenderCallback}
        onRenderTabSet={tabSetRenderCallback}
        onExternalDrag={onExternalDrag ?? makeExternalDragHandler()}
        icons={iconsConfig}
        classNameMapper={classNameMapperCallback}
        i18nMapper={i18nMapperCallback}
        supportsPopout={supportsPopout}
        popoutURL={popoutURL}
        popoutClassName={popoutClassName}
        popoutWindowName={popoutWindowName}
        onRenderDragRect={dragRectRenderCallback}
        onContextMenu={onContextMenu}
        onAuxMouseClick={onAuxMouseClick}
        onShowOverflowMenu={overflowMenuCallback}
        onTabSetPlaceHolder={tabSetPlaceholderCallback}
      />
    </div>
  );
}

