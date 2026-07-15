// FILE: mobile/src/features/services/screens/ServiceFormScreen.tsx
// Create / edit an add-on service. Every control on this screen writes into the
// real POST /services | PATCH /services/:id payload — see ../api.ts for the zod
// schema the backend enforces:
//   • name is required (min 2)
//   • category and pricingType are ENUMS — free text is rejected with a 400,
//     which is why they are pickers here and not the mock's text inputs
//   • icon is an icon IDENTIFIER ('plane', 'shield', …), not an emoji: the list
//     screen maps it through ICON_MAP, so an emoji would render as no icon
//   • basePrice is an integer in PAISE (captured in rupees, converted on submit)
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useService,
  useCreateService,
  useUpdateService,
  useUploadServiceImage,
  rupeesToPaise,
  paiseToRupees,
  getApiErrorMessage,
  SERVICE_CATEGORIES,
  SERVICE_ICON_KEYS,
  PRICING_TYPES,
  PRICING_TYPE_LABELS,
  type ServiceCategory,
  type ServiceIconKey,
  type ServiceInput,
} from '../api';
import {
  Button,
  Input,
  CurrencyField,
  Segmented,
  SectionHeader,
  Switch,
  Banner,
  Skeleton,
  ErrorState,
  showToast,
} from '../../../ui';
import {
  ArrowLeft,
  Plus,
  X,
  Plane,
  TrainFront,
  FileText,
  Globe,
  Shield,
  Car,
  Hotel,
  Stamp,
  Files,
  Settings,
  ImageIcon,
  type LucideIcon,
} from 'lucide-react-native';

// Same identifier -> glyph mapping the list screen uses. Kept in step with
// SERVICE_ICON_KEYS in ../api.ts, which is the vocabulary the backend stores.
const ICON_MAP: Record<ServiceIconKey, LucideIcon> = {
  plane: Plane,
  train: TrainFront,
  document: FileText,
  globe: Globe,
  shield: Shield,
  car: Car,
  hotel: Hotel,
  stamp: Stamp,
  file: Files,
  default: Settings,
};

