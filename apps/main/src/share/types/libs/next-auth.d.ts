import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    role?: 'admin' | 'manager' | 'user';
  }

  interface Session {
    user: {
      id: string;
      role?: 'admin' | 'manager' | 'user';
    } & DefaultSession['user'];
  }
}

// v5 기준으로 JWT 모듈 보강은 @auth/core/jwt에서 처리합니다.


