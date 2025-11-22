/**
 * AI 채팅 화면
 * ArcAI 컴포넌트를 사용하여 AI 채팅 인터페이스 제공
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArcAI } from '@/client/components/arc/ArcAI/ArcAI';
import { useLocalSearchParams } from 'expo-router';

export default function AIChatScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();

  if (!documentId || typeof documentId !== 'string') {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>유효하지 않은 세션 ID입니다.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ArcAI documentId={documentId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
});

