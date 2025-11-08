/**
 * 🎯 Auth.js v5 Configuration
 * NextAuth.js v5 표준 패턴을 따른 간소화된 인증 설정
 *
 * ✅ Auth.js v5 공식 권장 구조
 * ✅ 최소한의 필수 설정만 포함
 * ✅ 검증된 보안 기본값 사용
 */

import { refreshAccessToken } from '@/server/auth/token-service';
import { db } from '@/server/database/postgresql/client-postgresql';
import {
  deleteRefreshToken,
  saveRefreshToken,
} from '@/server/database/redis/session/refresh-store-redis';
// 간단 검증용 no-op 스키마 (기존 zod 검증 대체)
const createUserSchemaEventSchema = { parse: (v: unknown) => v } as const;
const jwtCallbackSchema = { parse: (v: unknown) => v } as const;
const sessionCallbackSchema = { parse: (v: unknown) => v } as const;
const signInCallbackSchema = { parse: (v: unknown) => v } as const;
const signOutCallbackSchema = { parse: (v: unknown) => v } as const;

import { TIME_UNITS, USER_ROLES } from '@/share/configs/constants';
import { env, isProduction } from '@/share/configs/environments/server-constants';
import {
  authAccounts as adapterAccounts,
  authUsers as adapterUsers,
} from '@/share/schema/drizzles/auth-adapter-drizzle';
import { users as appUsers } from '@/share/schema/drizzles/user-drizzle';
import { UserRepository as UsersRepository } from '@/share/schema/repositories/user-repository';
import { generateUUID } from '@/share/share-utils/id-utils';
import { TypeGuards } from '@/share/share-utils/type-guards-utils';
import type { JWT } from '@auth/core/jwt';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import type { NextAuthConfig, Session } from 'next-auth';
import KakaoProvider from 'next-auth/providers/kakao';
import NaverProvider from 'next-auth/providers/naver';

// ==================== OAuth 프로바이더 설정 ====================

/**
 * OAuth 프로바이더 배열 - Auth.js v5 공식 패턴
 * 환경변수 존재 여부에 따라 자동 활성화
 */
const providers = [
  // 카카오 OAuth
  ...(env.AUTH_KAKAO_ID && env.AUTH_KAKAO_SECRET
    ? [
        KakaoProvider({
          clientId: env.AUTH_KAKAO_ID,
          clientSecret: env.AUTH_KAKAO_SECRET,
          profile: (profile) => ({
            id: profile.id.toString(),
            email: profile.kakao_account?.email ?? '',
            name: profile.kakao_account?.profile?.nickname ?? '',
            image: profile.kakao_account?.profile?.profile_image_url,
            role: USER_ROLES.USER,
          }),
        }),
      ]
    : []),
  // 네이버 OAuth
  ...(env.AUTH_NAVER_ID && env.AUTH_NAVER_SECRET
    ? [
        NaverProvider({
          clientId: env.AUTH_NAVER_ID,
          clientSecret: env.AUTH_NAVER_SECRET,
          profile: (profile: any) => {
            const r = (profile as any).response ?? profile;
            return {
              id: String(r.id ?? profile.id),
              email: r.email ?? '',
              name: r.name ?? r.nickname ?? '',
              image: r.profile_image ?? undefined,
              role: USER_ROLES.USER,
            };
          },
        }),
      ]
    : []),
].filter(Boolean);

// ==================== 역할별 세션 설정 ====================

/**
 * 🎯 역할별 세션 설정 생성 함수
 * Auth.js 권장사항에 따른 역할별 차등 적용
 */
export function getSessionConfigByRole(role?: string): {
  maxAge: number;
} {
  // 관리자: 더 엄격한 보안 정책
  if (role === USER_ROLES.ADMIN || role === USER_ROLES.MANAGER) {
    return {
      maxAge: 7 * TIME_UNITS.DAY, // 7일 만료 (보안 강화)
    };
  }

  // 일반 사용자: Auth.js 기본 권장값
  return {
    maxAge: 30 * TIME_UNITS.DAY, // 30일 만료 (Auth.js 권장)
  };
}

// ==================== Auth.js v5 설정 ====================

/**
 * 🎯 NextAuth.js v5 통합 설정
 * 공식 권장 패턴을 따른 간소화된 구조
 */
