'use client';

import * as React from 'react';

import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { cn } from '@/client/components/ui/utils';

export interface ArcYouRelationAddProps {
  /**
   * 이메일 입력값
   */
  email: string;
  /**
   * 이메일 변경 핸들러
   */
  onEmailChange: (email: string) => void;
  /**
   * 보내기 핸들러
   */
  onSubmit: (email: string) => void;
  /**
   * 추가 클래스명
   */
  className?: string;
}

export function ArcYouRelationAdd({
  email,
  onEmailChange,
  onSubmit,
  className,
}: ArcYouRelationAddProps): React.ReactElement {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email);
  };

  return (
    <form onSubmit={handleSubmit} className={cn('w-full flex gap-2', className)}>
      <Input
        type="email"
        placeholder="이메일 입력"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        className="flex-1"
      />
      <Button type="submit">보내기</Button>
    </form>
  );
}

