import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import { AppProviders } from '@/share/providers/client/client-providers';

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }}>
        {/* 루트 index 라우트에서 로그인 여부에 따라 (auth)/(app)으로 Redirect 처리 */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {},
});

