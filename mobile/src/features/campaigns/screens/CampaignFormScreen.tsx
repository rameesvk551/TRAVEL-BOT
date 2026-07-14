// FILE: mobile/src/features/campaigns/screens/CampaignFormScreen.tsx
// Creates/updates a real campaign. Audience segmentation is intentionally kept
// to the whole-book default here: the backend's audienceFilter supports many
// criteria, but building that editor on a phone would be a worse experience than
// the desktop one. The reach number shown is REAL (POST /campaigns/preview-audience).

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  Button,
  Input,
  Segmented,
  SectionHeader,
  ProgressBar,
  Switch,
  Card,
  Badge,
  Skeleton,
} from '../../../ui';
import { ArrowLeft, Users, Check } from 'lucide-react-native';
import {
  useCampaign,
  useCreateCampaign,
  useUpdateCampaign,
  useSendCampaign,
  usePreviewAudience,
  CampaignType,
} from '../api';
import { useTemplates, Template } from '../../templates/api';

const TYPES: CampaignType[] = ['BROADCAST', 'PROMOTIONAL', 'RE_ENGAGEMENT', 'SEASONAL'];
const TYPE_LABELS = ['Broadcast', 'Promo', 'Re-engage', 'Seasonal'];

const STEPS = 4;

export function CampaignFormScreen({ route, navigation }: any) {
  const campaignId: string | undefined = route?.params?.campaignId;
  const isEdit = Boolean(campaignId);

  const { theme } = useTheme();
  const s = theme.spacing;

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [typeIndex, setTypeIndex] = useState(0);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [sendNow, setSendNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState('');

  const { data: existing, isLoading: loadingExisting } = useCampaign(campaignId ?? '');

  // Only APPROVED templates can actually be sent by Meta.
  const { data: templates } = useTemplates('APPROVED');

  const createMutation = useCreateCampaign();
  const updateMutation = useUpdateCampaign();
  const sendMutation = useSendCampaign();
  const previewMutation = usePreviewAudience();

  const [reach, setReach] = useState<number | null>(null);

  // Hydrate the form when editing.
  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    const idx = TYPES.indexOf(existing.type);
    setTypeIndex(idx >= 0 ? idx : 0);
    setTemplateId(existing.templateId);
    setMessageBody(existing.messageBody ?? '');
    setSendNow(!existing.scheduledAt);
    setScheduledAt(existing.scheduledAt ?? '');
  }, [existing]);

  // Real reach for the default (whole-audience) filter, fetched when we hit the step.
  useEffect(() => {
    if (step !== 1 || reach !== null) return;
    previewMutation.mutate({}, { onSuccess: (count) => setReach(count) });
    // previewMutation is stable per-render from react-query; we intentionally only
    // depend on the step so this fires once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const selectedTemplate = useMemo(
    () => (templates ?? []).find((t: Template) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  const canAdvance = useMemo(() => {
    if (step === 0) return name.trim().length > 0;
    if (step === 2) return Boolean(templateId) || messageBody.trim().length > 0;
    return true;
  }, [step, name, templateId, messageBody]);

  const submitting = createMutation.isPending || updateMutation.isPending || sendMutation.isPending;

  const handleSubmit = async () => {
    const payload = {
      name: name.trim(),
      type: TYPES[typeIndex],
      templateId: templateId ?? undefined,
      messageBody: messageBody.trim() || undefined,
      scheduledAt: sendNow ? null : scheduledAt || null,
    };

    try {
      if (isEdit && campaignId) {
        await updateMutation.mutateAsync({ id: campaignId, ...payload });
        navigation.goBack();
        return;
      }

      const created = await createMutation.mutateAsync(payload);
      if (sendNow) {
        await sendMutation.mutateAsync(created.id);
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert(
        'Could not save campaign',
        e?.response?.data?.error ?? e?.message ?? 'Please try again.',
      );
    }
  };

  const handleNext = () => {
    if (step < STEPS - 1) {
      setStep(step + 1);
      return;
    }
    handleSubmit();
  };

  if (isEdit && loadingExisting) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ padding: s.s4, gap: s.s4 }}>
          <Skeleton height={40} />
          <Skeleton height={120} />
        </View>
      </SafeAreaView>
    );
  }

  const primaryLabel =
    step < STEPS - 1 ? 'Next' : isEdit ? 'Save changes' : sendNow ? 'Send now' : 'Schedule';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button
          variant="icon"
          icon={ArrowLeft}
          onPress={() => (step > 0 ? setStep(step - 1) : navigation.goBack())}
          accessibilityLabel={step > 0 ? 'Previous step' : 'Go back'}
        />
        <View style={{ flex: 1, marginHorizontal: s.s4 }}>
          <ProgressBar progress={(step + 1) / STEPS} />
        </View>
        <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>
          {step + 1} of {STEPS}
        </Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
          {step === 0 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Campaign basics" />
              <Input
                label="Campaign name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Diwali Special"
                accessibilityLabel="Campaign name"
              />
              <View>
                <Text
                  style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: s.s2 }]}
                >
                  Type
                </Text>
                <Segmented segments={TYPE_LABELS} selectedIndex={typeIndex} onChange={setTypeIndex} />
              </View>
            </View>
          )}

          {step === 1 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Audience" />
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.s3 }}>
                  <Users size={20} color={theme.colors.text.tertiary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
                      All customers
                    </Text>
                    {previewMutation.isPending ? (
                      <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>
                        Counting…
                      </Text>
                    ) : (
                      <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>
                        {(reach ?? 0).toLocaleString('en-IN')} contacts will receive this
                      </Text>
                    )}
                  </View>
                </View>
              </Card>
              <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>
                Narrower segments (destination, budget, lead status) can be built on the web app.
              </Text>
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Template" />
              {(templates ?? []).length === 0 ? (
                <Card>
                  <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>
                    No approved templates yet. Write a message below instead.
                  </Text>
                </Card>
              ) : (
                <View style={{ gap: s.s2 }}>
                  {(templates ?? []).map((t: Template) => {
                    const selected = t.id === templateId;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => setTemplateId(selected ? null : t.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Template ${t.displayName}${selected ? ', selected' : ''}`}
                        accessibilityState={{ selected }}
                      >
                        <Card
                          style={{
                            borderWidth: 1,
                            borderColor: selected ? theme.colors.accent : 'transparent',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.s3 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
                                {t.displayName}
                              </Text>
                              <Text
                                style={[theme.typography.subhead, { color: theme.colors.text.secondary, marginTop: 2 }]}
                                numberOfLines={2}
                              >
                                {t.body}
                              </Text>
                            </View>
                            {selected && <Check size={20} color={theme.colors.accent} />}
                          </View>
                        </Card>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <SectionHeader title="Or write a message" />
              <Input
                label="Message body"
                value={messageBody}
                onChangeText={setMessageBody}
                multiline
                placeholder="Hi {{1}}, …"
                accessibilityLabel="Message body"
              />
              {selectedTemplate && (
                <Badge label={`Using template: ${selectedTemplate.displayName}`} variant="info" />
              )}
            </View>
          )}

          {step === 3 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Schedule" />
              <Switch label="Send immediately" value={sendNow} onValueChange={setSendNow} />
              {!sendNow && (
                <Input
                  label="Send at"
                  value={scheduledAt}
                  onChangeText={setScheduledAt}
                  placeholder="YYYY-MM-DDTHH:MM"
                  autoCapitalize="none"
                  accessibilityLabel="Scheduled send time"
                />
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
          label={primaryLabel}
          fullWidth
          disabled={!canAdvance || submitting}
          loading={submitting}
          onPress={handleNext}
          accessibilityLabel={primaryLabel}
        />
      </View>
    </SafeAreaView>
  );
}
