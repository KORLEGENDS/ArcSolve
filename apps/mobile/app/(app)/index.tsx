/**
 * 홈 화면
 * AI 세션 목록 또는 새 세션 생성
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLogout } from '@/client/states/queries/auth/useAuth';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const logout = useLogout();
  const router = useRouter();

  const handleGoToAIChat = () => {
    // 임시로 더미 documentId 사용 (나중에 실제 세션 생성 로직으로 대체)
    router.push('/(app)/ai/a-dummy-document-id');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ArcSolve</Text>
        <TouchableOpacity onPress={() => logout()} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <Text style={styles.welcomeText}>환영합니다!</Text>
        <Text style={styles.subtitle}>AI 세션을 시작하려면 새 세션을 생성하세요.</Text>
        <TouchableOpacity
          style={styles.aiChatButton}
          onPress={handleGoToAIChat}
        >
          <Text style={styles.aiChatButtonText}>AI 채팅 시작</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  aiChatButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  aiChatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

