/**
 * AI 채팅 화면
 * ArcAI 컴포넌트를 사용하여 AI 채팅 인터페이스 제공
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ArcAI } from '@/client/components/arc/ArcAI/ArcAI';

export interface AIChatScreenProps {
  documentId: string;
}

export function AIChatScreen({ documentId }: AIChatScreenProps) {
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
});

