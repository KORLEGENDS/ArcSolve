/**
 * 404 페이지
 * 존재하지 않는 경로에 접근했을 때 표시
 */

import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '페이지를 찾을 수 없습니다' }} />
      <View style={styles.container}>
        <Text style={styles.title}>404</Text>
        <Text style={styles.subtitle}>이 페이지는 존재하지 않습니다.</Text>
        <Link href="/(app)" style={styles.link}>
          <Text style={styles.linkText}>홈으로 돌아가기</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  link: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  linkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

