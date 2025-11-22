/**
 * 모바일 앱 디자인 토큰
 *
 * - 웹(Next) `tokens.css`와 개념적으로 대응되는 층
 * - React Native 스타일에서 직접 사용할 수 있도록 숫자/hex 중심으로 정의
 * - 필요 시 점진적으로 확장
 */

export const colorTokens = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#666666',

  // 브랜드 / 액션
  brand: '#000000',
  kakao: '#FEE500',
  kakaoText: 'rgba(0,0,0,0.85)',
  naver: '#03C75A',

  danger: '#EF4444',
} as const;

export const spacingTokens = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radiusTokens = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typographyTokens = {
  title: {
    fontSize: 32,
    fontWeight: 'bold' as const,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
} as const;


