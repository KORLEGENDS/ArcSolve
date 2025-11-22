import { useLocalSearchParams } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';

import { AIChatScreen } from '@/client/screens/ai/AIChatScreen';

export default function AIChatRoute() {
  const params = useLocalSearchParams<{ documentId?: string | string[] }>();
  const documentIdParam = params.documentId;
  const documentId =
    typeof documentIdParam === 'string'
      ? documentIdParam
      : Array.isArray(documentIdParam)
      ? documentIdParam[0]
      : undefined;

  if (!documentId) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>대상 문서가 선택되지 않았습니다.</Text>
      </View>
    );
  }

  return <AIChatScreen documentId={documentId} />;
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
  },
});

