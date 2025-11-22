/**
 * ArcAI 메시지 컴포넌트
 * 개별 메시지 렌더링
 */

import { isTextUIPart, type UIMessage } from 'ai';
import React from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { Markdown, themes, type Theme } from 'react-native-remark';

export interface ArcAIMessageProps {
  message: UIMessage;
}

export function ArcAIMessage({ message }: ArcAIMessageProps) {
  const isUser = message.role === 'user';
  const textPart = message.parts.find(isTextUIPart);
  const text = textPart?.text ?? '';

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <View style={[styles.messageBox, isUser ? styles.userMessageBox : styles.assistantMessageBox]}>
        {isUser ? (
          <Text style={styles.userText}>{text}</Text>
        ) : (
          <Markdown
            markdown={text}
            theme={assistantMarkdownTheme}
            customStyles={assistantMarkdownStyles}
            onLinkPress={(url) => {
              if (!url) return;
              Linking.openURL(url).catch((error) => {
                console.error('Failed to open markdown link:', error);
              });
            }}
          />
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

const monospaceFontFamily =
  Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) || 'monospace';

const assistantMarkdownTheme: Theme = {
  ...themes.githubTheme,
  global: {
    ...themes.githubTheme.global,
    container: {
      ...(themes.githubTheme.global?.container ?? {}),
      gap: 8,
    },
  },
};

const assistantMarkdownStyles = {
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
    fontSize: 16,
    lineHeight: 22,
    color: '#000000',
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    color: '#000000',
  },
  inlineCode: {
    backgroundColor: '#E8E8E8',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: monospaceFontFamily,
  },
  codeBlock: {
    headerBackgroundColor: '#F0F0F0',
    contentBackgroundColor: '#E8E8E8',
    contentTextStyle: {
      fontFamily: monospaceFontFamily,
      fontSize: 14,
      color: '#000000',
    },
  },
} as const;

