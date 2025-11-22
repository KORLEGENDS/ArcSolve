import { Stack, useRouter, useSegments } from 'expo-router';
import React, { type ReactNode, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  useAuthIsAuthenticated,
  useAuthIsLoading,
} from '@/client/states/stores/auth-store';
import { AppProviders } from '@/share/providers/client/client-providers';

function AuthRedirectBoundary({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthIsAuthenticated();
  const isLoading = useAuthIsLoading();
  const router = useRouter();
  const segments = useSegments();

  const authSegment = segments[0];
  const isInAuthGroup = authSegment === '(auth)';

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isInAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && isInAuthGroup) {
      router.replace('/(app)');
    }
  }, [isLoading, isAuthenticated, isInAuthGroup, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isAuthenticated && !isInAuthGroup) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AppProviders>
      <AuthRedirectBoundary>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AuthRedirectBoundary>
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});

