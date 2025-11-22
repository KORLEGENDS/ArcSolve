/**
 * 로그인 화면
 * 카카오/네이버 소셜 로그인 버튼 제공
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSocialLogin } from '@/client/states/queries/auth/useAuth';
import type { OAuthProvider } from '@/share/libs/auth/oauth-config';

export default function LoginScreen() {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const { login, isLoading } = useSocialLogin();

  const handleSocialLogin = async (provider: OAuthProvider) => {
    try {
      setLoadingProvider(provider);
      await login(provider);
      // 로그인 성공 시 네비게이션은 _layout.tsx에서 처리
    } catch (error) {
      Alert.alert(
        '로그인 실패',
        error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.'
      );
    } finally {
      setLoadingProvider(null);
    }
  };

  const isKakaoLoading = loadingProvider === 'kakao' || isLoading;
  const isNaverLoading = loadingProvider === 'naver' || isLoading;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>ArcSolve</Text>
        <Text style={styles.subtitle}>로그인하여 시작하세요</Text>

        <View style={styles.buttonContainer}>
          {/* 카카오 로그인 버튼 */}
          <TouchableOpacity
            style={[styles.button, styles.kakaoButton]}
            onPress={() => handleSocialLogin('kakao')}
            disabled={isKakaoLoading || isNaverLoading}
          >
            {isKakaoLoading ? (
              <ActivityIndicator color="rgba(0,0,0,0.85)" />
            ) : (
              <Text style={styles.kakaoButtonText}>카카오 로그인</Text>
            )}
          </TouchableOpacity>

          {/* 네이버 로그인 버튼 */}
          <TouchableOpacity
            style={[styles.button, styles.naverButton]}
            onPress={() => handleSocialLogin('naver')}
            disabled={isKakaoLoading || isNaverLoading}
          >
            {isNaverLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.naverButtonText}>네이버 로그인</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 48,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  kakaoButton: {
    backgroundColor: '#FEE500',
  },
  kakaoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.85)',
  },
  naverButton: {
    backgroundColor: '#03C75A',
  },
  naverButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

