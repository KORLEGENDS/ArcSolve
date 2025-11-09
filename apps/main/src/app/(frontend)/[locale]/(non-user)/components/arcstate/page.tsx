'use client';

import { ArcState, type ArcStateKind, type ArcStateVariant } from '@/client/components/arc/ArcState';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Separator } from '@/client/components/ui/separator';
import { AlertCircle, CheckCircle2, Loader2, WifiOff, Wrench, Inbox } from 'lucide-react';
import { useState } from 'react';

export default function ArcStateDemoPage() {
  const [selectedState, setSelectedState] = useState<ArcStateKind>('success');
  const [selectedVariant, setSelectedVariant] = useState<ArcStateVariant>('card');

  const states: ArcStateKind[] = ['loading', 'error', 'empty', 'success', 'offline', 'maintenance'];
  const variants: ArcStateVariant[] = ['inline', 'card'];

  const stateIcons = {
    loading: <Loader2 className="animate-spin" />,
    error: <AlertCircle />,
    empty: <Inbox />,
    success: <CheckCircle2 />,
    offline: <WifiOff />,
    maintenance: <Wrench />,
  };

  const stateTitles = {
    loading: '처리 중입니다',
    error: '오류가 발생했습니다',
    empty: '데이터가 없습니다',
    success: '성공적으로 완료되었습니다',
    offline: '오프라인 상태입니다',
    maintenance: '점검 중입니다',
  };

  const stateDescriptions = {
    loading: '요청하신 작업을 처리하고 있습니다. 잠시만 기다려 주세요.',
    error: '요청을 처리하는 중 문제가 발생했습니다. 다시 시도해 주세요.',
    empty: '표시할 내용이 없습니다. 새로운 데이터를 추가해 보세요.',
    success: '모든 작업이 정상적으로 완료되었습니다.',
    offline: '인터넷 연결을 확인해 주세요.',
    maintenance: '서비스 점검 중입니다. 잠시 후 다시 시도해 주세요.',
  };

  return (
    <main className="min-h-screen w-full p-6 space-y-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">ArcState 컴포넌트 데모</h1>
          <p className="text-muted-foreground">ArcState 컴포넌트의 다양한 변형을 확인할 수 있습니다.</p>
        </div>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle>ArcState 컴포넌트</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* 컨트롤 */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h3 className="text-lg font-semibold">컨트롤</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">상태 (State)</label>
                    <div className="flex flex-wrap gap-2">
                      {states.map((state) => (
                        <button
                          key={state}
                          onClick={() => setSelectedState(state)}
                          className={`px-3 py-1 rounded-md text-sm transition-colors ${
                            selectedState === state
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background border hover:bg-muted'
                          }`}
                        >
                          {state}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">변형 (Variant)</label>
                    <div className="flex flex-wrap gap-2">
                      {variants.map((variant) => (
                        <button
                          key={variant}
                          onClick={() => setSelectedVariant(variant)}
                          className={`px-3 py-1 rounded-md text-sm transition-colors ${
                            selectedVariant === variant
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background border hover:bg-muted'
                          }`}
                        >
                          {variant}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 선택된 상태 미리보기 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">미리보기</h3>
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className={selectedVariant === 'card' ? 'max-w-md mx-auto' : 'w-full'}>
                    <ArcState
                      state={selectedState}
                      variant={selectedVariant}
                      title={stateTitles[selectedState]}
                      description={stateDescriptions[selectedState]}
                      icon={stateIcons[selectedState]}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* 모든 상태 표시 */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">모든 상태 (Card Variant)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {states.map((state) => (
                    <div key={state} className="h-64">
                      <ArcState
                        state={state}
                        variant="card"
                        title={stateTitles[state]}
                        description={stateDescriptions[state]}
                        icon={stateIcons[state]}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* 모든 상태 표시 (Inline Variant) */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">모든 상태 (Inline Variant)</h3>
                <div className="space-y-4">
                  {states.map((state) => (
                    <div key={state} className="h-48 border rounded-lg p-4">
                      <ArcState
                        state={state}
                        variant="inline"
                        title={stateTitles[state]}
                        description={stateDescriptions[state]}
                        icon={stateIcons[state]}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Severity 예시 */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Severity 레벨</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="h-64">
                    <ArcState
                      state="error"
                      variant="card"
                      title="Critical 오류"
                      description="심각한 오류가 발생했습니다."
                      severity="critical"
                      icon={<AlertCircle />}
                    />
                  </div>
                  <div className="h-64">
                    <ArcState
                      state="error"
                      variant="card"
                      title="Warning 경고"
                      description="주의가 필요한 상황입니다."
                      severity="warning"
                      icon={<AlertCircle />}
                    />
                  </div>
                  <div className="h-64">
                    <ArcState
                      state="success"
                      variant="card"
                      title="Info 정보"
                      description="참고할 정보입니다."
                      severity="info"
                      icon={<CheckCircle2 />}
                    />
                  </div>
                  <div className="h-64">
                    <ArcState
                      state="success"
                      variant="card"
                      title="Success 성공"
                      description="작업이 성공적으로 완료되었습니다."
                      severity="success"
                      icon={<CheckCircle2 />}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Meta 정보 예시 */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Meta 정보 포함</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="h-80">
                    <ArcState
                      state="success"
                      variant="card"
                      title="작업 완료"
                      description="파일 업로드가 완료되었습니다."
                      icon={<CheckCircle2 />}
                      meta={[
                        { label: '파일명', value: 'document.pdf' },
                        { label: '크기', value: '2.5 MB' },
                        { label: '업로드 시간', value: '2025-01-15 14:30' },
                      ]}
                    />
                  </div>
                  <div className="h-80">
                    <ArcState
                      state="error"
                      variant="card"
                      title="오류 발생"
                      description="요청 처리 중 오류가 발생했습니다."
                      severity="critical"
                      icon={<AlertCircle />}
                      meta={[
                        { label: '오류 코드', value: 'ERR_500' },
                        { label: '요청 ID', value: 'req_abc123' },
                        { label: '발생 시간', value: '2025-01-15 14:30' },
                      ]}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Details 예시 */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Details 포함</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="h-96">
                    <ArcState
                      state="error"
                      variant="card"
                      title="상세 오류 정보"
                      description="오류 상세 내용을 확인하세요."
                      severity="critical"
                      icon={<AlertCircle />}
                      details={`Error: Failed to fetch data
Stack trace:
  at fetchData (api.ts:45)
  at handleRequest (handler.ts:23)
  at processRequest (main.ts:12)
  
Request details:
  URL: /api/users
  Method: GET
  Headers: { "Authorization": "Bearer ..." }
  Timestamp: 2025-01-15T14:30:00Z`}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Actions 예시 */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Actions 포함</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="h-80">
                    <ArcState
                      state="success"
                      variant="card"
                      title="작업 완료"
                      description="파일이 성공적으로 업로드되었습니다."
                      icon={<CheckCircle2 />}
                      primaryAction={{
                        label: '확인',
                        onClick: () => alert('확인 버튼 클릭'),
                      }}
                      secondaryActions={[
                        {
                          label: '다시 업로드',
                          onClick: () => alert('다시 업로드 클릭'),
                        },
                      ]}
                    />
                  </div>
                  <div className="h-80">
                    <ArcState
                      state="error"
                      variant="card"
                      title="오류 발생"
                      description="요청 처리 중 오류가 발생했습니다."
                      severity="critical"
                      icon={<AlertCircle />}
                      primaryAction={{
                        label: '다시 시도',
                        onClick: () => alert('다시 시도 클릭'),
                      }}
                      secondaryActions={[
                        {
                          label: '오류 복사',
                          copyText: 'Error: Failed to fetch data\nRequest ID: req_abc123',
                          onClick: () => {},
                          onCopyComplete: (success) => {
                            if (success) alert('오류 정보가 복사되었습니다.');
                          },
                        },
                        {
                          label: '고객센터',
                          onClick: () => alert('고객센터 클릭'),
                        },
                      ]}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* 복합 예시 */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">복합 예시 (모든 기능 포함)</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="h-[500px]">
                    <ArcState
                      state="error"
                      variant="card"
                      title="복합 오류 정보"
                      description="다양한 정보와 액션이 포함된 오류 상태입니다."
                      severity="critical"
                      icon={<AlertCircle />}
                      meta={[
                        { label: '오류 코드', value: 'ERR_500' },
                        { label: '요청 ID', value: 'req_abc123' },
                        { label: '발생 시간', value: '2025-01-15 14:30:00' },
                        { label: '서버', value: 'api-server-01' },
                      ]}
                      details={`Error: Failed to fetch user data
Stack trace:
  at fetchUserData (api.ts:45)
  at handleRequest (handler.ts:23)
  at processRequest (main.ts:12)

Request details:
  URL: /api/users/123
  Method: GET
  Headers: { "Authorization": "Bearer token..." }
  Timestamp: 2025-01-15T14:30:00Z
  User-Agent: Mozilla/5.0...`}
                      primaryAction={{
                        label: '다시 시도',
                        onClick: () => alert('다시 시도 클릭'),
                      }}
                      secondaryActions={[
                        {
                          label: '오류 복사',
                          copyText: 'Error: Failed to fetch user data\nRequest ID: req_abc123',
                          onClick: () => {},
                          onCopyComplete: (success) => {
                            if (success) alert('오류 정보가 복사되었습니다.');
                          },
                        },
                        {
                          label: '고객센터',
                          onClick: () => alert('고객센터 클릭'),
                        },
                        {
                          label: '로그 보기',
                          onClick: () => alert('로그 보기 클릭'),
                        },
                      ]}
                    />
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