const ICON_LABELS: Record<ServiceIconKey, string> = {
  plane: 'Flight',
  train: 'Train',
  document: 'Document',
  globe: 'Globe',
  shield: 'Insurance',
  car: 'Transfer',
  hotel: 'Hotel',
  stamp: 'Visa stamp',
  file: 'Files',
  default: 'Generic',
};

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  TICKETING: 'Ticketing',
  DOCUMENTATION: 'Documentation',
  VISA: 'Visa',
  INSURANCE: 'Insurance',
  OTHER: 'Other',
};

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(255, 'Name is too long'),
  // Nullable because the backend column is nullable — "None" is a real choice.
  category: z.enum(SERVICE_CATEGORIES).nullable(),
  icon: z.enum(SERVICE_ICON_KEYS),
  description: z.string().trim().max(5000, 'Description is too long'),
  pricingType: z.enum(PRICING_TYPES),
  // Rupees as typed; '' means "no price" -> basePrice: null -> "On request".
  basePrice: z
    .string()
    .trim()
    .refine((v) => v === '' || (rupeesToPaise(v) ?? 0) > 0, 'Price must be greater than 0'),
  features: z.array(z.object({ value: z.string().trim().min(1) })),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function ServiceFormScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const s = theme.spacing;

  const serviceId: string | undefined = route?.params?.serviceId;
  const isEdit = Boolean(serviceId);

  const { data: existing, isLoading, isError, error, refetch } = useService(serviceId);
  const createService = useCreateService();
  const updateService = useUpdateService(serviceId ?? '');
  const uploadImage = useUploadServiceImage();
  const isSaving = createService.isPending || updateService.isPending;

  // The server's own message, kept visible until the next submit.
  const [serverError, setServerError] = useState<string | null>(null);
  const [featureDraft, setFeatureDraft] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      category: null,
      icon: 'default',
      description: '',
      pricingType: 'FIXED',
      basePrice: '',
      features: [],
      imageUrl: null,
      isActive: true,
    },
  });

  const features = useFieldArray({ control, name: 'features' });
  const imageUrl = watch('imageUrl');

  // Hydrate once the service loads.
  useEffect(() => {
    if (!existing) return;
    const icon = (SERVICE_ICON_KEYS as readonly string[]).includes(existing.icon ?? '')
      ? (existing.icon as ServiceIconKey)
      : 'default';
    reset({
      name: existing.name,
      category: existing.category ?? null,
      icon,
      description: existing.description ?? '',
      pricingType: existing.pricingType ?? 'FIXED',
      basePrice: existing.basePrice != null ? String(paiseToRupees(existing.basePrice)) : '',
      features: (existing.features ?? []).map((value) => ({ value })),
      imageUrl: existing.imageUrl,
      isActive: existing.isActive,
    });
  }, [existing, reset]);

  const addFeature = () => {
    const value = featureDraft.trim();
    if (!value) {
      showToast('Type a feature first', 'error');
      return;
    }
    features.append({ value });
    setFeatureDraft('');
  };

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

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const payload: ServiceInput = {
      name: values.name,
      category: values.category,
      description: values.description || null,
      icon: values.icon,
      basePrice: rupeesToPaise(values.basePrice),
      imageUrl: values.imageUrl,
      pricingType: values.pricingType,
      features: values.features.map((f) => f.value),
      isActive: values.isActive,
    };

    try {
      if (isEdit) await updateService.mutateAsync(payload);
      else await createService.mutateAsync(payload);
      showToast(isEdit ? 'Service updated' : 'Service created', 'success');
      navigation.goBack();
    } catch (err) {
      // A failed save must never look like a successful one: stay on the form,
      // show what the server actually said.
      const message = getApiErrorMessage(err, 'Could not save service');
      setServerError(message);
      showToast(message, 'error');
    }
  };

  const onInvalid = () => showToast('Fix the highlighted fields', 'error');

  if (isEdit && isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ padding: s.s4, gap: s.s4 }}>
          <Skeleton height={40} />
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={120} />
        </View>
      </SafeAreaView>
    );
  }

  if (isEdit && isError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
          <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} accessibilityLabel="Close" />
        </View>
        <ErrorState
          title="Couldn't load this service"
          message={getApiErrorMessage(error)}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} accessibilityLabel="Close" />
        <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>
          {isEdit ? 'Edit Service' : 'New Service'}
        </Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          {serverError ? (
            <View style={{ marginBottom: s.s4 }}>
              <Banner visible variant="error" message={serverError} onDismiss={() => setServerError(null)} />
            </View>
          ) : null}

          <View style={{ gap: s.s4 }}>
            <SectionHeader title="Details" />

            <Controller
              control={control}
              name="name"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
                  label="Name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="e.g. Travel Insurance"
                  error={errors.name?.message}
                  accessibilityLabel="Service name"
                />
              )}
            />

            <Controller
              control={control}
              name="category"
              render={({ field: { value, onChange } }) => (
                <View>
                  <Text
                    style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: s.s2 }]}
                  >
                    Category
                  </Text>
                  <View
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Service category"
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2 }}
                  >
                    <OptionChip label="None" selected={value === null} onPress={() => onChange(null)} />
                    {SERVICE_CATEGORIES.map((c) => (
                      <OptionChip
                        key={c}
                        label={CATEGORY_LABELS[c]}
                        selected={value === c}
                        onPress={() => onChange(c)}
                      />
                    ))}
                  </View>
                </View>
              )}
            />

            <Controller
              control={control}
              name="icon"
              render={({ field: { value, onChange } }) => (
                <View>
                  <Text
                    style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: s.s2 }]}
                  >
                    Icon
                  </Text>
                  <View
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Service icon"
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2 }}
                  >
                    {SERVICE_ICON_KEYS.map((key) => (
                      <OptionChip
                        key={key}
                        label={ICON_LABELS[key]}
                        icon={ICON_MAP[key]}
                        selected={value === key}
                        onPress={() => onChange(key)}
                      />
                    ))}
                  </View>
                </View>
              )}
            />

            <Controller
              control={control}
              name="description"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
                  label="Description"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  multiline
                  placeholder="What the customer gets"
                  error={errors.description?.message}
                  accessibilityLabel="Service description"
                />
              )}
            />

            <SectionHeader title="Pricing" />

            <Controller
              control={control}
              name="pricingType"
              render={({ field: { value, onChange } }) => (
                <View>
                  <Text
                    style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: s.s2 }]}
                  >
                    Pricing Type
                  </Text>
                  <Segmented
                    segments={PRICING_TYPES.map((p) => PRICING_TYPE_LABELS[p])}
                    selectedIndex={PRICING_TYPES.indexOf(value)}
                    onChange={(i) => onChange(PRICING_TYPES[i])}
                  />
                </View>
              )}
            />

            <Controller
              control={control}
              name="basePrice"
              render={({ field: { value, onChange } }) => (
                <CurrencyField
                  label="Price (leave empty for 'On request')"
                  value={value}
                  onChangeText={onChange}
                  placeholder="1500"
                  error={errors.basePrice?.message}
                />
              )}
            />

            <SectionHeader title="Features" />

            <Input
              label="Add Feature"
              value={featureDraft}
              onChangeText={setFeatureDraft}
              placeholder="e.g. Medical Cover"
              onSubmitEditing={addFeature}
              returnKeyType="done"
              accessibilityLabel="New feature"
            />
            <Button
              variant="secondary"
              icon={Plus}
              label="Add"
              onPress={addFeature}
              accessibilityLabel="Add feature to list"
            />

            <View style={{ gap: s.s2 }}>
              {features.fields.length === 0 ? (
                <Text style={[theme.typography.subhead, { color: theme.colors.text.tertiary }]}>
                  No features yet. They appear on the service card.
                </Text>
              ) : (
                features.fields.map((field, index) => (
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
                    <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>
                      {(field as unknown as { value: string }).value}
                    </Text>
                    <Button
                      variant="icon"
                      icon={X}
                      onPress={() => features.remove(index)}
                      accessibilityLabel={`Remove feature ${(field as unknown as { value: string }).value}`}
                    />
                  </View>
                ))
              )}
            </View>

            <SectionHeader title="Image" />
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
              label={imageUrl ? 'Replace Image' : 'Upload Image'}
              loading={uploadImage.isPending}
              onPress={pickImage}
              accessibilityLabel={imageUrl ? 'Replace image' : 'Upload image'}
            />
            {imageUrl ? (
              <Button
                variant="plain"
                label="Remove image"
                onPress={() => setValue('imageUrl', null, { shouldDirty: true })}
                accessibilityLabel="Remove image"
              />
            ) : null}

            <SectionHeader title="Settings" />
            <Controller
              control={control}
              name="isActive"
              render={({ field: { value, onChange } }) => (
                <Switch label="Active" value={value} onValueChange={onChange} />
              )}
            />
          </View>
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
          label={isEdit ? 'Save Service' : 'Create Service'}
          fullWidth
          loading={isSaving}
          onPress={handleSubmit(onSubmit, onInvalid)}
          accessibilityLabel={isEdit ? 'Save service' : 'Create service'}
        />
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Local radio chip. The shared <Chip> takes no accessibility props, and a
// picker option must announce its role and selected state.
// ---------------------------------------------------------------------------

function OptionChip({
  label,
  selected,
  onPress,
  icon: Icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: LucideIcon;
}) {
  const { theme } = useTheme();
  const color = selected ? theme.colors.accent : theme.colors.text.secondary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.s1,
        backgroundColor: selected ? theme.colors.accentTint : theme.colors.bg.fill,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: selected ? theme.colors.accent : 'transparent',
        paddingHorizontal: theme.spacing.s3,
        paddingVertical: theme.spacing.s2,
      }}
    >
      {Icon ? <Icon color={color} size={16} /> : null}
      <Text style={[theme.typography.subhead, { color }]}>{label}</Text>
    </Pressable>
  );
}
