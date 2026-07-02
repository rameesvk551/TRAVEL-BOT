// FILE: mobile/src/features/auth/screens/SignupScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '../../../theme/ThemeProvider';
import { Input, Button, SectionHeader, Segmented, ErrorState } from '../../../ui';
import { registerSchema } from '../schemas';
import { useRegister } from '../../../hooks/useAuth';

type RegisterFormValues = z.infer<typeof registerSchema>;

const INDUSTRIES = ['TRAVEL', 'RESORT', 'CLEANING', 'LAUNDRY'];

export function SignupScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { mutate: register, isPending, error } = useRegister();
  const [industryIndex, setIndustryIndex] = useState(0);

  const { control, handleSubmit, formState: { errors }, setValue } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { industry: 'TRAVEL' },
  });

  const onSubmit = (data: any) => {
    register(data);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {error && (
          <View style={{ marginBottom: theme.spacing.s4 }}>
            <ErrorState message={(error as any)?.response?.data?.error || 'Registration failed'} onRetry={() => handleSubmit(onSubmit)()} />
          </View>
        )}

        <SectionHeader title="BUSINESS" />
        <View style={{ marginBottom: theme.spacing.s4 }}>
          <Segmented
            segments={['Travel', 'Resort', 'Cleaning', 'Laundry']}
            selectedIndex={industryIndex}
            onChange={(i) => {
              setIndustryIndex(i);
              setValue('industry', INDUSTRIES[i] as any);
            }}
          />
        </View>

        <Controller
          control={control}
          name="agencyName"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Business Name" placeholder="My Business" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.agencyName?.message} />
          )}
        />
        <Controller
          control={control}
          name="agencyPhone"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Business Phone" placeholder="+91" keyboardType="phone-pad" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.agencyPhone?.message} />
          )}
        />
        <Controller
          control={control}
          name="agencyEmail"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Business Email" placeholder="business@example.com" keyboardType="email-address" autoCapitalize="none" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.agencyEmail?.message} />
          )}
        />
        <Controller
          control={control}
          name="whatsappNumber"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="WhatsApp Number" placeholder="+91" keyboardType="phone-pad" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.whatsappNumber?.message} />
          )}
        />

        <View style={{ height: theme.spacing.s4 }} />
        <SectionHeader title="YOUR DETAILS" />

        <Controller
          control={control}
          name="agentName"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Your Name" placeholder="John Doe" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.agentName?.message} />
          )}
        />
        <Controller
          control={control}
          name="agentEmail"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Your Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.agentEmail?.message} />
          )}
        />
        <Controller
          control={control}
          name="agentPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Password" placeholder="Create a password" secureTextEntry onBlur={onBlur} onChangeText={onChange} value={value} error={errors.agentPassword?.message} />
          )}
        />

        <View style={{ height: theme.spacing.s6 }} />
        <Button variant="primary" label="Create account" fullWidth onPress={handleSubmit(onSubmit)} loading={isPending} />
        
        <View style={{ height: theme.spacing.s6 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
});
