// FILE: mobile/src/features/agents/screens/AgentFormScreen.tsx
// Create / edit a team member against POST /agents and PATCH /agents/:id.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, Segmented, SectionHeader, Switch, Skeleton, ErrorState, showToast } from '../../../ui';
import { getAuthState } from '../../../hooks/useAuth';
import { useAgent, useCreateAgent, useUpdateAgent, apiErrorMessage, AgentRole } from '../api';

const ROLES: AgentRole[] = ['AGENT', 'ADMIN'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildSchema(isEdit: boolean) {
  return z
    .object({
      name: z.string().min(2, 'Name must be at least 2 characters'),
      email: z.string(),
      phone: z.string(),
      password: z.string(),
      role: z.enum(['AGENT', 'ADMIN']),
      isOnline: z.boolean(),
    })
    .superRefine((values, ctx) => {
      if (isEdit) return;
      if (!EMAIL_RE.test(values.email.trim())) {
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter a valid email address' });
      }
      if (values.password && values.password.length < 8) {
        ctx.addIssue({ code: 'custom', path: ['password'], message: 'Password must be at least 8 characters' });
      }
    });
}

type AgentFormValues = z.infer<ReturnType<typeof buildSchema>>;

export function AgentFormScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const s = theme.spacing;

  const agentId: string | undefined = route?.params?.agentId;
  const isEdit = Boolean(agentId);

  const { agent: me } = getAuthState();
  const isAdmin = me?.role === 'ADMIN';

  const existing = useAgent(agentId);
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = useMemo(() => buildSchema(isEdit), [isEdit]);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<AgentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', password: '', role: 'AGENT', isOnline: false },
  });

  useEffect(() => {
    if (isEdit && existing.data) {
      reset({
        name: existing.data.name,
        email: existing.data.email,
        phone: existing.data.phone || '',
        password: '',
        role: existing.data.role,
        isOnline: existing.data.isOnline,
      });
    }
  }, [isEdit, existing.data, reset]);

  const saving = createAgent.isPending || updateAgent.isPending;

  const onSubmit = (values: AgentFormValues) => {
    setServerError(null);

    if (isEdit && agentId) {
      updateAgent.mutate(
        {
          id: agentId,
          name: values.name.trim(),
          phone: values.phone.trim() || undefined,
          isOnline: values.isOnline,
          // The backend only honours role changes from an ADMIN requester.
          ...(isAdmin ? { role: values.role } : {}),
        },
        {
          onSuccess: () => {
            showToast('Team member updated', 'success');
            navigation.goBack();
          },
          onError: (err) => setServerError(apiErrorMessage(err, 'Could not update this team member')),
        },
      );
      return;
    }

    createAgent.mutate(
      {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim() || undefined,
        password: values.password ? values.password : undefined,
        role: values.role,
      },
      {
        onSuccess: (result) => {
          if (!result.welcomeEmailSent) {
            // The welcome email failed — surface the temporary password so the
            // admin can pass it on rather than silently locking the user out.
            Alert.alert(
              'Member created',
              `We could not email ${result.agent.email}. Temporary password: ${result.temporaryPassword}`,
            );
          } else {
            showToast('Team member added — welcome email sent', 'success');
          }
          navigation.goBack();
        },
        onError: (err) => setServerError(apiErrorMessage(err, 'Could not add this team member')),
      },
    );
  };

  const notFound = isEdit && !existing.isLoading && !existing.isError && !existing.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>
          {isEdit ? 'Edit member' : 'Add member'}
        </Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
          {isEdit && existing.isLoading ? (
            <View style={{ gap: s.s4 }}>
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </View>
          ) : isEdit && existing.isError ? (
            <ErrorState
              message={apiErrorMessage(existing.error, 'Could not load this team member.')}
              onRetry={() => existing.refetch()}
            />
          ) : notFound ? (
            <ErrorState message="This team member no longer exists." onRetry={() => navigation.goBack()} />
          ) : (
            <View style={{ gap: s.s2 }}>
              {serverError && (
                <View style={{ marginBottom: s.s2 }}>
                  <ErrorState message={serverError} onRetry={handleSubmit(onSubmit)} />
                </View>
              )}

              <SectionHeader title="Personal details" />

              <Controller
                control={control}
                name="name"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    label="Full name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Priya Nair"
                    error={errors.name?.message}
                    accessibilityLabel="Full name"
                  />
                )}
              />

              <Controller
                control={control}
                name="email"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    label={isEdit ? 'Email address (cannot be changed)' : 'Email address'}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="priya@company.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isEdit}
                    error={errors.email?.message}
                    accessibilityLabel="Email address"
                  />
                )}
              />

              <Controller
                control={control}
                name="phone"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    label="Phone (optional)"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="+91 98765 43210"
                    keyboardType="phone-pad"
                    error={errors.phone?.message}
                    accessibilityLabel="Phone number"
                  />
                )}
              />

              {!isEdit && (
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <Input
                      label="Password (optional — leave blank to email one)"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="At least 8 characters"
                      secureTextEntry
                      autoCapitalize="none"
                      error={errors.password?.message}
                      accessibilityLabel="Password"
                    />
                  )}
                />
              )}

              <View style={{ marginTop: s.s3 }}>
                <SectionHeader title="Role" />
                <Controller
                  control={control}
                  name="role"
                  render={({ field: { value, onChange } }) => (
                    <View>
                      <Segmented
                        segments={['Agent', 'Admin']}
                        selectedIndex={Math.max(0, ROLES.indexOf(value))}
                        onChange={(i) => (isAdmin ? onChange(ROLES[i]) : undefined)}
                      />
                      {!isAdmin && (
                        <Text
                          style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: s.s1 }]}
                        >
                          Only an admin can change roles.
                        </Text>
                      )}
                      {value === 'ADMIN' && (
                        <Text
                          style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: s.s1 }]}
                        >
                          Admins get every permission in the workspace.
                        </Text>
                      )}
                    </View>
                  )}
                />
              </View>

              {isEdit && (
                <View style={{ marginTop: s.s3 }}>
                  <SectionHeader title="Availability" />
                  <Controller
                    control={control}
                    name="isOnline"
                    render={({ field: { value, onChange } }) => (
                      <Switch label="Online — can receive new leads" value={value} onValueChange={onChange} />
                    )}
                  />
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

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
          label={isEdit ? 'Save changes' : 'Add member'}
          fullWidth
          loading={saving}
          disabled={saving || (isEdit && !existing.data)}
          onPress={handleSubmit(onSubmit)}
          accessibilityLabel={isEdit ? 'Save changes to this team member' : 'Add this team member'}
        />
      </View>
    </SafeAreaView>
  );
}
