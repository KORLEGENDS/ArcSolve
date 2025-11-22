import { Stack, useRouter, useSegments } from 'expo-router';
import React, { type ReactNode, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useSession } from '@/client/states/queries/auth/useAuth';
import { AppProviders } from '@/share/providers/client/client-providers';

function AuthRedirectBoundary({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = useSession();
  const router = useRouter();
  const segments = useSegments();

  const isLoggedIn = Boolean(data?.user);
  const authSegment = segments[0];
  const isInAuthGroup = authSegment === '(auth)';
  const sessionResolved = !isLoading;
  const hasSessionError = Boolean(error);

  useEffect(() => {
    if (!sessionResolved && !hasSessionError) return;

    if (!isLoggedIn && !isInAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isLoggedIn && isInAuthGroup) {
      router.replace('/(app)');
    }
  }, [sessionResolved, hasSessionError, isLoggedIn, isInAuthGroup, router]);

  if (!sessionResolved && !hasSessionError) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isLoggedIn && !isInAuthGroup) {
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

