/**
 * ArcAI 메시지 컴포넌트
 * 개별 메시지 렌더링
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { UIMessage } from 'ai';

export interface ArcAIMessageProps {
  message: UIMessage;
}

export function ArcAIMessage({ message }: ArcAIMessageProps) {
  const isUser = message.role === 'user';
  const text = message.parts.find((p: any) => p.type === 'text')?.text || '';

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <View style={[styles.messageBox, isUser ? styles.userMessageBox : styles.assistantMessageBox]}>
        {isUser ? (
          <Text style={styles.userText}>{text}</Text>
        ) : (
          <Markdown style={markdownStyles}>{text}</Markdown>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  messageBox: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
  },
  userMessageBox: {
    backgroundColor: '#007AFF',
  },
  assistantMessageBox: {
    backgroundColor: '#F0F0F0',
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});

const markdownStyles = {
  body: {
    color: '#000000',
    fontSize: 16,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  code_inline: {
    backgroundColor: '#E8E8E8',
    padding: 2,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: '#E8E8E8',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
};

