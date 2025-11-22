import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  useAuthIsAuthenticated,
  useAuthIsLoading,
} from '@/client/states/stores/auth-store';

export default function IndexRoute() {
  const isAuthenticated = useAuthIsAuthenticated();
  const isLoading = useAuthIsLoading();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(app)" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});


