// eslint.config.mjs (ESLint v9 Flat Config 기준)
// 권장 기준선: @eslint/js 기본 → Next core-web-vitals → TS 타입기반 권장 → Prettier(맨 끝)

import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import { defineConfig, globalIgnores } from "eslint/config";
// 타입 정보 기반 규칙 사용(정밀). 빠른 스타트가 필요하면 아래 블록을 nextTs로 대체하세요.
// import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

export default defineConfig([
  // 1) ESLint 코어 권장 (Flat Config에서는 문자열 "eslint:recommended"가 아니라 @eslint/js를 사용)
  js.configs.recommended,

  // 2) Next 권장 (React/React-Hooks 권장 포함)
  ...nextVitals,

  // 3) TypeScript: 타입 정보 기반 검사 활성화 (recommendedTypeChecked)
  //    - tsconfigRootDir는 프로젝트 루트 기준으로 조정하세요.
  //    - 모노레포면 루트/앱 경로에 맞게 설정하거나 tsconfig.eslint.json을 사용하세요.
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...tseslint.configs.recommendedTypeChecked,
  // 엄격하게 갈 경우 추가:
  // ...tseslint.configs.strictTypeChecked,

  // (대안, 빠른 스타트): 위의 타입기반 블록 2개를 제거하고 아래 한 줄로 대체
  // ...nextTs,

  // 4) 전역 무시 (생성 산출물/빌드 아웃폴더 확실히 배제)
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "dist/**",
    "coverage/**",
    ".turbo/**",
    ".vercel/**",
    "**/*.min.*",
  ]),

  // 5) Prettier 충돌 해제(항상 마지막)
  ...prettier,

  // (옵션) 모노레포/서브앱 환경에서 Next 플러그인에 앱 루트 지정
  // {
  //   settings: {
  //     next: {
  //       rootDir: ["./"], // 예: ["apps/web"]
  //     },
  //   },
  // },

  // (옵션) 테스트/스토리북 완화 프로필
  // {
  //   files: ["**/*.test.{ts,tsx}", "**/*.stories.{ts,tsx,mdx}"],
  //   rules: {
  //     // 필요 시 테스트/스토리북 파일만 완화 규칙 지정
  //   },
  // },
]);
