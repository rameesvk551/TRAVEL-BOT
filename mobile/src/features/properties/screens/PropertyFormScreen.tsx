// FILE: mobile/src/features/properties/screens/PropertyFormScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useProperty,
  useCreateProperty,
  useUpdateProperty,
  useUploadPropertyImage,
  rupeesToPaise,
  paiseToRupees,
  getApiErrorMessage,
  PROPERTY_TYPES,
} from '../api';
import {
  Button,
  Input,
  CurrencyField,
  Segmented,
  SectionHeader,
  ProgressBar,
  Switch,
  Chip,
  Banner,
  Skeleton,
  showToast,
} from '../../../ui';
import { ArrowLeft, Plus, X, ImageIcon } from 'lucide-react-native';

// Mirrors backend/src/routes/properties.ts propertySchema.
const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  propertyType: z.string().trim().min(1, 'Pick a property type').max(50),
  location: z.string().trim().max(255).optional(),
  address: z.string().trim().max(2000).optional(),
  description: z.string().trim().max(2000).optional(),
  pricePerNight: z
    .string()
    .trim()
    .refine((v) => v === '' || Number(v) >= 0, 'Price cannot be negative'),
  amenities: z.array(z.object({ value: z.string().trim().min(1) })),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const SUGGESTED_AMENITIES = ['Pool', 'WiFi', 'Kitchen', 'AC', 'Heater', 'Parking', 'Breakfast'];
const STEP_COUNT = 4;

export function PropertyFormScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const propertyId: string | undefined = route?.params?.propertyId;
  const isEdit = Boolean(propertyId);
  const [step, setStep] = useState(0);

  const { data: existing, isLoading } = useProperty(propertyId);
  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty(propertyId ?? '');
  const uploadImage = useUploadPropertyImage();
  const mutation = isEdit ? updateProperty : createProperty;

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
      propertyType: 'Hotel',
      location: '',
      address: '',
      description: '',
      pricePerNight: '',
      amenities: [],
      imageUrl: null,
      isActive: true,
    },
  });

  const amenities = useFieldArray({ control, name: 'amenities' });
  const imageUrl = watch('imageUrl');
  const amenityValues = amenities.fields.map((f) => (f as any).value as string);

  useEffect(() => {
    if (!existing) return;
    reset({
      name: existing.name,
      propertyType: existing.propertyType || 'Hotel',
      location: existing.location ?? '',
      address: existing.address ?? '',
      description: existing.description ?? '',
      pricePerNight:
        existing.pricePerNight != null ? String(paiseToRupees(existing.pricePerNight)) : '',
      amenities: (existing.amenities ?? []).map((value) => ({ value })),
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

  const toggleAmenity = (value: string) => {
    const index = amenityValues.indexOf(value);
    if (index >= 0) amenities.remove(index);
    else amenities.append({ value });
  };

  const onSubmit = (values: FormValues) => {
    const payload = {
      name: values.name,
      propertyType: values.propertyType,
      location: values.location || null,
      address: values.address || null,
      description: values.description || null,
      pricePerNight: rupeesToPaise(values.pricePerNight),
      amenities: values.amenities.map((a) => a.value),
      imageUrl: values.imageUrl,
      isActive: values.isActive,
    };

    mutation.mutate(payload as any, {
      onSuccess: () => {
        showToast(isEdit ? 'Property updated' : 'Property created', 'success');
        navigation.goBack();
      },
    });
  };

  const handleNext = async () => {
    if (step === 0) {
      const ok = await trigger(['name', 'propertyType', 'pricePerNight']);
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
                message={getApiErrorMessage(mutation.error, 'Could not save property')}
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
                    label="Name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Sunset Villa"
                    error={errors.name?.message}
                    accessibilityLabel="Property name"
                  />
                )}
              />
              <Controller
                control={control}
                name="propertyType"
                render={({ field: { value, onChange } }) => (
                  <View>
                    <Text
                      style={[
                        theme.typography.footnote,
                        { color: theme.colors.text.secondary, marginBottom: s.s2 },
                      ]}
                    >
                      Type
                    </Text>
                    <Segmented
                      segments={PROPERTY_TYPES as unknown as string[]}
                      selectedIndex={Math.max(0, PROPERTY_TYPES.indexOf(value as any))}
                      onChange={(i) => onChange(PROPERTY_TYPES[i])}
                    />
                    {errors.propertyType?.message ? (
                      <Text
                        style={[
                          theme.typography.caption,
                          { color: theme.colors.status.danger, marginTop: s.s1 },
                        ]}
                      >
                        {errors.propertyType.message}
                      </Text>
                    ) : null}
                  </View>
                )}
              />
              <Controller
                control={control}
                name="pricePerNight"
                render={({ field: { value, onChange } }) => (
                  <CurrencyField
                    label="Price per night"
                    value={value}
                    onChangeText={onChange}
                    placeholder="12000"
                    error={errors.pricePerNight?.message}
                  />
                )}
              />
            </View>
          )}

          {step === 1 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Address & Description" />
              <Controller
                control={control}
                name="location"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Location"
                    value={value ?? ''}
                    onChangeText={onChange}
                    placeholder="e.g. Goa"
                    error={errors.location?.message}
                    accessibilityLabel="Location"
                  />
                )}
              />
              <Controller
                control={control}
                name="address"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Full Address"
                    value={value ?? ''}
                    onChangeText={onChange}
                    multiline
                    placeholder="123 Beach Road..."
                    error={errors.address?.message}
                    accessibilityLabel="Full address"
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
                    placeholder="A beautiful villa..."
                    error={errors.description?.message}
                    accessibilityLabel="Description"
                  />
                )}
              />
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Amenities" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2 }}>
                {SUGGESTED_AMENITIES.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={amenityValues.includes(item)}
                    onPress={() => toggleAmenity(item)}
                  />
                ))}
              </View>

              <CustomAmenityAdder
                onAdd={(value) => {
                  if (!amenityValues.includes(value)) amenities.append({ value });
                }}
              />

              <View style={{ gap: s.s2 }}>
                {amenityValues
                  .filter((a) => !SUGGESTED_AMENITIES.includes(a))
                  .map((item) => (
                    <View
                      key={item}
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
                        {item}
                      </Text>
                      <Button
                        variant="icon"
                        icon={X}
                        onPress={() => toggleAmenity(item)}
                        accessibilityLabel={`Remove ${item}`}
                      />
                    </View>
                  ))}
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Media & Settings" />
              <View
                style={{
                  height: 180,
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
                  <Switch label="Active Listing" value={value} onValueChange={onChange} />
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
          label={step === STEP_COUNT - 1 ? (isEdit ? 'Save Property' : 'Create Property') : 'Next'}
          fullWidth
          loading={mutation.isPending}
          onPress={handleNext}
          accessibilityLabel={step === STEP_COUNT - 1 ? 'Save property' : 'Next step'}
        />
      </View>
    </SafeAreaView>
  );
}

function CustomAmenityAdder({ onAdd }: { onAdd: (value: string) => void }) {
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
    <View style={{ gap: s.s2, marginTop: s.s4 }}>
      <Input
        label="Add Custom Amenity"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={add}
        returnKeyType="done"
        placeholder="e.g. Sea view"
        accessibilityLabel="Custom amenity"
      />
      <Button
        variant="secondary"
        icon={Plus}
        label="Add"
        onPress={add}
        accessibilityLabel="Add custom amenity"
      />
    </View>
  );
}
