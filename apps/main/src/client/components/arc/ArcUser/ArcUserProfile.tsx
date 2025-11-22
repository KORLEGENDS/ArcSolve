'use client';

import { ChevronDown, HelpCircle, LogOut, Settings } from 'lucide-react';
import * as React from 'react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';
import { cn } from '@/client/components/ui/utils';
import { useLogoutWithCacheClear } from '@/client/states/queries/useAuth';
import { authClient } from '@/share/libs/auth/auth-client';

import { ArcUserItem } from './components/ArcUserItem';

export interface ArcUserProfileMenuItem {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface ArcUserProfileProps {
  /**
   * 추가 클래스명
   */
  className?: string;
  /**
   * 메뉴 항목 목록
   */
  menuItems?: ArcUserProfileMenuItem[];
  /**
   * 메뉴 항목 선택 시 호출되는 콜백
   */
  onMenuItemSelect?: (value: string) => void;
}

const DEFAULT_MENU_ITEMS: ArcUserProfileMenuItem[] = [
  {
    label: '환경설정',
    value: 'settings',
    description: '앱 설정을 변경합니다',
  },
  {
    label: '도움말',
    value: 'help',
    description: '도움말을 확인합니다',
  },
  {
    label: '로그아웃',
    value: 'logout',
    description: '계정에서 로그아웃합니다',
  },
];

export function ArcUserProfile({
  className,
  menuItems = DEFAULT_MENU_ITEMS,
  onMenuItemSelect,
}: ArcUserProfileProps) {
  const {
    data: session,
  } = authClient.useSession();
  const logout = useLogoutWithCacheClear();

  const handleMenuItemClick = React.useCallback(
    (value: string) => {
      onMenuItemSelect?.(value);
      // 기본 동작 (필요시 수정)
      switch (value) {
        case 'settings':
          // TODO: 환경설정 페이지로 이동
          break;
        case 'help':
          // TODO: 도움말 페이지로 이동
          break;
        case 'logout':
          void logout();
          break;
        default:
          break;
      }
    },
    [onMenuItemSelect, logout]
  );

  const getMenuItemIcon = React.useCallback((value: string) => {
    switch (value) {
      case 'settings':
        return <Settings className="size-4 text-muted-foreground" />;
      case 'help':
        return <HelpCircle className="size-4 text-muted-foreground" />;
      case 'logout':
        return <LogOut className="size-4 text-muted-foreground" />;
      default:
        return null;
    }
  }, []);

  // 사용자 정보 표시
  const userName = session?.user?.name || '이름 없음';
  const userEmail = session?.user?.email || undefined;
  const userImage = session?.user?.image || undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className={cn('w-full p-1', className)}>
          <ArcUserItem
            title={userName}
            description={userEmail}
            profile={{
              imageUrl: userImage,
              name: userName,
            }}
            icon={<ChevronDown className="size-4 text-muted-foreground" />}
            onClick={() => {}}
          />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-(--radix-dropdown-menu-trigger-width) p-1">
        {menuItems.length === 0 ? (
          <div className="px-1 py-1.5 text-sm text-muted-foreground">
            메뉴 항목이 없습니다
          </div>
        ) : (
          menuItems.map((item) => (
            <DropdownMenuItem
              key={item.value}
              onClick={() => !item.disabled && handleMenuItemClick(item.value)}
              disabled={item.disabled}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2 w-full">
                {getMenuItemIcon(item.value)}
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="text-sm font-medium">{item.label}</div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground">
                      {item.description}
                    </div>
                  )}
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

