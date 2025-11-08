import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // 🔧 React StrictMode 비활성화 (로깅 중복 방지)
    reactStrictMode: false,
    devIndicators: false,
    
    // standalone 모드 활성화: Docker 러너 경량화
    // output: 'standalone',
  
    // 정적 청크는 항상 CDN에서 서빙
  
    // 프로덕션 최적화
    poweredByHeader: false, // 보안상 X-Powered-By 헤더 제거
};

export default nextConfig;
