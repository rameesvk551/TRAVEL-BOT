// FILE: mobile/src/features/packages/screens/PackageFormScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  usePackage,
  useCreatePackage,
  useUpdatePackage,
  useUploadPackageImage,
  rupeesToPaise,
  paiseToRupees,
  getApiErrorMessage,
} from '../api';
import {
  Button,
  Input,
  CurrencyField,
  Segmented,
  SectionHeader,
  ProgressBar,
  Switch,
  Banner,
  Skeleton,
  showToast,
} from '../../../ui';
import { ArrowLeft, Plus, X, ImageIcon } from 'lucide-react-native';

// Mirrors backend/src/routes/packages.ts packageSchema (name min 2, basePrice a
// positive int in paise). Price is captured in rupees and converted on submit.
const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  category: z.enum(['DOMESTIC', 'INTERNATIONAL']),
  basePrice: z
    .string()
    .trim()
    .refine((v) => v === '' || Number(v) > 0, 'Price must be greater than 0'),
  duration: z.string().trim().max(100).optional(),
  summary: z.string().trim().max(2000).optional(),
  inclusions: z.array(z.object({ value: z.string().trim().min(1) })),
  exclusions: z.array(z.object({ value: z.string().trim().min(1) })),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const CATEGORIES: FormValues['category'][] = ['DOMESTIC', 'INTERNATIONAL'];
const STEP_COUNT = 4;

