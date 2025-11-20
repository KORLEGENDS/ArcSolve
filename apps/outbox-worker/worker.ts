// 기존 엔트리포인트(도커/스크립트)는 worker.ts 를 가리키므로,
// 여기서는 ArcYou 채팅 전용 워커 구현으로 위임합니다.
// 실제 로직은 `worker-arcyou-chat.ts` 에 정의되어 있으며,
// 이 파일은 단순히 그 모듈을 import 하여 사이드 이펙트로 실행합니다.

import './worker-arcyou-chat';

