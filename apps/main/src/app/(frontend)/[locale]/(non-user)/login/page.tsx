'use client';

import { ArcLogo, ArcLogoTagline } from '@/client/components/arc/ArcLogo';
import { ArcState } from '@/client/components/arc/ArcState';
import { Badge } from '@/client/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader
} from '@/client/components/ui/card';
import { Link } from '@/share/libs/i18n/routing';
import { assetUrl } from '@/share/share-utils/asset-url';
import { AlertCircle } from 'lucide-react';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { type JSX, useCallback, useState } from 'react';

export default function LoginPage(): JSX.Element {
  const searchParams = useSearchParams();
  // open redirect 방지: 내부 상대 경로만 허용
  const requested = searchParams.get('next') ?? '/';
  const callbackUrl = (() => {
    try {
      // 절대 URL(스킴 포함) 또는 프로토콜 상대(//)는 차단
      if (/^([a-z]+:)?\/\//i.test(requested)) return '/';
      // 내부 경로만 허용
      if (!requested.startsWith('/')) return '/';
      // 경로 정규화: .. 제거 (단순 차단)
      if (requested.includes('..')) return '/';
      return requested;
    } catch {
      return '/';
    }
  })();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSocialLogin = useCallback(async (provider: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      await signIn(provider, { callbackUrl, redirect: true });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Login error:', error);
      }
      setError('로그인 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  }, [callbackUrl]);

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-6">
      <Card className='max-w-[420px] login-card bg-background/95 w-full backdrop-blur border-[--color-brand]/20 shadow-2xl' style={{ containerType: 'inline-size' }}>
        <CardHeader className='text-center space-y-4'>
          <div className="flex flex-col items-center">
            <div className="flex flex-col items-center space-y-1">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-muted-foreground/30 text-muted-foreground font-normal mb-1">
                Beta
              </Badge>
              <ArcLogo className='text-2xl font-bold justify-center' disableLink />
              <ArcLogoTagline />
            </div>
          </div>
        </CardHeader>

        <CardContent className='space-y-6'>
          {/* 에러 표시 */}
          {error && (
            <ArcState
              state="error"
              variant="inline"
              title="로그인 오류"
              description={error}
              severity="critical"
              icon={<AlertCircle />}
            />
          )}

          {/* 소셜 로그인 버튼들: 네이버, 카카오만 노출 */}
          <div className='grid gap-3'>
            <button
              type='button'
              onClick={() => handleSocialLogin('kakao')}
              disabled={isLoading}
              aria-busy={isLoading}
              aria-label='카카오 로그인'
              className='relative inline-flex w-full h-12 items-center justify-center rounded-[12px] focus:outline-none focus-visible:ring overflow-hidden'
              style={{ backgroundColor: '#FEE500' }}
            >
              <Image
                src={assetUrl('/providers/kakao/logo.png')}
                alt=''
                width={20}
                height={20}
                aria-hidden
                className='absolute left-3 top-1/2 -translate-y-1/2'
                style={{ width: 'auto', height: 'auto' }}
              />
              <span className='text-base leading-none' style={{ color: 'rgba(0,0,0,0.85)' }}>
                {isLoading ? '연결 중...' : '카카오 로그인'}
              </span>
            </button>

            <button
              type='button'
              onClick={() => handleSocialLogin('naver')}
              disabled={isLoading}
              aria-busy={isLoading}
              aria-label='네이버 아이디로 로그인'
              className='relative inline-flex w-full h-12 items-center justify-center rounded focus:outline-none focus-visible:ring overflow-hidden'
              style={{ backgroundColor: '#03C75A', color: '#FFFFFF' }}
            >
              <Image
                src={assetUrl('/providers/naver/logo.png')}
                alt=''
                width={20}
                height={20}
                aria-hidden
                className='absolute left-3 top-1/2 -translate-y-1/2'
                style={{ width: 'auto', height: 'auto' }}
              />
              <span className='text-base leading-none'>
                {isLoading ? '연결 중...' : '네이버 로그인'}
              </span>
            </button>
          </div>

          <p
            className='text-muted-foreground text-center whitespace-nowrap overflow-hidden'
            style={{
              fontSize: 'clamp(0.65rem, 2.5cqw, 0.75rem)',
              lineHeight: '1.2',
              marginBottom: '0.3rem'
            }}
          >
            계속 진행하면{' '}
            <Link href="/docs/terms" className='text-[--color-brand] hover:underline font-bold'>서비스 약관</Link> 및{' '}
            <Link href="/docs/privacy" className='text-[--color-brand] hover:underline font-bold'>개인정보 처리방침</Link>에
            동의하게 됩니다.
          </p>

          <p
            className='text-muted-foreground text-center whitespace-nowrap overflow-hidden'
            style={{
              fontSize: 'clamp(0.65rem, 2.5cqw, 0.75rem)',
              lineHeight: '1.2'
            }}
          >
            크롬 환경에서 베타서비스 중이며, 기능이 안정적이지 않을 수 있습니다.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}