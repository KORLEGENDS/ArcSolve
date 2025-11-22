/**
 * ArcAI 입력 컴포넌트
 */

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export interface ArcAIInputProps {
  value: string;
  onChange: (text: string) => void;
  onSubmit: (e: { preventDefault: () => void }) => void;
  submitMode?: 'send' | 'stop';
  submitIcon?: React.ReactNode;
  onClickSubmitButton?: () => void;
  submitDisabled?: boolean;
}

export function ArcAIInput({
  value,
  onChange,
  onSubmit,
  submitMode = 'send',
  submitIcon,
  onClickSubmitButton,
  submitDisabled = false,
}: ArcAIInputProps) {
  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (!submitDisabled) {
      onSubmit(e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder="메시지를 입력하세요..."
          multiline
          maxLength={2000}
          editable={submitMode === 'send'}
        />
        <TouchableOpacity
          style={[
            styles.submitButton,
            submitDisabled && styles.submitButtonDisabled,
          ]}
          onPress={() => {
            if (onClickSubmitButton) {
              onClickSubmitButton();
            } else {
              handleSubmit({ preventDefault: () => {} });
            }
          }}
          disabled={submitDisabled}
        >
          {submitMode === 'stop' ? (
            submitIcon || <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>전송</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    fontSize: 16,
    backgroundColor: '#F5F5F5',
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

