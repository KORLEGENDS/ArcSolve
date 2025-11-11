'use client';

import { ArcUserMenu } from '@/client/components/arc/ArcUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Separator } from '@/client/components/ui/separator';
import { useState } from 'react';

export default function ArcUserDemoPage() {
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  const handleMenuItemSelect = (value: string) => {
    setSelectedValue(value);
    console.log('선택된 메뉴:', value);
  };

  return (
    <main className="min-h-screen w-full p-6 space-y-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">ArcUserMenu 컴포넌트 데모</h1>
          <p className="text-muted-foreground">
            프로젝트 목록을 표시하고 드롭다운 메뉴로 작업을 수행할 수 있는 컴포넌트입니다.
          </p>
        </div>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle>ArcUserMenu 컴포넌트</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* 기본 예시 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">기본 사용</h3>
                <div className="space-y-2 p-4 border rounded-lg max-w-md">
                  <ArcUserMenu
                    title="프로젝트 이름"
                    description="프로젝트에 대한 간략한 설명입니다"
                    menuItems={[
                      { label: '열기', value: 'open' },
                      { label: '설정', value: 'settings' },
                      { label: '삭제', value: 'delete' },
                    ]}
                    onMenuItemSelect={handleMenuItemSelect}
                  />
                </div>
              </div>

              <Separator />

              {/* 설명 없는 경우 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">설명 없는 경우</h3>
                <div className="space-y-2 p-4 border rounded-lg max-w-md">
                  <ArcUserMenu
                    title="간단한 프로젝트"
                    menuItems={[
                      { label: '열기', value: 'open' },
                      { label: '편집', value: 'edit' },
                    ]}
                    onMenuItemSelect={handleMenuItemSelect}
                  />
                </div>
              </div>

              <Separator />

              {/* 여러 프로젝트 목록 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">프로젝트 목록</h3>
                <div className="space-y-2 p-4 border rounded-lg max-w-md">
                  <ArcUserMenu
                    title="웹 애플리케이션 프로젝트"
                    description="React와 Next.js를 사용한 모던 웹 애플리케이션"
                    menuItems={[
                      { label: '열기', value: 'open-1' },
                      { label: '설정', value: 'settings-1' },
                      { label: '공유', value: 'share-1' },
                      { label: '삭제', value: 'delete-1' },
                    ]}
                    onMenuItemSelect={handleMenuItemSelect}
                  />
                  <ArcUserMenu
                    title="모바일 앱 프로젝트"
                    description="React Native로 개발 중인 크로스 플랫폼 앱"
                    menuItems={[
                      { label: '열기', value: 'open-2' },
                      { label: '빌드', value: 'build-2' },
                      { label: '배포', value: 'deploy-2' },
                    ]}
                    onMenuItemSelect={handleMenuItemSelect}
                  />
                  <ArcUserMenu
                    title="데이터 분석 프로젝트"
                    description="Python과 Jupyter Notebook을 활용한 데이터 분석"
                    menuItems={[
                      { label: '열기', value: 'open-3' },
                      { label: '실행', value: 'run-3' },
                      { label: '내보내기', value: 'export-3' },
                    ]}
                    onMenuItemSelect={handleMenuItemSelect}
                  />
                </div>
              </div>

              <Separator />

              {/* 비활성화된 메뉴 항목 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">비활성화된 메뉴 항목</h3>
                <div className="space-y-2 p-4 border rounded-lg max-w-md">
                  <ArcUserMenu
                    title="보호된 프로젝트"
                    description="삭제가 비활성화된 프로젝트입니다"
                    menuItems={[
                      { label: '열기', value: 'open-4' },
                      { label: '설정', value: 'settings-4' },
                      { label: '삭제', value: 'delete-4', disabled: true },
                    ]}
                    onMenuItemSelect={handleMenuItemSelect}
                  />
                </div>
              </div>

              <Separator />

              {/* 빈 메뉴 항목 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">빈 메뉴 항목</h3>
                <div className="space-y-2 p-4 border rounded-lg max-w-md">
                  <ArcUserMenu
                    title="메뉴가 없는 프로젝트"
                    description="아직 사용 가능한 작업이 없습니다"
                    menuItems={[]}
                    onMenuItemSelect={handleMenuItemSelect}
                  />
                </div>
              </div>

              <Separator />

              {/* 긴 텍스트 처리 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">긴 텍스트 처리</h3>
                <div className="space-y-2 p-4 border rounded-lg max-w-md">
                  <ArcUserMenu
                    title="매우 긴 프로젝트 이름이 들어가는 경우 어떻게 표시되는지 확인하기 위한 예시입니다"
                    description="이것은 매우 긴 설명 텍스트입니다. 프로젝트에 대한 자세한 설명이 들어갈 수 있으며, 텍스트가 길어질 경우 자동으로 잘려서 표시됩니다."
                    menuItems={[
                      { label: '열기', value: 'open-5' },
                      { label: '설정', value: 'settings-5' },
                      { label: '삭제', value: 'delete-5' },
                    ]}
                    onMenuItemSelect={handleMenuItemSelect}
                  />
                </div>
              </div>

              <Separator />

              {/* 선택된 값 표시 */}
              {selectedValue && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">선택된 메뉴</h3>
                  <div className="p-4 border rounded-lg bg-muted">
                    <p className="text-sm">
                      마지막으로 선택된 메뉴: <span className="font-semibold">{selectedValue}</span>
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

