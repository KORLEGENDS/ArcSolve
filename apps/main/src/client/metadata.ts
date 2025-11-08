import type { Metadata } from 'next';

// 기본 메타데이터 옵션 인터페이스
interface PageMetadataOptions {
  title: string;
  description: string;
  noIndex?: boolean;
  keywords?: string[];
}

export function createPageMetadata({
  title,
  description,
  noIndex = false,
  keywords = [],
}: PageMetadataOptions): Metadata {
  const fullTitle = title === 'ArcSolve' ? title : `${title} - ArcSolve`;

  const base: Metadata = {
    title: fullTitle,
    description,
    keywords: [
      'AI 지식관리',
      '잠재공간',
      ...keywords
    ],
    authors: [{ name: 'ArcSolve Team' }],
    creator: 'ArcSolve',
    publisher: 'ArcSolve',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL('https://arcsolve.ai'),
    alternates: {
      canonical: '/',
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      title: fullTitle,
      description,
      siteName: 'ArcSolve',
      images: [
        {
          url: '/Main-Logo.png',
          width: 1200,
          height: 630,
          alt: '지식의 잠재공간, 무한한 가능성',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: ['/Main-Logo.png'],
    },
    verification: {
      google: 'your-google-site-verification-code',
    },
  };

  return base;
}