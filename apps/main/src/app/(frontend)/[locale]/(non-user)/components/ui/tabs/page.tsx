'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/custom/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Separator } from '@/client/components/ui/separator';

export default function TabsDemoPage() {
  return (
    <main className="min-h-screen w-full p-6 space-y-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Tabs 컴포넌트 데모</h1>
          <p className="text-muted-foreground">Tabs 컴포넌트의 다양한 변형을 확인할 수 있습니다.</p>
        </div>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle>Tabs 컴포넌트</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* 기본 탭 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">기본 탭</h3>
                <Tabs defaultValue="tab1" className="w-full">
                  <TabsList>
                    <TabsTrigger value="tab1">탭 1</TabsTrigger>
                    <TabsTrigger value="tab2">탭 2</TabsTrigger>
                    <TabsTrigger value="tab3">탭 3</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tab1">
                    <div className="mt-4 p-4 border rounded-lg">
                      <p>탭 1의 내용입니다.</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="tab2">
                    <div className="mt-4 p-4 border rounded-lg">
                      <p>탭 2의 내용입니다.</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="tab3">
                    <div className="mt-4 p-4 border rounded-lg">
                      <p>탭 3의 내용입니다.</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <Separator />

              {/* 많은 탭 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">많은 탭</h3>
                <Tabs defaultValue="tab-a" className="w-full">
                  <TabsList>
                    <TabsTrigger value="tab-a">홈</TabsTrigger>
                    <TabsTrigger value="tab-b">프로필</TabsTrigger>
                    <TabsTrigger value="tab-c">설정</TabsTrigger>
                    <TabsTrigger value="tab-d">알림</TabsTrigger>
                    <TabsTrigger value="tab-e">메시지</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tab-a">
                    <div className="mt-4 p-4 border rounded-lg">
                      <p>홈 탭의 내용입니다.</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="tab-b">
                    <div className="mt-4 p-4 border rounded-lg">
                      <p>프로필 탭의 내용입니다.</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="tab-c">
                    <div className="mt-4 p-4 border rounded-lg">
                      <p>설정 탭의 내용입니다.</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="tab-d">
                    <div className="mt-4 p-4 border rounded-lg">
                      <p>알림 탭의 내용입니다.</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="tab-e">
                    <div className="mt-4 p-4 border rounded-lg">
                      <p>메시지 탭의 내용입니다.</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <Separator />

              {/* 긴 텍스트 탭 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">긴 텍스트 탭</h3>
                <Tabs defaultValue="long-1" className="w-full">
                  <TabsList>
                    <TabsTrigger value="long-1">매우 긴 탭 이름입니다</TabsTrigger>
                    <TabsTrigger value="long-2">또 다른 긴 탭 이름</TabsTrigger>
                    <TabsTrigger value="long-3">짧은 탭</TabsTrigger>
                  </TabsList>
                  <TabsContent value="long-1">
                    <div className="mt-4 p-4 border rounded-lg">
                      <p>매우 긴 탭 이름의 내용입니다.</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="long-2">
                    <div className="mt-4 p-4 border rounded-lg">
                      <p>또 다른 긴 탭 이름의 내용입니다.</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="long-3">
                    <div className="mt-4 p-4 border rounded-lg">
                      <p>짧은 탭의 내용입니다.</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <Separator />

              {/* 비활성화된 탭 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">비활성화된 탭</h3>
                <Tabs defaultValue="enabled-1" className="w-full">
                  <TabsList>
                    <TabsTrigger value="enabled-1">활성화됨</TabsTrigger>
                    <TabsTrigger value="disabled-1" disabled>
                      비활성화됨
                    </TabsTrigger>
                    <TabsTrigger value="enabled-2">활성화됨 2</TabsTrigger>
                  </TabsList>
                  <TabsContent value="enabled-1">
                    <div className="mt-4 p-4 border rounded-lg">
                      <p>활성화된 탭의 내용입니다.</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="disabled-1">
                    <div className="mt-4 p-4 border rounded-lg">
                      <p>비활성화된 탭의 내용입니다 (접근 불가).</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="enabled-2">
                    <div className="mt-4 p-4 border rounded-lg">
                      <p>활성화된 탭 2의 내용입니다.</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <Separator />

              {/* 복합 콘텐츠 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">복합 콘텐츠</h3>
                <Tabs defaultValue="content-1" className="w-full">
                  <TabsList>
                    <TabsTrigger value="content-1">문서</TabsTrigger>
                    <TabsTrigger value="content-2">이미지</TabsTrigger>
                    <TabsTrigger value="content-3">설정</TabsTrigger>
                  </TabsList>
                  <TabsContent value="content-1">
                    <div className="mt-4 p-6 border rounded-lg space-y-4">
                      <h4 className="text-xl font-semibold">문서 탭</h4>
                      <p className="text-muted-foreground">
                        이 탭에는 문서 관련 내용이 표시됩니다. 여러 줄의 텍스트와 다양한 콘텐츠를 포함할 수 있습니다.
                      </p>
                      <ul className="list-disc list-inside space-y-2">
                        <li>문서 항목 1</li>
                        <li>문서 항목 2</li>
                        <li>문서 항목 3</li>
                      </ul>
                    </div>
                  </TabsContent>
                  <TabsContent value="content-2">
                    <div className="mt-4 p-6 border rounded-lg space-y-4">
                      <h4 className="text-xl font-semibold">이미지 탭</h4>
                      <p className="text-muted-foreground">
                        이미지 관련 콘텐츠가 여기에 표시됩니다.
                      </p>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                          이미지 1
                        </div>
                        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                          이미지 2
                        </div>
                        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                          이미지 3
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="content-3">
                    <div className="mt-4 p-6 border rounded-lg space-y-4">
                      <h4 className="text-xl font-semibold">설정 탭</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span>알림 설정</span>
                          <input type="checkbox" className="rounded" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>다크 모드</span>
                          <input type="checkbox" className="rounded" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>자동 저장</span>
                          <input type="checkbox" className="rounded" />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

