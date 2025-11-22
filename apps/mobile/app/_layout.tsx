/**
 * 루트 레이아웃
 * 인증 상태에 따른 라우팅 제어
 */

import { useAuthStore } from '@/client/states/stores/auth-store';
import { AppProviders } from '@/share/providers/client/client-providers';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function RootLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // 로그인 안 됨 → 로그인 화면으로
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // 로그인 됨 → 홈 화면으로
      router.replace('/(app)');
    }
  }, [isAuthenticated, segments, isLoading, router]);

  // 로딩 중일 때 스플래시 화면 표시
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <AppProviders>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

