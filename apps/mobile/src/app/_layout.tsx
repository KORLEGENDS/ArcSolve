import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AppProviders } from '@/share/providers/client/client-providers';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProviders>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
          <Stack screenOptions={{ headerShown: false }}>
            {/* 루트 index 라우트에서 로그인 여부에 따라 (auth)/(app)으로 Redirect 처리 */}
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
        </SafeAreaView>
      </AppProviders>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

