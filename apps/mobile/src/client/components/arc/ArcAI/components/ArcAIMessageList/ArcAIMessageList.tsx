/**
 * ArcAI 메시지 리스트 컴포넌트
 */

import React, { useEffect, useRef } from 'react';
import { FlatList, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ArcAIMessage } from '../ArcAIMessage/ArcAIMessage';
import type { UIMessage } from 'ai';

export interface ArcAIMessageListProps {
  messages: UIMessage[];
  aiStatus?: 'idle' | 'submitted' | 'streaming' | 'error';
  emptyTitle?: string;
}

export function ArcAIMessageList({
  messages,
  aiStatus,
  emptyTitle,
}: ArcAIMessageListProps) {
  const flatListRef = useRef<FlatList>(null);

  // 새 메시지가 추가되면 자동 스크롤
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  if (messages.length === 0 && emptyTitle) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyTitle}</Text>
      </View>
    );
  }

  if (messages.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>메시지를 입력하여 대화를 시작하세요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ArcAIMessage message={item} />}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }}
        ListFooterComponent={
          aiStatus === 'streaming' ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
});

