'use client';

import { Button } from '@/client/components/ui/button';
import { cn } from '@/client/components/ui/utils';
import {
  Children,
  useCallback,
  useEffect,
  useRef,
  type ComponentProps,
  type HTMLAttributes,
  type KeyboardEventHandler,
  type ReactNode
} from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import styles from './ArcAIInput.module.css';

export type ArcAIInputProps = Omit<HTMLAttributes<HTMLFormElement>, 'onChange'> & {
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  // 텍스트 입력 관련
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  maxLength?: number;
  // 옵션 버튼들
  tools?: Array<{
    children: ReactNode;
    'aria-label'?: string;
    onClick?: () => void;
    disabled?: boolean;
    variant?: ComponentProps<typeof Button>['variant'];
    size?: ComponentProps<typeof Button>['size'];
  }>;
  // 전송 버튼 관련
  submitDisabled?: boolean;
  submitIcon?: ReactNode;
  submitVariant?: ComponentProps<typeof Button>['variant'];
  submitSize?: ComponentProps<typeof Button>['size'];
};

export const ArcAIInput = ({
  className,
  onSubmit,
  value,
  onChange,
  placeholder = '무엇에 대해 이야기를 나눠볼까요?',
  minRows = 1,
  maxRows = 18,
  maxLength,
  tools = [],
  submitDisabled,
  submitIcon,
  submitVariant = 'ghost',
  submitSize = 'icon',
  ...props
}: ArcAIInputProps): React.ReactElement => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const setExpanded = useCallback((expanded: boolean) => {
    const el = textareaRef.current;
    const form = el?.form as HTMLFormElement | null;
    if (!el || !form) return;
    form.dataset.expanded = expanded ? 'true' : 'false';
    if (!expanded) {
      el.style.height = '';
    }
  }, []);

  const updateExpandedState = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const value = el.value;
    // 빈 상태 data 속성 업데이트 (네이티브 placeholder 미사용)
    const isEmpty = value.length === 0;
    el.dataset.empty = isEmpty ? 'true' : 'false';
    if (value.trim().length === 0 && !value.includes('\n')) {
      setExpanded(false);
      return;
    }
    setExpanded(value.includes('\n'));
  }, [setExpanded]);

  // 초기 1회 판정만 유지
  useEffect(() => {
    updateExpandedState();
    // 폼 reset 시에도 축소하도록 리스너 추가
    const el = textareaRef.current;
    const form = el?.form as HTMLFormElement | null;
    if (!form) return;
    const onReset = () => setExpanded(false);
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [updateExpandedState, setExpanded]);

  // 외부에서 value가 변경될 때(예: 전송 직후 상위 상태로 '' 초기화)에도
  // placeholder와 expanded 상태를 즉시 동기화
  useEffect(() => {
    updateExpandedState();
  }, [value, updateExpandedState]);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      // Enter 전송 (Shift 미사용, 한글 조합 입력 아님)
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e);
    updateExpandedState();
  };

  // 전송 아이콘 기본값
  const defaultSubmitIcon = (
    <svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className='size-5'>
      <path d='m22 2-7 20-4-9-9-4Z'/>
      <path d='M22 2 11 13'/>
    </svg>
  );

  return (
    <form
      className={cn(styles.form, 'point-glass', className)}
      onSubmit={onSubmit}
      {...props}
    >
      <div className={styles.toolbar}>
        {/* 옵션 버튼들 */}
        {tools.length > 0 && (
          <div className={styles.tools}>
            {tools.map((tool, index) => {
              const inferredSize = Children.count(tool.children) > 1 ? 'default' : 'icon';
              const size = tool.size ?? inferredSize;
              
              return (
                <Button
                  key={index}
                  className={cn(styles.button)}
                  size={size}
                  type='button'
                  variant={tool.variant}
                  aria-label={tool['aria-label']}
                  disabled={tool.disabled}
                  onClick={tool.onClick}
                >
                  {tool.children}
                </Button>
              );
            })}
          </div>
        )}

        {/* 텍스트 입력 영역 */}
        <div className={styles.primary}>
          <TextareaAutosize
            ref={textareaRef}
            className={styles.textarea}
            name='message'
            value={value}
            minRows={minRows}
            maxRows={maxRows}
            maxLength={maxLength}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            // 네이티브 placeholder 제거: 시각적 오버레이만 사용
            placeholder={undefined}
          />
          <span
            className={styles.placeholderOverlay}
            aria-hidden='true'
          >
            {placeholder}
          </span>
        </div>

        {/* 전송 버튼 */}
        <div className={cn(styles.trailing)}>
          <Button
            className={cn(styles.button, styles.trailing)}
            size={submitSize}
            type='submit'
            variant={submitVariant}
            disabled={submitDisabled}
          >
            {submitIcon || defaultSubmitIcon}
          </Button>
        </div>
      </div>
    </form>
  );
};

