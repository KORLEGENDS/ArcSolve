'use client';

import { ArcLogo, ArcLogoImage, ArcLogoTagline, ArcBusinessInfo, ArcButton, ArcCopyright } from '@/client/components/arc/ArcLogo';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Separator } from '@/client/components/ui/separator';

export default function ArcLogoDemoPage() {
  return (
    <main className="min-h-screen w-full p-6 space-y-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">ArcLogo 컴포넌트 데모</h1>
          <p className="text-muted-foreground">ArcLogo 컴포넌트의 다양한 변형을 확인할 수 있습니다.</p>
        </div>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle>ArcLogo 컴포넌트</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">기본 로고</h3>
                <div className="flex flex-wrap items-center gap-6 p-4 border rounded-lg">
                  <ArcLogo />
                  <ArcLogo label="Custom Label" />
                  <ArcLogo size="2rem" />
                  <ArcLogo disableLink />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">이미지 로고</h3>
                <div className="flex flex-wrap items-center gap-6 p-4 border rounded-lg">
                  <ArcLogoImage />
                  <ArcLogoImage imageWidth={48} imageHeight={48} />
                  <ArcLogoImage disableLink />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">태그라인</h3>
                <div className="flex flex-col items-center gap-4 p-4 border rounded-lg">
                  <ArcLogoTagline />
                  <ArcLogoTagline>Custom Tagline Text</ArcLogoTagline>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">로고 + 태그라인 조합</h3>
                <div className="flex flex-col items-center gap-2 p-4 border rounded-lg">
                  <ArcLogo disableLink />
                  <ArcLogoTagline />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">ArcButton</h3>
                <div className="flex flex-wrap items-center gap-4 p-4 border rounded-lg">
                  <ArcButton />
                  <ArcButton label="AI" />
                  <ArcButton label="Custom" />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">사업자 정보</h3>
                <div className="p-4 border rounded-lg">
                  <ArcBusinessInfo />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">저작권 정보</h3>
                <div className="p-4 border rounded-lg">
                  <ArcCopyright />
                  <ArcCopyright text="©2025 Custom Copyright Text" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

