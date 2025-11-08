/**
 * 🔐 NextAuth.js v5 인증 설정 - Auth.js v5 표준 패턴
 */

import { authConfig } from '@/server/auth/auth-config';
import NextAuth from 'next-auth';

/**
 * 🎯 NextAuth.js v5 인스턴스 생성
 * Auth.js v5 표준 패턴을 따른 간소화된 설정 사용
 */
export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);

// ==================== 사용 가이드 ====================

/*
# 🎯 올바른 사용법:

## 서버에서 (middleware.ts, API routes)
```typescript
import { auth } from "./auth"
import { handlers } from "./auth"

// 세션 확인
const session = await auth()

// API 라우트 핸들러
export { handlers as GET, handlers as POST }
```

## 클라이언트에서 (React 컴포넌트)
```typescript
import { signIn, signOut } from "next-auth/react"

// ❌ 잘못된 사용 (더 이상 export되지 않음)
// import { signIn, signOut } from "./auth"

// ✅ 올바른 사용
await signIn("kakao")
await signOut()
```

# 🔧 설정 변경이 필요한 경우:
src/server/authentication/config/ 디렉터리의 해당 파일 수정:
- OAuth: oauth-providers.config.ts  
- 보안: security.config.ts
- 콜백: callbacks.config.ts
*/
