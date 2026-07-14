// FILE: mobile/src/features/visas/screens/VisaFormScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useVisa,
  useCreateVisa,
  useUpdateVisa,
  useUploadVisaImage,
  rupeesToPaise,
  paiseToRupees,
  getApiErrorMessage,
} from '../api';
import {
  Button,
  Input,
  CurrencyField,
  SectionHeader,
  ProgressBar,
  Switch,
  Banner,
  Skeleton,
  showToast,
} from '../../../ui';
import { ArrowLeft, Plus, X, ImageIcon } from 'lucide-react-native';

// Mirrors backend/src/routes/visas.ts visaSchema.
const schema = z.object({
  country: z.string().trim().min(1, 'Country is required'),
  visaType: z.string().trim().optional(),
  price: z
    .string()
    .trim()
    .refine((v) => v === '' || Number(v) >= 0, 'Price cannot be negative'),
  processingTime: z.string().trim().optional(),
  validityPeriod: z.string().trim().optional(),
  requiredDocuments: z.array(z.object({ value: z.string().trim().min(1) })),
  description: z.string().trim().optional(),
  eligibilityNotes: z.string().trim().optional(),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const STEP_COUNT = 2;

export function VisaFormScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const visaId: string | undefined = route?.params?.visaId;
  const isEdit = Boolean(visaId);
  const [step, setStep] = useState(0);

  const { data: existing, isLoading } = useVisa(visaId);
  const createVisa = useCreateVisa();
  const updateVisa = useUpdateVisa(visaId ?? '');
  const uploadImage = useUploadVisaImage();
  const mutation = isEdit ? updateVisa : createVisa;

  const s = theme.spacing;

  const {
    control,
    handleSubmit,
    reset,
    trigger,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      country: '',
      visaType: '',
      price: '',
      processingTime: '',
      validityPeriod: '',
      requiredDocuments: [],
      description: '',
      eligibilityNotes: '',
      imageUrl: null,
      isActive: true,
    },
  });

  const documents = useFieldArray({ control, name: 'requiredDocuments' });
  const imageUrl = watch('imageUrl');

  useEffect(() => {
    if (!existing) return;
    reset({
      country: existing.country,
      visaType: existing.visaType ?? '',
      price: existing.price != null ? String(paiseToRupees(existing.price)) : '',
      processingTime: existing.processingTime ?? '',
      validityPeriod: existing.validityPeriod ?? '',
      requiredDocuments: (existing.requiredDocuments ?? []).map((value) => ({ value })),
      description: existing.description ?? '',
      eligibilityNotes: existing.eligibilityNotes ?? '',
      imageUrl: existing.imageUrl,
      isActive: existing.isActive,
    });
  }, [existing, reset]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Photo library permission is required', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    uploadImage.mutate(
      { uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType },
      {
        onSuccess: (data) => {
          setValue('imageUrl', data.url, { shouldDirty: true });
          showToast('Image uploaded', 'success');
        },
        onError: (err) => showToast(getApiErrorMessage(err, 'Upload failed'), 'error'),
      },
    );
  };

  const onSubmit = (values: FormValues) => {
    const payload = {
      country: values.country,
      visaType: values.visaType || null,
      price: rupeesToPaise(values.price),
      processingTime: values.processingTime || null,
      validityPeriod: values.validityPeriod || null,
      requiredDocuments: values.requiredDocuments.map((d) => d.value),
      description: values.description || null,
      eligibilityNotes: values.eligibilityNotes || null,
      imageUrl: values.imageUrl,
      isActive: values.isActive,
    };

    mutation.mutate(payload as any, {
      onSuccess: () => {
        showToast(isEdit ? 'Visa updated' : 'Visa created', 'success');
        navigation.goBack();
      },
    });
  };

  const handleNext = async () => {
    if (step === 0) {
      const ok = await trigger(['country', 'price']);
      if (!ok) return;
    }
    if (step < STEP_COUNT - 1) setStep(step + 1);
    else handleSubmit(onSubmit)();
  };

  if (isEdit && isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ padding: s.s4, gap: s.s4 }}>
          <Skeleton height={40} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: s.s4,
          paddingVertical: s.s3,
        }}
      >
        <Button
          variant="icon"
          icon={ArrowLeft}
          onPress={() => (step > 0 ? setStep(step - 1) : navigation.goBack())}
          accessibilityLabel={step > 0 ? 'Previous step' : 'Close'}
        />
        <View style={{ flex: 1, marginHorizontal: s.s4 }}>
          <ProgressBar progress={(step + 1) / STEP_COUNT} />
        </View>
        <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>
          {step + 1} of {STEP_COUNT}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
          {mutation.isError ? (
            <View style={{ marginBottom: s.s4 }}>
              <Banner
                visible
                variant="error"
                message={getApiErrorMessage(mutation.error, 'Could not save visa')}
              />
            </View>
          ) : null}

          {step === 0 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Visa Details" />
              <Controller
                control={control}
                name="country"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    label="Country"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. United Arab Emirates"
                    error={errors.country?.message}
                    accessibilityLabel="Country"
                  />
                )}
              />
              <Controller
                control={control}
                name="visaType"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Visa Type"
                    value={value ?? ''}
                    onChangeText={onChange}
                    placeholder="e.g. Tourist (30 Days)"
                    accessibilityLabel="Visa type"
                  />
                )}
              />
              <Controller
                control={control}
                name="price"
                render={({ field: { value, onChange } }) => (
                  <CurrencyField
                    label="Price"
                    value={value}
                    onChangeText={onChange}
                    placeholder="7500"
                    error={errors.price?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="processingTime"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Processing Time"
                    value={value ?? ''}
                    onChangeText={onChange}
                    placeholder="e.g. 3-4 Days"
                    accessibilityLabel="Processing time"
                  />
                )}
              />
              <Controller
                control={control}
                name="validityPeriod"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Validity"
                    value={value ?? ''}
                    onChangeText={onChange}
                    placeholder="e.g. 30 Days"
                    accessibilityLabel="Validity period"
                  />
                )}
              />
            </View>
          )}

          {step === 1 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Requirements" />
              <DocumentAdder onAdd={(value) => documents.append({ value })} />

              <View style={{ gap: s.s2 }}>
                {documents.fields.map((field, index) => (
                  <View
                    key={field.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: theme.colors.bg.surface,
                      borderRadius: theme.radius.md,
                      paddingVertical: s.s2,
                      paddingLeft: s.s3,
                      paddingRight: s.s2,
                    }}
                  >
                    <Text
                      style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}
                    >
                      {(field as any).value}
                    </Text>
                    <Button
                      variant="icon"
                      icon={X}
                      onPress={() => documents.remove(index)}
                      accessibilityLabel={`Remove ${(field as any).value}`}
                    />
                  </View>
                ))}
              </View>

              <Controller
                control={control}
                name="eligibilityNotes"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Eligibility Notes"
                    value={value ?? ''}
                    onChangeText={onChange}
                    multiline
                    placeholder="Any specific rules..."
                    accessibilityLabel="Eligibility notes"
                  />
                )}
              />
              <Controller
                control={control}
                name="description"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Description"
                    value={value ?? ''}
                    onChangeText={onChange}
                    multiline
                    accessibilityLabel="Description"
                  />
                )}
              />

              <SectionHeader title="Image" />
              <View
                style={{
                  height: 140,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.bg.fill,
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: 'hidden',
                }}
              >
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={{ width: '100%', height: '100%' }}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <ImageIcon color={theme.colors.text.tertiary} size={32} />
                )}
              </View>
              <Button
                variant="secondary"
                label={imageUrl ? 'Replace Image' : 'Upload Image'}
                loading={uploadImage.isPending}
                onPress={pickImage}
                accessibilityLabel={imageUrl ? 'Replace visa image' : 'Upload visa image'}
              />

              <Controller
                control={control}
                name="isActive"
                render={({ field: { value, onChange } }) => (
                  <Switch label="Active" value={value} onValueChange={onChange} />
                )}
              />
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
          label={step === STEP_COUNT - 1 ? (isEdit ? 'Save Visa' : 'Create Visa') : 'Next'}
          fullWidth
          loading={mutation.isPending}
          onPress={handleNext}
          accessibilityLabel={step === STEP_COUNT - 1 ? 'Save visa' : 'Next step'}
        />
      </View>
    </SafeAreaView>
  );
}

function DocumentAdder({ onAdd }: { onAdd: (value: string) => void }) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState('');
  const s = theme.spacing;

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    onAdd(value);
    setDraft('');
  };

  return (
    <View style={{ gap: s.s2 }}>
      <Input
        label="Add Document"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={add}
        returnKeyType="done"
        placeholder="e.g. 6 months valid passport"
        accessibilityLabel="Required document"
      />
      <Button
        variant="secondary"
        icon={Plus}
        label="Add Requirement"
        onPress={add}
        accessibilityLabel="Add required document"
      />
    </View>
  );
}
