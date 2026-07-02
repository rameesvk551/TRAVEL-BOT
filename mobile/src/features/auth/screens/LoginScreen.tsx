// FILE: mobile/src/features/auth/screens/LoginScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '../../../theme/ThemeProvider';
import { Input, Button, ErrorState } from '../../../ui';
import { loginSchema } from '../schemas';
import { useLogin } from '../../../hooks/useAuth';

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginScreen({ navigation }: any) {
  const { theme, tenantLogo } = useTheme();
  const { mutate: login, isPending, error } = useLogin();

  const { control, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (data: LoginFormValues) => {
    login(data); // RootNavigator will handle the redirect upon success
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          {tenantLogo ? (
            <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary }]}>[Logo]</Text>
          ) : (
            <Text style={[theme.typography.largeTitle, { color: theme.colors.accent, fontWeight: '800' }]}>
              TravelBot
            </Text>
          )}
          <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: theme.spacing.s2 }]}>
            Sign in to your account
          </Text>
        </View>

        {error && (
          <View style={{ marginBottom: theme.spacing.s4 }}>
            <ErrorState message={(error as any)?.response?.data?.error || 'Invalid credentials'} onRetry={() => handleSubmit(onSubmit)()} />
          </View>
        )}

        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Email"
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.email?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Password"
                placeholder="Enter password"
                secureTextEntry
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.password?.message}
              />
            )}
          />

          <Button
            variant="primary"
            label="Sign in"
            fullWidth
            onPress={handleSubmit(onSubmit)}
            loading={isPending}
          />

          <View style={{ marginTop: theme.spacing.s6, alignItems: 'center', gap: theme.spacing.s4 }}>
            <Button
              variant="plain"
              label="Forgot password?"
              onPress={() => navigation.navigate('ForgotPassword')}
            />
            <Button
              variant="plain"
              label="Create account"
              onPress={() => navigation.navigate('Signup')}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  form: {
    width: '100%',
  },
});
