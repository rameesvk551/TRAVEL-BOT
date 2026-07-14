// FILE: mobile/src/features/settings/screens/BusinessProfileScreen.tsx
// The agency profile, wired to GET /agencies/me and PATCH /agencies/me.
// Only fields the backend's updateAgencySchema accepts are editable — anything
// else would be silently stripped by validateBody.

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, SectionHeader, Skeleton, ErrorState, Badge, showToast } from '../../../ui';
import { getAuthState } from '../../../hooks/useAuth';
import { useBusinessProfile, useUpdateBusinessProfile, apiErrorMessage } from '../api';

const schema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters'),
  phone: z.string(),
  googleReviewLink: z.string(),
  gstin: z.string().max(32, 'GSTIN is too long'),
  stateCode: z.string().refine((v) => v === '' || /^\d{2}$/.test(v), 'Use the 2-digit GST state code'),
  upiId: z.string().max(120, 'UPI ID is too long'),
});

type BusinessProfileValues = z.infer<typeof schema>;

export function BusinessProfileScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = theme.spacing;

  const { agent } = getAuthState();
  // PATCH /agencies/me is ADMIN-only (requireRole('ADMIN') + agency.manage).
  const canEdit = agent?.role === 'ADMIN';

  const profile = useBusinessProfile();
  const update = useUpdateBusinessProfile();
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<BusinessProfileValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', googleReviewLink: '', gstin: '', stateCode: '', upiId: '' },
  });

  useEffect(() => {
    if (profile.data) {
      reset({
        name: profile.data.name || '',
        phone: profile.data.phone || '',
        googleReviewLink: profile.data.googleReviewLink || '',
        gstin: profile.data.gstin || '',
        stateCode: profile.data.stateCode || '',
        upiId: profile.data.upiId || '',
      });
    }
  }, [profile.data, reset]);

  const onSubmit = (values: BusinessProfileValues) => {
    setServerError(null);
    update.mutate(
      {
        name: values.name.trim(),
        phone: values.phone.trim() || undefined,
        googleReviewLink: values.googleReviewLink.trim() || undefined,
        gstin: values.gstin.trim() || null,
        stateCode: values.stateCode.trim() || null,
        upiId: values.upiId.trim() || null,
      },
      {
        onSuccess: (agency) => {
          showToast('Business profile saved', 'success');
          reset({
            name: agency.name || '',
            phone: agency.phone || '',
            googleReviewLink: agency.googleReviewLink || '',
            gstin: agency.gstin || '',
            stateCode: agency.stateCode || '',
            upiId: agency.upiId || '',
          });
        },
        onError: (err) => setServerError(apiErrorMessage(err, 'Could not save your business profile')),
      },
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>
          Business profile
        </Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
          {profile.isError ? (
            <ErrorState
              message={apiErrorMessage(profile.error, 'Could not load your business profile.')}
              onRetry={() => profile.refetch()}
            />
          ) : profile.isLoading ? (
            <View style={{ gap: s.s4 }}>
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </View>
          ) : (
            <View style={{ gap: s.s2 }}>
              {serverError && (
                <View style={{ marginBottom: s.s2 }}>
                  <ErrorState message={serverError} onRetry={handleSubmit(onSubmit)} />
                </View>
              )}

              {!canEdit && (
                <View
                  style={{
                    backgroundColor: theme.colors.bg.fill,
                    borderRadius: theme.radius.md,
                    padding: s.s3,
                    marginBottom: s.s2,
                  }}
                  accessibilityRole="text"
                  accessibilityLabel="Read only. Only an admin can change the business profile."
                >
                  <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}>
                    Read-only — only an admin can change the business profile.
                  </Text>
                </View>
              )}

              <SectionHeader title="Company" />

              <Controller
                control={control}
                name="name"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    label="Business name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    editable={canEdit}
                    error={errors.name?.message}
                    accessibilityLabel="Business name"
                  />
                )}
              />

              <Controller
                control={control}
                name="phone"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    label="Phone number"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="phone-pad"
                    editable={canEdit}
                    error={errors.phone?.message}
                    accessibilityLabel="Business phone number"
                  />
                )}
              />

              {/* Email is set at signup and the update schema does not accept it. */}
              <Input
                label="Business email (cannot be changed here)"
                value={profile.data?.email || '—'}
                editable={false}
                accessibilityLabel="Business email, read only"
              />

              <Controller
                control={control}
                name="googleReviewLink"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    label="Google review link"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="https://g.page/r/…"
                    autoCapitalize="none"
                    keyboardType="url"
                    editable={canEdit}
                    error={errors.googleReviewLink?.message}
                    accessibilityLabel="Google review link"
                  />
                )}
              />

              <View style={{ marginTop: s.s3 }}>
                <SectionHeader title="Tax & payments" />
                <Controller
                  control={control}
                  name="gstin"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <Input
                      label="GSTIN"
                      value={value}
                      onChangeText={(t) => onChange(t.toUpperCase())}
                      onBlur={onBlur}
                      placeholder="32ABCDE1234F1Z5"
                      autoCapitalize="characters"
                      maxLength={15}
                      editable={canEdit}
                      error={errors.gstin?.message}
                      accessibilityLabel="Company GSTIN"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="stateCode"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <Input
                      label="GST state code"
                      value={value}
                      onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 2))}
                      onBlur={onBlur}
                      placeholder="32"
                      keyboardType="number-pad"
                      maxLength={2}
                      editable={canEdit}
                      error={errors.stateCode?.message}
                      accessibilityLabel="GST state code"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="upiId"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <Input
                      label="UPI ID for invoice payments"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="yourbusiness@okhdfcbank"
                      autoCapitalize="none"
                      editable={canEdit}
                      error={errors.upiId?.message}
                      accessibilityLabel="UPI ID"
                    />
                  )}
                />
              </View>

              <View style={{ marginTop: s.s3 }}>
                <SectionHeader title="Plan" />
                <View style={{ flexDirection: 'row', gap: s.s2, alignItems: 'center' }}>
                  <Badge label={profile.data?.plan || 'FREE'} variant="info" />
                  {profile.data?.whatsappDisplayPhoneNumber ? (
                    <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}>
                      WhatsApp · {profile.data.whatsappDisplayPhoneNumber}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {canEdit && (
        <View
          style={{
            padding: s.s4,
            backgroundColor: theme.colors.bg.surface,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border.hairline,
          }}
        >
          <Button
            variant="primary"
            label="Save changes"
            fullWidth
            loading={update.isPending}
            disabled={update.isPending || !isDirty || profile.isLoading || profile.isError}
            onPress={handleSubmit(onSubmit)}
            accessibilityLabel="Save business profile changes"
          />
        </View>
      )}
    </SafeAreaView>
  );
}
