// FILE: mobile/src/features/bookings/screens/BookingFormScreen.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useCreateBooking,
  useCustomerOptions,
  useCatalogOptions,
  apiErrorMessage,
  BookingItemType,
  CreateBookingInput,
} from '../api';
import {
  Button,
  ProgressBar,
  Input,
  Segmented,
  SectionHeader,
  Stepper,
  CurrencyField,
  Chip,
  Card,
  Skeleton,
  ErrorState,
  Banner,
  ListRow,
  Badge,
} from '../../../ui';
import { showToast } from '../../../ui/Toast';
import { formatCurrency } from '../../../lib/formatters';
import { ArrowLeft, ChevronLeft, Check } from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ITEM_TYPES: BookingItemType[] = ['PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE', 'CUSTOM'];

/** CurrencyField hands back a grouped string ("1,50,000"). Reduce it to whole rupees. */
function parseRupees(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/** Rupees → paise. Integer maths only: the API stores paise as an INTEGER column. */
function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

const schema = z
  .object({
    customerMode: z.enum(['existing', 'new']),
    customerId: z.string().optional(),
    newCustomerName: z.string().optional(),
    newCustomerPhone: z.string().optional(),
    newCustomerEmail: z.string().optional(),

    itemType: z.enum(['PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE', 'CUSTOM']),
    itemId: z.string().optional(),
    customItemName: z.string().optional(),

    travellers: z.number().int().min(1).max(50),
    basePrice: z.string().optional(),

    settlementType: z.enum(['FULL_COLLECTION', 'COMMISSION_ONLY']),
    commissionAmount: z.string().optional(),
    paymentMode: z.enum(['FULL', 'ADVANCE', 'NO_PAYMENT']),
    advanceAmount: z.string().optional(),

    travelDate: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.customerMode === 'existing') {
      if (!v.customerId) {
        ctx.addIssue({ code: 'custom', path: ['customerId'], message: 'Select a customer' });
      }
    } else {
      if (!v.newCustomerName || v.newCustomerName.trim().length < 2) {
        ctx.addIssue({ code: 'custom', path: ['newCustomerName'], message: 'Enter the full name' });
      }
      if (!v.newCustomerPhone || v.newCustomerPhone.replace(/\D/g, '').length < 8) {
        ctx.addIssue({ code: 'custom', path: ['newCustomerPhone'], message: 'Enter a valid phone number' });
      }
      if (v.newCustomerEmail && v.newCustomerEmail.trim() && !/^\S+@\S+\.\S+$/.test(v.newCustomerEmail)) {
        ctx.addIssue({ code: 'custom', path: ['newCustomerEmail'], message: 'Enter a valid email' });
      }
    }

    if (v.itemType === 'CUSTOM') {
      if (!v.customItemName || !v.customItemName.trim()) {
        ctx.addIssue({ code: 'custom', path: ['customItemName'], message: 'Name the item you are booking' });
      }
    } else if (!v.itemId) {
      ctx.addIssue({ code: 'custom', path: ['itemId'], message: 'Select an item' });
    }

    const base = parseRupees(v.basePrice);
    if (base <= 0) {
      ctx.addIssue({ code: 'custom', path: ['basePrice'], message: 'Enter a price above zero' });
    }

    const total = base * v.travellers;

    // COMMISSION_ONLY: the agency books only its own cut. The commission is the agency's
    // whole revenue and must be a slice of the package value — never more than it.
    if (v.settlementType === 'COMMISSION_ONLY') {
      const commission = parseRupees(v.commissionAmount);
      if (commission <= 0) {
        ctx.addIssue({ code: 'custom', path: ['commissionAmount'], message: 'Enter your commission' });
      } else if (total > 0 && commission > total) {
        ctx.addIssue({
          code: 'custom',
          path: ['commissionAmount'],
          message: 'Commission cannot exceed the package value',
        });
      }
    } else if (v.paymentMode === 'ADVANCE') {
      const advance = parseRupees(v.advanceAmount);
      if (advance <= 0) {
        ctx.addIssue({ code: 'custom', path: ['advanceAmount'], message: 'Enter the advance collected' });
      } else if (total > 0 && advance > total) {
        ctx.addIssue({
          code: 'custom',
          path: ['advanceAmount'],
          message: 'Advance cannot exceed the total',
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

const STEP_FIELDS: Record<number, Array<keyof FormValues>> = {
  1: ['customerId', 'newCustomerName', 'newCustomerPhone', 'newCustomerEmail'],
  2: ['itemId', 'customItemName'],
  3: ['basePrice', 'commissionAmount', 'advanceAmount'],
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function BookingFormScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [step, setStep] = React.useState(1);
  const totalSteps = 3;
  const s = theme.spacing;

  const { mutate: createBooking, isPending } = useCreateBooking();

  const { control, handleSubmit, trigger, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      customerMode: 'existing',
      itemType: 'PACKAGE',
      travellers: 2,
      basePrice: '',
      settlementType: 'FULL_COLLECTION',
      paymentMode: 'FULL',
      commissionAmount: '',
      advanceAmount: '',
      travelDate: '',
      notes: '',
    },
  });

  const values = useWatch({ control }) as FormValues;
  const customerMode = values.customerMode ?? 'existing';
  const itemType = values.itemType ?? 'PACKAGE';
  const settlementType = values.settlementType ?? 'FULL_COLLECTION';
  const paymentMode = values.paymentMode ?? 'FULL';
  const commissionOnly = settlementType === 'COMMISSION_ONLY';

  const customers = useCustomerOptions();
  const catalog = useCatalogOptions(itemType);

  const baseRupees = parseRupees(values.basePrice);
  const travellers = values.travellers ?? 1;
  const totalRupees = baseRupees * travellers;
  const commissionRupees = parseRupees(values.commissionAmount);
  const balanceAtProperty = commissionOnly ? Math.max(0, totalRupees - commissionRupees) : 0;

  const selectedItemName = useMemo(
    () => catalog.data?.find((o) => o.id === values.itemId)?.name,
    [catalog.data, values.itemId],
  );

  const handleNext = async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (!valid) return;
    if (step < totalSteps) setStep(step + 1);
    else handleSubmit(onSubmit)();
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else navigation.goBack();
  };

  const onSubmit = (v: FormValues) => {
    const base = parseRupees(v.basePrice);
    const total = base * v.travellers;

    const payload: CreateBookingInput = {
      itemType: v.itemType,
      settlementType: v.settlementType,
      // A commission-only booking is settled the moment the agency has its cut, so the
      // FULL/ADVANCE payment mode is meaningless there — the backend derives advancePaid
      // from commissionAmount and confirms the booking outright.
      paymentMode: v.settlementType === 'COMMISSION_ONLY' ? 'FULL' : v.paymentMode,
      basePrice: toPaise(base),
      totalAmount: toPaise(total),
      travellers: v.travellers,
      travelDate: v.travelDate?.trim() || undefined,
      notes: v.notes?.trim() || undefined,
    };

    if (v.customerMode === 'existing') {
      payload.customerId = v.customerId;
    } else {
      payload.newCustomer = {
        name: v.newCustomerName!.trim(),
        phone: v.newCustomerPhone!.trim(),
        email: v.newCustomerEmail?.trim() || undefined,
      };
    }

    if (v.itemType === 'CUSTOM') {
      payload.customItemName = v.customItemName?.trim();
    } else {
      const key = `${v.itemType.toLowerCase()}Id` as
        | 'packageId'
        | 'propertyId'
        | 'cruiseId'
        | 'visaId'
        | 'serviceId';
      payload[key] = v.itemId;
    }

    if (v.settlementType === 'COMMISSION_ONLY') {
      payload.commissionAmount = toPaise(parseRupees(v.commissionAmount));
    } else if (v.paymentMode === 'ADVANCE') {
      payload.advanceAmount = toPaise(parseRupees(v.advanceAmount));
    }

    createBooking(payload, {
      onSuccess: (booking) => {
        showToast(`Booking ${booking.bookingRef} created`, 'success');
        navigation.goBack();
      },
      onError: (err) => showToast(apiErrorMessage(err, 'Could not create the booking'), 'error'),
    });
  };

  // -------------------------------------------------------------------------
  // Option pickers
  // -------------------------------------------------------------------------

  const renderOptionList = (
    options: Array<{ id: string; name: string; price?: number }>,
    selectedId: string | undefined,
    onSelect: (id: string, price?: number) => void,
    emptyMessage: string,
  ) => {
    if (options.length === 0) {
      return (
        <Card style={{ padding: s.s4 }}>
          <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
            {emptyMessage}
          </Text>
        </Card>
      );
    }

    return (
      <Card style={{ overflow: 'hidden' }}>
        {options.map((option, i) => {
          const selected = option.id === selectedId;
          return (
            <React.Fragment key={option.id}>
              {i > 0 && (
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: theme.colors.border.hairline,
                    marginLeft: 16,
                  }}
                />
              )}
              <ListRow
                title={option.name}
                subtitle={option.price ? formatCurrency(option.price) : undefined}
                trailing={selected ? <Check size={20} color={theme.colors.accent} /> : undefined}
                onPress={() => onSelect(option.id, option.price)}
                accessibilityLabel={`${option.name}${selected ? ', selected' : ''}`}
              />
            </React.Fragment>
          );
        })}
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: s.s2,
          paddingTop: s.s2,
          paddingBottom: s.s4,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border.hairline,
        }}
      >
        <Button
          variant="plain"
          icon={step === 1 ? ArrowLeft : ChevronLeft}
          onPress={handleBack}
          accessibilityLabel={step === 1 ? 'Close the booking form' : 'Go to the previous step'}
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
            New Booking
          </Text>
          <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
            Step {step} of {totalSteps}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ProgressBar progress={step / totalSteps} height={2} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: s.s4 }} keyboardShouldPersistTaps="handled">
          {/* ---------------------------------------------------------------- Step 1 */}
          {step === 1 && (
            <View>
              <SectionHeader title="CUSTOMER" />
              <View style={{ marginBottom: s.s6 }}>
                <Controller
                  control={control}
                  name="customerMode"
                  render={({ field }) => (
                    <Segmented
                      segments={['Existing', 'New']}
                      selectedIndex={field.value === 'new' ? 1 : 0}
                      onChange={(i) => field.onChange(i === 1 ? 'new' : 'existing')}
                    />
                  )}
                />
              </View>

              {customerMode === 'existing' ? (
                customers.isLoading ? (
                  <View style={{ gap: s.s3 }}>
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} height={56} />
                    ))}
                  </View>
                ) : customers.isError ? (
                  <ErrorState
                    message={apiErrorMessage(customers.error, 'Could not load customers')}
                    onRetry={customers.refetch}
                  />
                ) : (
                  <Controller
                    control={control}
                    name="customerId"
                    render={({ field, fieldState }) => (
                      <View>
                        {renderOptionList(
                          customers.data ?? [],
                          field.value,
                          (id) => field.onChange(id),
                          'No customers yet. Switch to "New" to add one.',
                        )}
                        {fieldState.error && (
                          <Text
                            style={[
                              theme.typography.caption,
                              { color: theme.colors.status.danger, marginTop: s.s1 },
                            ]}
                          >
                            {fieldState.error.message}
                          </Text>
                        )}
                      </View>
                    )}
                  />
                )
              ) : (
                <View>
                  <Controller
                    control={control}
                    name="newCustomerName"
                    render={({ field, fieldState }) => (
                      <Input
                        label="Name"
                        placeholder="Full name"
                        value={field.value}
                        onChangeText={field.onChange}
                        error={fieldState.error?.message}
                        accessibilityLabel="Customer name"
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="newCustomerPhone"
                    render={({ field, fieldState }) => (
                      <Input
                        label="Phone"
                        placeholder="+91"
                        keyboardType="phone-pad"
                        value={field.value}
                        onChangeText={field.onChange}
                        error={fieldState.error?.message}
                        accessibilityLabel="Customer phone number"
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="newCustomerEmail"
                    render={({ field, fieldState }) => (
                      <Input
                        label="Email (optional)"
                        placeholder="email@example.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={field.value}
                        onChangeText={field.onChange}
                        error={fieldState.error?.message}
                        accessibilityLabel="Customer email"
                      />
                    )}
                  />
                </View>
              )}
            </View>
          )}

          {/* ---------------------------------------------------------------- Step 2 */}
          {step === 2 && (
            <View>
              <SectionHeader title="WHAT ARE THEY BOOKING?" />
              <Controller
                control={control}
                name="itemType"
                render={({ field }) => (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: s.s2,
                      marginBottom: s.s6,
                    }}
                  >
                    {ITEM_TYPES.map((type) => (
                      <Chip
                        key={type}
                        label={type.charAt(0) + type.slice(1).toLowerCase()}
                        selected={field.value === type}
                        onPress={() => {
                          field.onChange(type);
                          // The previous selection belongs to a different catalog.
                          setValue('itemId', undefined);
                          setValue('customItemName', '');
                        }}
                      />
                    ))}
                  </View>
                )}
              />

              {itemType === 'CUSTOM' ? (
                <Controller
                  control={control}
                  name="customItemName"
                  render={({ field, fieldState }) => (
                    <Input
                      label="Item name"
                      placeholder="e.g. Chartered houseboat"
                      value={field.value}
                      onChangeText={field.onChange}
                      error={fieldState.error?.message}
                      accessibilityLabel="Custom item name"
                    />
                  )}
                />
              ) : catalog.isLoading ? (
                <View style={{ gap: s.s3 }}>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} height={56} />
                  ))}
                </View>
              ) : catalog.isError ? (
                <ErrorState
                  message={apiErrorMessage(catalog.error, 'Could not load the catalog')}
                  onRetry={catalog.refetch}
                />
              ) : (
                <Controller
                  control={control}
                  name="itemId"
                  render={({ field, fieldState }) => (
                    <View>
                      {renderOptionList(
                        catalog.data ?? [],
                        field.value,
                        (id, price) => {
                          field.onChange(id);
                          // Prefill the base price from the catalog (paise → rupees).
                          if (price) setValue('basePrice', String(Math.round(price / 100)));
                        },
                        'Nothing in this catalog yet.',
                      )}
                      {fieldState.error && (
                        <Text
                          style={[
                            theme.typography.caption,
                            { color: theme.colors.status.danger, marginTop: s.s1 },
                          ]}
                        >
                          {fieldState.error.message}
                        </Text>
                      )}
                    </View>
                  )}
                />
              )}

              {selectedItemName && itemType !== 'CUSTOM' ? (
                <View style={{ marginTop: s.s4 }}>
                  <Badge variant="success" label={`Selected: ${selectedItemName}`} />
                </View>
              ) : null}
            </View>
          )}

          {/* ---------------------------------------------------------------- Step 3 */}
          {step === 3 && (
            <View>
              <SectionHeader title="PRICING" />
              <View style={{ marginBottom: s.s4 }}>
                <Controller
                  control={control}
                  name="travellers"
                  render={({ field }) => (
                    <Stepper
                      label="Travellers"
                      value={field.value}
                      onChange={field.onChange}
                      min={1}
                      max={50}
                    />
                  )}
                />
              </View>

              <Controller
                control={control}
                name="basePrice"
                render={({ field, fieldState }) => (
                  <CurrencyField
                    label="Base price (per traveller)"
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                    placeholder="0"
                  />
                )}
              />

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginVertical: s.s4,
                  padding: s.s4,
                  backgroundColor: theme.colors.bg.surfaceRaised,
                  borderRadius: theme.radius.md,
                }}
              >
                <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
                  Package value
                </Text>
                <Text style={[theme.typography.title2, { color: theme.colors.text.primary }]}>
                  {formatCurrency(toPaise(totalRupees))}
                </Text>
              </View>

              <SectionHeader title="SETTLEMENT" />
              <View style={{ marginBottom: s.s4 }}>
                <Controller
                  control={control}
                  name="settlementType"
                  render={({ field }) => (
                    <Segmented
                      segments={['Agency collects', 'Commission only']}
                      selectedIndex={field.value === 'COMMISSION_ONLY' ? 1 : 0}
                      onChange={(i) =>
                        field.onChange(i === 1 ? 'COMMISSION_ONLY' : 'FULL_COLLECTION')
                      }
                    />
                  )}
                />
              </View>

              {commissionOnly ? (
                <>
                  <Banner
                    visible
                    variant="info"
                    message="You book only your commission. The customer pays the rest directly at the property — it never hits your books, but it does print on the invoice."
                  />
                  <View style={{ marginTop: s.s3 }}>
                    <Controller
                      control={control}
                      name="commissionAmount"
                      render={({ field, fieldState }) => (
                        <CurrencyField
                          label="Your commission"
                          value={field.value ?? ''}
                          onChangeText={field.onChange}
                          error={fieldState.error?.message}
                          placeholder="0"
                        />
                      )}
                    />
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      padding: s.s4,
                      marginBottom: s.s4,
                      backgroundColor: theme.colors.bg.surface,
                      borderRadius: theme.radius.md,
                    }}
                  >
                    <Text
                      style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}
                    >
                      Customer pays at property
                    </Text>
                    <Text style={[theme.typography.subhead, { color: theme.colors.text.primary }]}>
                      {formatCurrency(toPaise(balanceAtProperty))}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <SectionHeader title="PAYMENT" />
                  <View style={{ marginBottom: s.s4 }}>
                    <Controller
                      control={control}
                      name="paymentMode"
                      render={({ field }) => (
                        <Segmented
                          segments={['Full', 'Advance', 'None']}
                          selectedIndex={
                            field.value === 'ADVANCE' ? 1 : field.value === 'NO_PAYMENT' ? 2 : 0
                          }
                          onChange={(i) =>
                            field.onChange(
                              i === 1 ? 'ADVANCE' : i === 2 ? 'NO_PAYMENT' : 'FULL',
                            )
                          }
                        />
                      )}
                    />
                  </View>

                  {paymentMode === 'ADVANCE' && (
                    <Controller
                      control={control}
                      name="advanceAmount"
                      render={({ field, fieldState }) => (
                        <CurrencyField
                          label="Advance collected"
                          value={field.value ?? ''}
                          onChangeText={field.onChange}
                          error={fieldState.error?.message}
                          placeholder="0"
                        />
                      )}
                    />
                  )}
                </>
              )}

              <SectionHeader title="TRIP" />
              <Controller
                control={control}
                name="travelDate"
                render={({ field, fieldState }) => (
                  <Input
                    label="Travel date (optional)"
                    placeholder="YYYY-MM-DD"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                    accessibilityLabel="Travel date"
                  />
                )}
              />
              <Controller
                control={control}
                name="notes"
                render={({ field }) => (
                  <Input
                    label="Notes (optional)"
                    placeholder="Any special requests..."
                    multiline
                    value={field.value}
                    onChangeText={field.onChange}
                    accessibilityLabel="Booking notes"
                  />
                )}
              />
            </View>
          )}
        </ScrollView>

        <View
          style={{
            padding: s.s4,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.border.hairline,
            backgroundColor: theme.colors.bg.surface,
          }}
        >
          <Button
            variant="primary"
            label={step === totalSteps ? 'Save booking' : 'Next'}
            fullWidth
            onPress={handleNext}
            loading={isPending}
            accessibilityLabel={step === totalSteps ? 'Save the booking' : 'Go to the next step'}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
