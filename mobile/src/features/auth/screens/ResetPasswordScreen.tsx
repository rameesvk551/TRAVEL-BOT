// FILE: mobile/src/features/auth/screens/ResetPasswordScreen.tsx
import React from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '../../../theme/ThemeProvider';
import { Input, Button, ErrorState, ProgressBar } from '../../../ui';
import { resetPasswordSchema } from '../schemas';
import { useResetPassword } from '../../../hooks/useAuth';

type ResetFormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  // In a real flow, token might come from deep link params
  const token = route?.params?.token || ''; 
  const { mutate: resetPassword, isPending, error } = useResetPassword();

  const { control, handleSubmit, formState: { errors }, watch } = useForm<ResetFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const pwd = watch('password');
  // Simple strength meter logic (0 to 1)
  const strength = pwd.length === 0 ? 0 : Math.min(1, pwd.length / 10 + (/[A-Z]/.test(pwd) ? 0.2 : 0) + (/[0-9]/.test(pwd) ? 0.2 : 0));

  const onSubmit = (data: ResetFormValues) => {
    resetPassword({ token, password: data.password }, {
      onSuccess: () => navigation.navigate('Login'),
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={[theme.typography.title2, { color: theme.colors.text.primary, marginBottom: theme.spacing.s6 }]}>
          Reset Password
        </Text>

        {error && (
          <View style={{ marginBottom: theme.spacing.s4 }}>
            <ErrorState message={(error as any)?.response?.data?.error || 'Failed to reset password'} onRetry={() => handleSubmit(onSubmit)()} />
          </View>
        )}

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="New Password" placeholder="At least 8 characters" secureTextEntry onBlur={onBlur} onChangeText={onChange} value={value} error={errors.password?.message} />
          )}
        />
        
        {/* Strength Meter */}
        {pwd.length > 0 && (
          <View style={{ marginBottom: theme.spacing.s4, marginTop: -theme.spacing.s2 }}>
            <ProgressBar progress={strength} height={4} />
            <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary, marginTop: 4 }]}>
              {strength < 0.5 ? 'Weak' : strength < 0.8 ? 'Good' : 'Strong'}
            </Text>
          </View>
        )}

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Confirm Password" placeholder="Re-enter password" secureTextEntry onBlur={onBlur} onChangeText={onChange} value={value} error={errors.confirmPassword?.message} />
          )}
        />

        <View style={{ height: theme.spacing.s4 }} />
        <Button variant="primary" label="Reset password" fullWidth onPress={handleSubmit(onSubmit)} loading={isPending} />
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
