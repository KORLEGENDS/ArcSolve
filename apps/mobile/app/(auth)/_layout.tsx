/**
 * 인증 그룹 레이아웃
 * 로그인되지 않은 사용자를 위한 화면 그룹
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}

