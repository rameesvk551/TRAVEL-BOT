// FILE: mobile/src/features/cruises/screens/CruiseFormScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useCruise,
  useCreateCruise,
  useUpdateCruise,
  useUploadCruiseImage,
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
  Card,
  showToast,
} from '../../../ui';
import { ArrowLeft, Plus, X, ImageIcon } from 'lucide-react-native';

// Mirrors backend/src/routes/cruises.ts cruiseSchema.
const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  cruiseLine: z.string().trim().optional(),
  departurePort: z.string().trim().optional(),
  duration: z.string().trim().optional(),
  summary: z.string().trim().optional(),
  basePrice: z
    .string()
    .trim()
    .refine((v) => v === '' || Number(v) >= 0, 'Price cannot be negative'),
  capacity: z
    .string()
    .trim()
    .refine((v) => v === '' || (Number.isInteger(Number(v)) && Number(v) >= 0), 'Whole number only'),
  inclusions: z.array(z.object({ value: z.string().trim().min(1) })),
  cabinTypes: z.array(
    z.object({
      name: z.string().trim().min(1, 'Cabin name is required'),
      price: z
        .string()
        .trim()
        .refine((v) => v === '' || Number(v) >= 0, 'Price cannot be negative'),
      description: z.string().trim().optional(),
    }),
  ),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const STEP_COUNT = 3;

