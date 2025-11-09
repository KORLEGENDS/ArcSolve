'use client';

import { Button } from '@/client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Separator } from '@/client/components/ui/separator';
import { Loader2, Heart, Download, Settings } from 'lucide-react';
import { useState } from 'react';

export default function ButtonDemoPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <main className="min-h-screen w-full p-6 space-y-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Button 컴포넌트 데모</h1>
          <p className="text-muted-foreground">Button 컴포넌트의 다양한 변형을 확인할 수 있습니다.</p>
        </div>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle>Button 컴포넌트</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Variants */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Variants</h3>
                <div className="flex flex-wrap items-center gap-4 p-4 border rounded-lg">
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="point">Point</Button>
                  <Button variant="brand">Brand</Button>
                </div>
              </div>

              <Separator />

              {/* Sizes */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Sizes</h3>
                <div className="flex flex-wrap items-center gap-4 p-4 border rounded-lg">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon">
                    <Settings />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Variants + Sizes 조합 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Variants + Sizes 조합</h3>
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex flex-wrap items-center gap-4">
                    <Button variant="ghost" size="sm">Ghost Small</Button>
                    <Button variant="ghost" size="default">Ghost Default</Button>
                    <Button variant="ghost" size="lg">Ghost Large</Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Button variant="point" size="sm">Point Small</Button>
                    <Button variant="point" size="default">Point Default</Button>
                    <Button variant="point" size="lg">Point Large</Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Button variant="brand" size="sm">Brand Small</Button>
                    <Button variant="brand" size="default">Brand Default</Button>
                    <Button variant="brand" size="lg">Brand Large</Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Icons */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">아이콘 포함</h3>
                <div className="flex flex-wrap items-center gap-4 p-4 border rounded-lg">
                  <Button>
                    <Heart />
                    좋아요
                  </Button>
                  <Button>
                    다운로드
                    <Download />
                  </Button>
                  <Button>
                    <Settings />
                    설정
                    <Settings />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Layouts */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Layouts</h3>
                <div className="space-y-4 p-4 border rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Default Layout</p>
                    <Button layout="default">Default Layout</Button>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Icon Layout</p>
                    <Button layout="icon" size="icon">
                      <Settings />
                    </Button>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Item Layout</p>
                    <div className="max-w-md">
                      <Button layout="item">
                        <Settings />
                        <span>설정 메뉴</span>
                        <Heart />
                      </Button>
                      <Button layout="item">
                        <Download />
                        <span>다운로드 파일 목록</span>
                        <Loader2 />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* States */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">States</h3>
                <div className="flex flex-wrap items-center gap-4 p-4 border rounded-lg">
                  <Button>Normal</Button>
                  <Button disabled>Disabled</Button>
                  <Button onClick={handleClick} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin" />
                        로딩 중...
                      </>
                    ) : (
                      '클릭하여 로딩'
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* 복합 예시 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">복합 예시</h3>
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex flex-wrap items-center gap-4">
                    <Button variant="point" size="lg">
                      <Heart />
                      주요 액션
                    </Button>
                    <Button variant="brand" size="lg">
                      <Download />
                      다운로드
                    </Button>
                    <Button variant="ghost" size="lg">
                      취소
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Button variant="point" size="sm">
                      <Settings />
                      작은 버튼
                    </Button>
                    <Button variant="brand" size="sm" disabled>
                      비활성화
                    </Button>
                    <Button variant="ghost" size="sm">
                      보조 액션
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

