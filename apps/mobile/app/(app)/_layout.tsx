/**
 * 앱 그룹 레이아웃
 * 인증된 사용자를 위한 화면 그룹
 */

import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="ai/[documentId]" />
    </Stack>
  );
}