export function PackageFormScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const packageId: string | undefined = route?.params?.packageId;
  const isEdit = Boolean(packageId);
  const [step, setStep] = useState(0);

  const { data: existing, isLoading } = usePackage(packageId);
  const createPkg = useCreatePackage();
  const updatePkg = useUpdatePackage(packageId ?? '');
  const uploadImage = useUploadPackageImage();
  const mutation = isEdit ? updatePkg : createPkg;

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
      name: '',
      category: 'DOMESTIC',
      basePrice: '',
      duration: '',
      summary: '',
      inclusions: [],
      exclusions: [],
      imageUrl: null,
      isActive: true,
    },
  });

  const inclusions = useFieldArray({ control, name: 'inclusions' });
  const exclusions = useFieldArray({ control, name: 'exclusions' });
  const imageUrl = watch('imageUrl');

  // Hydrate the form once the package loads.
  useEffect(() => {
    if (!existing) return;
    reset({
      name: existing.name,
      category: existing.category?.toUpperCase() === 'INTERNATIONAL' ? 'INTERNATIONAL' : 'DOMESTIC',
      basePrice: existing.basePrice != null ? String(paiseToRupees(existing.basePrice)) : '',
      duration: existing.duration ?? '',
      summary: existing.summary ?? '',
      inclusions: (existing.inclusions ?? []).map((value) => ({ value })),
      exclusions: (existing.exclusions ?? []).map((value) => ({ value })),
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
          showToast('Cover image uploaded', 'success');
        },
        onError: (err) => showToast(getApiErrorMessage(err, 'Upload failed'), 'error'),
      },
    );
  };

  const onSubmit = (values: FormValues) => {
    const payload = {
      name: values.name,
      category: values.category,
      duration: values.duration || null,
      summary: values.summary || null,
      basePrice: rupeesToPaise(values.basePrice),
      inclusions: values.inclusions.map((i) => i.value),
      exclusions: values.exclusions.map((e) => e.value),
      imageUrl: values.imageUrl,
      isActive: values.isActive,
    };

    mutation.mutate(payload as any, {
      onSuccess: () => {
        showToast(isEdit ? 'Package updated' : 'Package created', 'success');
        navigation.goBack();
      },
    });
  };

  // Only the first step has required fields; gate forward navigation on it.
  const handleNext = async () => {
    if (step === 0) {
      const ok = await trigger(['name', 'category', 'basePrice', 'duration']);
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
                message={getApiErrorMessage(mutation.error, 'Could not save package')}
              />
            </View>
          ) : null}

          {step === 0 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Basic Details" />
              <Controller
                control={control}
                name="name"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    label="Package Name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Goa Beach Escape"
                    error={errors.name?.message}
                    accessibilityLabel="Package name"
                  />
                )}
              />
              <Controller
                control={control}
                name="category"
                render={({ field: { value, onChange } }) => (
                  <View>
                    <Text
                      style={[
                        theme.typography.footnote,
                        { color: theme.colors.text.secondary, marginBottom: s.s2 },
                      ]}
                    >
                      Category
                    </Text>
                    <Segmented
                      segments={['Domestic', 'International']}
                      selectedIndex={CATEGORIES.indexOf(value)}
                      onChange={(i) => onChange(CATEGORIES[i])}
                    />
                  </View>
                )}
              />
              <Controller
                control={control}
                name="basePrice"
                render={({ field: { value, onChange } }) => (
                  <CurrencyField
                    label="Base Price (per person)"
                    value={value}
                    onChangeText={onChange}
                    placeholder="25000"
                    error={errors.basePrice?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="duration"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Duration"
                    value={value ?? ''}
                    onChangeText={onChange}
                    placeholder="e.g. 4N/5D"
                    error={errors.duration?.message}
                    accessibilityLabel="Duration"
                  />
                )}
              />
              <Controller
                control={control}
                name="summary"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Summary"
                    value={value ?? ''}
                    onChangeText={onChange}
                    multiline
                    placeholder="Short WhatsApp-friendly summary"
                    error={errors.summary?.message}
                    accessibilityLabel="Summary"
                  />
                )}
              />
            </View>
          )}

          {step === 1 && (
            <StringListStep
              title="Inclusions"
              placeholder="e.g. Breakfast included"
              items={inclusions.fields.map((f) => (f as any).value as string)}
              onAdd={(value) => inclusions.append({ value })}
              onRemove={inclusions.remove}
            />
          )}

          {step === 2 && (
            <StringListStep
              title="Exclusions"
              placeholder="e.g. Flights not included"
              items={exclusions.fields.map((f) => (f as any).value as string)}
              onAdd={(value) => exclusions.append({ value })}
              onRemove={exclusions.remove}
            />
          )}

          {step === 3 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Media & Settings" />
              <View
                style={{
                  height: 160,
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
                label={imageUrl ? 'Replace Cover Image' : 'Upload Cover Image'}
                loading={uploadImage.isPending}
                onPress={pickImage}
                accessibilityLabel={imageUrl ? 'Replace cover image' : 'Upload cover image'}
              />
              {imageUrl ? (
                <Button
                  variant="plain"
                  label="Remove image"
                  onPress={() => setValue('imageUrl', null, { shouldDirty: true })}
                  accessibilityLabel="Remove cover image"
                />
              ) : null}

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
          label={step === STEP_COUNT - 1 ? (isEdit ? 'Save Package' : 'Create Package') : 'Next'}
          fullWidth
          loading={mutation.isPending}
          onPress={handleNext}
          accessibilityLabel={step === STEP_COUNT - 1 ? 'Save package' : 'Next step'}
        />
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Local list editor (inclusions / exclusions)
// ---------------------------------------------------------------------------

function StringListStep({
  title,
  placeholder,
  items,
  onAdd,
  onRemove,
}: {
  title: string;
  placeholder: string;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
}) {
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
    <View style={{ gap: s.s4 }}>
      <SectionHeader title={title} />
      <Input
        label={`Add ${title.toLowerCase().replace(/s$/, '')}`}
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        onSubmitEditing={add}
        returnKeyType="done"
        accessibilityLabel={`Add ${title.toLowerCase()}`}
      />
      <Button
        variant="secondary"
        icon={Plus}
        label="Add"
        onPress={add}
        accessibilityLabel={`Add ${title.toLowerCase()} to list`}
      />

      <View style={{ gap: s.s2 }}>
        {items.map((item, index) => (
          <View
            key={`${item}-${index}`}
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
            <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>
              {item}
            </Text>
            <Button
              variant="icon"
              icon={X}
              onPress={() => onRemove(index)}
              accessibilityLabel={`Remove ${item}`}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