export function CruiseFormScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const cruiseId: string | undefined = route?.params?.cruiseId;
  const isEdit = Boolean(cruiseId);
  const [step, setStep] = useState(0);

  const { data: existing, isLoading } = useCruise(cruiseId);
  const createCruise = useCreateCruise();
  const updateCruise = useUpdateCruise(cruiseId ?? '');
  const uploadImage = useUploadCruiseImage();
  const mutation = isEdit ? updateCruise : createCruise;

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
      cruiseLine: '',
      departurePort: '',
      duration: '',
      summary: '',
      basePrice: '',
      capacity: '',
      inclusions: [],
      cabinTypes: [],
      imageUrl: null,
      isActive: true,
    },
  });

  const inclusions = useFieldArray({ control, name: 'inclusions' });
  const cabins = useFieldArray({ control, name: 'cabinTypes' });
  const imageUrl = watch('imageUrl');

  useEffect(() => {
    if (!existing) return;
    reset({
      name: existing.name,
      cruiseLine: existing.cruiseLine ?? '',
      departurePort: existing.departurePort ?? '',
      duration: existing.duration ?? '',
      summary: existing.summary ?? '',
      basePrice: existing.basePrice != null ? String(paiseToRupees(existing.basePrice)) : '',
      capacity: existing.capacity != null ? String(existing.capacity) : '',
      inclusions: (existing.inclusions ?? []).map((value) => ({ value })),
      cabinTypes: (existing.cabinTypes ?? []).map((c) => ({
        name: c.name,
        price: c.price != null ? String(paiseToRupees(c.price)) : '',
        description: c.description ?? '',
      })),
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
      cruiseLine: values.cruiseLine || null,
      departurePort: values.departurePort || null,
      duration: values.duration || null,
      summary: values.summary || null,
      basePrice: rupeesToPaise(values.basePrice),
      capacity: values.capacity === '' ? null : Number(values.capacity),
      inclusions: values.inclusions.map((i) => i.value),
      cabinTypes: values.cabinTypes.map((c) => ({
        name: c.name,
        price: rupeesToPaise(c.price),
        description: c.description || null,
      })),
      imageUrl: values.imageUrl,
      isActive: values.isActive,
    };

    mutation.mutate(payload as any, {
      onSuccess: () => {
        showToast(isEdit ? 'Cruise updated' : 'Cruise created', 'success');
        navigation.goBack();
      },
    });
  };

  const handleNext = async () => {
    if (step === 0) {
      const ok = await trigger(['name', 'basePrice', 'capacity']);
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
                message={getApiErrorMessage(mutation.error, 'Could not save cruise')}
              />
            </View>
          ) : null}

          {step === 0 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Cruise Details" />
              <Controller
                control={control}
                name="name"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    label="Name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Mediterranean Bliss"
                    error={errors.name?.message}
                    accessibilityLabel="Cruise name"
                  />
                )}
              />
              <Controller
                control={control}
                name="cruiseLine"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Cruise Line"
                    value={value ?? ''}
                    onChangeText={onChange}
                    placeholder="e.g. Royal Caribbean"
                    accessibilityLabel="Cruise line"
                  />
                )}
              />
              <Controller
                control={control}
                name="departurePort"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Departure Port"
                    value={value ?? ''}
                    onChangeText={onChange}
                    placeholder="e.g. Barcelona"
                    accessibilityLabel="Departure port"
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
                    placeholder="e.g. 7N/8D"
                    accessibilityLabel="Duration"
                  />
                )}
              />
              <Controller
                control={control}
                name="basePrice"
                render={({ field: { value, onChange } }) => (
                  <CurrencyField
                    label="Base Price"
                    value={value}
                    onChangeText={onChange}
                    placeholder="85000"
                    error={errors.basePrice?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="capacity"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Capacity (pax)"
                    value={value ?? ''}
                    onChangeText={onChange}
                    keyboardType="number-pad"
                    placeholder="e.g. 120"
                    error={errors.capacity?.message}
                    accessibilityLabel="Capacity in passengers"
                  />
                )}
              />
            </View>
          )}

          {step === 1 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Media & Inclusions" />
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

              <InclusionAdder onAdd={(value) => inclusions.append({ value })} />

              <View style={{ gap: s.s2 }}>
                {inclusions.fields.map((field, index) => (
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
                      onPress={() => inclusions.remove(index)}
                      accessibilityLabel={`Remove inclusion ${(field as any).value}`}
                    />
                  </View>
                ))}
              </View>

              <Controller
                control={control}
                name="summary"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Summary"
                    value={value ?? ''}
                    onChangeText={onChange}
                    multiline
                    placeholder="Short description"
                    accessibilityLabel="Summary"
                  />
                )}
              />
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Cabins" />
              {cabins.fields.map((field, index) => (
                <Card key={field.id} style={{ gap: s.s3 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>
                      Cabin {index + 1}
                    </Text>
                    <Button
                      variant="icon"
                      icon={X}
                      onPress={() => cabins.remove(index)}
                      accessibilityLabel={`Remove cabin ${index + 1}`}
                    />
                  </View>
                  <Controller
                    control={control}
                    name={`cabinTypes.${index}.name`}
                    render={({ field: { value, onChange } }) => (
                      <Input
                        label="Cabin Type"
                        value={value}
                        onChangeText={onChange}
                        placeholder="e.g. Ocean View"
                        error={errors.cabinTypes?.[index]?.name?.message}
                        accessibilityLabel={`Cabin ${index + 1} type`}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`cabinTypes.${index}.price`}
                    render={({ field: { value, onChange } }) => (
                      <CurrencyField
                        label="Price"
                        value={value}
                        onChangeText={onChange}
                        placeholder="85000"
                        error={errors.cabinTypes?.[index]?.price?.message}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`cabinTypes.${index}.description`}
                    render={({ field: { value, onChange } }) => (
                      <Input
                        label="Description"
                        value={value ?? ''}
                        onChangeText={onChange}
                        multiline
                        accessibilityLabel={`Cabin ${index + 1} description`}
                      />
                    )}
                  />
                </Card>
              ))}
              <Button
                variant="secondary"
                icon={Plus}
                label="Add Cabin Type"
                onPress={() => cabins.append({ name: '', price: '', description: '' })}
                accessibilityLabel="Add cabin type"
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
          label={step === STEP_COUNT - 1 ? (isEdit ? 'Save Cruise' : 'Create Cruise') : 'Next'}
          fullWidth
          loading={mutation.isPending}
          onPress={handleNext}
          accessibilityLabel={step === STEP_COUNT - 1 ? 'Save cruise' : 'Next step'}
        />
      </View>
    </SafeAreaView>
  );
}

function InclusionAdder({ onAdd }: { onAdd: (value: string) => void }) {
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
        label="Add inclusion"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={add}
        returnKeyType="done"
        placeholder="e.g. All meals"
        accessibilityLabel="Inclusion"
      />
      <Button
        variant="secondary"
        icon={Plus}
        label="Add Inclusion"
        onPress={add}
        accessibilityLabel="Add inclusion to list"
      />
    </View>
  );
}