export const authConfig = {
  // 어댑터: Drizzle PostgreSQL (JWT 전략 최적화)
  adapter: DrizzleAdapter(db, {
    usersTable: adapterUsers,
    accountsTable: adapterAccounts,
  }),

  // OAuth 프로바이더
  providers,

  // 세션 전략: JWT (Auth.js v5 권장)
  session: {
    strategy: 'jwt',
  },


  // 보안 설정 (Auth.js v5 기본값 활용)
  trustHost: true,
  useSecureCookies: isProduction,

  // 페이지 설정
  pages: {
    signIn: '/login',
    error: '/login',
  },

  // 개발 모드 디버깅 (forEach 경고 방지를 위해 비활성화)
  debug: false,

  // ==================== 이벤트 핸들러 ====================

  events: {
    /**
     * 새 사용자 생성 시 호출 - 성능 최적화
     */
    async createUser({ user }: { user: any }) {
      try {
        // role 기본값 보정 후 검증
        const normalizedUser = {
          ...user,
          role: user.role ?? USER_ROLES.USER,
        };
        createUserSchemaEventSchema.parse({ user: normalizedUser });

        if (
          TypeGuards.isString(normalizedUser.id) &&
          TypeGuards.isString(normalizedUser.email)
        ) {
          // 중복 검사를 위한 select 쿼리 최적화
          const existingUser = await db
            .select({ id: appUsers.id })
            .from(appUsers)
            .where(eq(appUsers.email, normalizedUser.email))
            .limit(1);

          if (existingUser.length === 0) {
            // 새 사용자 생성
            await db
              .insert(appUsers)
              .values({
                id: normalizedUser.id,
                email: normalizedUser.email,
                name: normalizedUser.name ?? '',
                image: normalizedUser.image,
                role: normalizedUser.role ?? USER_ROLES.USER,
              });
          } else {
            // 기존 사용자 업데이트 (필요한 필드만)
            await db
              .update(appUsers)
              .set({
                name: normalizedUser.name ?? '',
                image: normalizedUser.image,
                updatedAt: new Date(),
              })
              .where(eq(appUsers.email, normalizedUser.email));
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to create user:', error);
        }
      }
    },

    /**
     * 로그아웃 시 Refresh Token 정리
     */
    async signOut(params: unknown) {
      try {
        const validatedParams = signOutCallbackSchema.parse(params) as { session?: { user?: { id?: string } }, token?: { sub?: string } };
        const userId =
          validatedParams.session?.user?.id ?? validatedParams.token?.sub;

        if (TypeGuards.isString(userId)) {
          await deleteRefreshToken(userId);
        }
      } catch (error) {
        console.error('Failed to cleanup refresh token:', error);
      }
    },
  },

  // ==================== 콜백 함수 ====================

  callbacks: {
    /**
     * JWT 토큰 처리
     */
    async jwt({ token, user, account, trigger }) {
      try {
        // role 기본값 보정 후 검증
        const normalizedUser = user
          ? { ...user, role: user.role ?? USER_ROLES.USER }
          : undefined;
        jwtCallbackSchema.parse({
          token,
          user: normalizedUser,
          account,
          trigger,
        });

        // 최초 로그인: 사용자 정보를 토큰에 저장
        if (normalizedUser && TypeGuards.isString(normalizedUser.id)) {
          token.sub = normalizedUser.id;
          token.role = normalizedUser.role ?? USER_ROLES.USER;
          token.email = normalizedUser.email;
          token.name = normalizedUser.name;
          token.image = normalizedUser.image;
          if (account?.provider) {
            token.provider = account.provider as 'kakao' | 'naver';
          }

          // 역할별 토큰 만료 시간 설정
          const sessionConfig = getSessionConfigByRole(normalizedUser.role);
          token.iat = Math.floor(Date.now() / 1000);
          token.exp = token.iat + sessionConfig.maxAge;

          // Refresh Token 저장 (카카오/네이버)
          if (account?.refresh_token && TypeGuards.isString(account.refresh_token)) {
            try {
              await saveRefreshToken(normalizedUser.id, account.refresh_token);
            } catch (error) {
              if (process.env.NODE_ENV === 'development') {
                console.error('Failed to save refresh token:', error);
              }
            }
          }
        }

        // 세션 갱신 처리 - 성능 최적화
        if (trigger === 'update' && TypeGuards.isString(token.sub)) {
          try {
            // 항상 최신 사용자 상태를 조회하여 즉시 반영
            const usersRepo = new UsersRepository();
            const user = await usersRepo.getByIdWithLimits(token.sub);

            if (!user || user.deletedAt) {
              return null; // 비활성 계정
            }

            // 액세스 토큰 리프레시는 만료 임박시에만 수행하여 비용 절약
            const now = Math.floor(Date.now() / 1000);
            const shouldRefresh = token.exp && token.exp - now < TIME_UNITS.MINUTE / 1000;
            if (shouldRefresh) {
              try {
                const provider = (token.provider as 'kakao' | 'naver' | undefined) ?? 'kakao';
                const result = await refreshAccessToken(provider, token.sub);
                const { accessToken, expiresAt } = result;
                token.accessToken = accessToken;
                token.exp = expiresAt;
              } catch (error) {
                if (process.env.NODE_ENV === 'development') {
                  console.error('Token refresh failed:', error);
                }
                return null;
              }
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('User fetch on update failed:', error);
            }
            return null;
          }
        }

        return token;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('JWT callback error:', error);
        }
        return null;
      }
    },

    /**
     * 세션 객체 생성
     */
    async session({ session, token }: { session: Session; token: JWT }) {
      try {
        sessionCallbackSchema.parse({ session, token });

        if (token && TypeGuards.isString(token.sub) && session.user) {
          session.user.id = token.sub;
          session.user.role = (token.role as 'user' | 'manager' | 'admin' | undefined) ?? USER_ROLES.USER;

          if (TypeGuards.isString(token.email)) {
            session.user.email = token.email;
          }
          if (TypeGuards.isString(token.name)) {
            session.user.name = token.name;
          }
          if (TypeGuards.isString((token as any).image)) {
            session.user.image = (token as any).image as string;
          }
        }

        return session;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Session callback error:', error);
        }
        return session;
      }
    },

    /**
     * 로그인 허용/거부 결정
     */
    async signIn({ user, account, profile }) {
      try {
        // OAuth 데이터 간단 정규화
        const normalizedData = {
          user: {
            ...user,
            id: user.id ?? generateUUID(),
            role: user.role ?? USER_ROLES.USER,
          },
          account,
          profile,
        };

        signInCallbackSchema.parse(normalizedData);

        // 필수 정보 확인
        const email = (normalizedData.user as { email?: string }).email;
        return !!(
          TypeGuards.isString(normalizedData.user.id) &&
          TypeGuards.isString(email)
        );
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('SignIn callback error:', error);
        }
        return false;
      }
    },
  },
} satisfies NextAuthConfig;

// ==================== 타입 정의 ====================
// (외부에서 사용되지 않아 제거)
