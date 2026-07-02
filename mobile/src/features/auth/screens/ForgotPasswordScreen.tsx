// FILE: mobile/src/features/auth/screens/ForgotPasswordScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '../../../theme/ThemeProvider';
import { Input, Button, EmptyState, ErrorState } from '../../../ui';
import { forgotPasswordSchema } from '../schemas';
import { useForgotPassword } from '../../../hooks/useAuth';
import { CheckCircle2 } from 'lucide-react-native';

type ForgotFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { mutate: forgotPassword, isPending, error } = useForgotPassword();
  const [success, setSuccess] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = (data: ForgotFormValues) => {
    forgotPassword(data, {
      onSuccess: () => setSuccess(true),
    });
  };

  if (success) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}>
        <EmptyState
          icon={CheckCircle2}
          title="Check your email"
          message="We have sent a password reset link to your email address."
          actionLabel="Back to Login"
          onAction={() => navigation.navigate('Login')}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {error && (
          <View style={{ marginBottom: theme.spacing.s4 }}>
            <ErrorState message={(error as any)?.response?.data?.error || 'Failed to send reset link'} onRetry={() => handleSubmit(onSubmit)()} />
          </View>
        )}

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.email?.message} />
          )}
        />

        <Button variant="primary" label="Send reset link" fullWidth onPress={handleSubmit(onSubmit)} loading={isPending} />

        <View style={{ marginTop: theme.spacing.s6, alignItems: 'center' }}>
          <Button variant="plain" label="Back to login" onPress={() => navigation.navigate('Login')} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
});
