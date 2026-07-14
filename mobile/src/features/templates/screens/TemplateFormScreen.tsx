// FILE: mobile/src/features/templates/screens/TemplateFormScreen.tsx
// Create or edit a Meta message template, then submit it for approval.
// A template that Meta has already APPROVED is locked: editing it would force a
// re-review, so the form is read-only in that state and only shows the content.

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, Segmented, SectionHeader, Card, Badge, Skeleton, ErrorState } from '../../../ui';
import { ArrowLeft, Send, Trash2 } from 'lucide-react-native';
import {
  useTemplate,
  useCreateTemplate,
  useUpdateTemplate,
  useSubmitTemplate,
  useDeleteTemplate,
  TemplateCategory,
  TemplateStatus,
} from '../api';

const CATEGORIES: TemplateCategory[] = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const CATEGORY_LABELS = ['Marketing', 'Utility', 'Auth'];

function statusVariant(status: TemplateStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'REJECTED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function titleCase(value: string): string {
  if (!value) return '';
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function TemplateFormScreen({ route, navigation }: any) {
  const templateId: string | undefined = route?.params?.templateId;
  const isEdit = Boolean(templateId);

  const { theme } = useTheme();
  const s = theme.spacing;

  const [displayName, setDisplayName] = useState('');
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');

  const { data: existing, isLoading, isError, error, refetch } = useTemplate(templateId);

  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const submitMutation = useSubmitTemplate();
  const deleteMutation = useDeleteTemplate();

  useEffect(() => {
    if (!existing) return;
    setDisplayName(existing.displayName);
    const idx = CATEGORIES.indexOf(existing.category);
    setCategoryIndex(idx >= 0 ? idx : 0);
    setBody(existing.body);
    setFooter(existing.footer ?? '');
  }, [existing]);

  // Meta owns an approved template — local edits would silently diverge from what
  // actually sends, so we don't offer them.
  const locked = existing?.status === 'APPROVED' || existing?.status === 'PENDING';
  const valid = displayName.trim().length > 0 && body.trim().length > 0;
  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    submitMutation.isPending ||
    deleteMutation.isPending;

  const handleSave = async () => {
    const payload = {
      displayName: displayName.trim(),
      body: body.trim(),
      category: CATEGORIES[categoryIndex],
      footer: footer.trim() || null,
    };

    try {
      if (isEdit && templateId) {
        await updateMutation.mutateAsync({ id: templateId, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not save template', e?.response?.data?.error ?? e?.message ?? 'Please try again.');
    }
  };

  const handleSubmitForApproval = () => {
    if (!templateId) return;
    Alert.alert('Submit for approval?', 'Meta will review this template before it can be sent.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit',
        onPress: () =>
          submitMutation.mutate(templateId, {
            onSuccess: () => navigation.goBack(),
            onError: (e: any) =>
              Alert.alert('Could not submit', e?.response?.data?.error ?? e?.message ?? 'Please try again.'),
          }),
      },
    ]);
  };

  const handleDelete = () => {
    if (!templateId) return;
    Alert.alert('Delete template?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteMutation.mutate(templateId, {
            onSuccess: () => navigation.goBack(),
            onError: (e: any) =>
              Alert.alert('Could not delete', e?.response?.data?.error ?? e?.message ?? 'Please try again.'),
          }),
      },
    ]);
  };

  if (isEdit && isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ padding: s.s4, gap: s.s4 }}>
          <Skeleton height={40} />
          <Skeleton height={160} />
        </View>
      </SafeAreaView>
    );
  }

  if (isEdit && isError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
          <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        </View>
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: s.s4,
          paddingVertical: s.s3,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
          <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>
            {isEdit ? 'Template' : 'New template'}
          </Text>
        </View>
        {existing && <Badge label={titleCase(existing.status)} variant={statusVariant(existing.status)} />}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
          {locked ? (
            <View style={{ gap: s.s4 }}>
              <Card>
                <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>
                  {existing?.status === 'APPROVED'
                    ? 'Meta has approved this template. Editing it would require a new review, so it is read-only here.'
                    : 'This template is awaiting Meta review and cannot be edited until they respond.'}
                </Text>
              </Card>

              <SectionHeader title="Content" />
              <Card>
                <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
                  {existing?.displayName}
                </Text>
                <Text style={[theme.typography.body, { color: theme.colors.text.primary, marginTop: s.s3 }]}>
                  {existing?.body}
                </Text>
                {existing?.footer ? (
                  <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary, marginTop: s.s3 }]}>
                    {existing.footer}
                  </Text>
                ) : null}
              </Card>
            </View>
          ) : (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Details" />
              <Input
                label="Name"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="e.g. Diwali Offer"
                accessibilityLabel="Template name"
              />
              <View>
                <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: s.s2 }]}>
                  Category
                </Text>
                <Segmented segments={CATEGORY_LABELS} selectedIndex={categoryIndex} onChange={setCategoryIndex} />
              </View>

              <SectionHeader title="Content" />
              <Input
                label="Message body"
                value={body}
                onChangeText={setBody}
                multiline
                placeholder="Hi {{1}}, …"
                accessibilityLabel="Message body"
              />
              <Input
                label="Footer (optional)"
                value={footer}
                onChangeText={setFooter}
                placeholder="e.g. Reply STOP to opt out"
                maxLength={60}
                accessibilityLabel="Template footer"
              />

              <Card>
                <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                  Use numbered placeholders like {'{{1}}'} and {'{{2}}'} for variables. Meta requires a sample value
                  for each one, which is filled in automatically.
                </Text>
              </Card>

              {existing?.status === 'REJECTED' && existing.rejectionReason ? (
                <Card>
                  <Text style={[theme.typography.footnote, { color: theme.colors.status.danger }]}>
                    Meta rejected this: {existing.rejectionReason}
                  </Text>
                </Card>
              ) : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View
        style={{
          padding: s.s4,
          gap: s.s3,
          backgroundColor: theme.colors.bg.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.hairline,
        }}
      >
        {!locked && (
          <Button
            variant="primary"
            label={isEdit ? 'Save changes' : 'Create template'}
            fullWidth
            disabled={!valid || busy}
            loading={createMutation.isPending || updateMutation.isPending}
            onPress={handleSave}
            accessibilityLabel={isEdit ? 'Save template changes' : 'Create template'}
          />
        )}

        {isEdit && existing?.status === 'DRAFT' && (
          <Button
            variant="secondary"
            label="Submit for approval"
            icon={Send}
            fullWidth
            disabled={busy}
            loading={submitMutation.isPending}
            onPress={handleSubmitForApproval}
            accessibilityLabel="Submit template to Meta for approval"
          />
        )}

        {isEdit && !locked && (
          <Button
            variant="destructive"
            label="Delete"
            icon={Trash2}
            fullWidth
            disabled={busy}
            loading={deleteMutation.isPending}
            onPress={handleDelete}
            accessibilityLabel="Delete template"
          />
        )}
      </View>
    </SafeAreaView>
  );
}
