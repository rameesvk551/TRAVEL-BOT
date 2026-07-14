// FILE: mobile/src/features/quotations/screens/QuotationFormScreen.tsx
//
// MONEY: quotation line items are WHOLE RUPEES (see api.ts) — not paise like bookings.
// Totals are summed as integers and only scaled to paise at the moment of display.
//
// There is no PDF preview tab: rendering the server's Handlebars PDF needs a WebView, and
// no WebView/file-system dependency is installed. The second tab reviews the real payload
// instead of faking a document.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useQuotation,
  useCreateQuotation,
  useUpdateQuotation,
  useSendQuotationWhatsApp,
  useQuotationTemplates,
  formatRupees,
  toNumber,
  apiErrorMessage,
  QuotationItem,
} from '../api';
import { useCustomerOptions } from '../../bookings/api';
import {
  Button,
  Input,
  CurrencyField,
  Segmented,
  SectionHeader,
  ListRow,
  Card,
  Stepper,
  Skeleton,
  ErrorState,
  Badge,
} from '../../../ui';
import { showToast } from '../../../ui/Toast';
import { ArrowLeft, MessageCircle, Check, Trash2, Plus } from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** CurrencyField yields a grouped string ("45,000"). Reduce it to whole rupees. */
function parseRupees(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

const schema = z.object({
  customerId: z.string().min(1, 'Select a customer'),
  templateId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD'),
  amountInWords: z.string().optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1, 'Name this line item'),
        quantity: z.number().int().min(1),
        price: z.string().refine((v) => parseRupees(v) > 0, 'Enter a price above zero'),
      }),
    )
    .min(1, 'Add at least one line item'),
});

type FormValues = z.infer<typeof schema>;

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function QuotationFormScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const s = theme.spacing;

  const quotationId: string | undefined = route?.params?.quotationId;
  const isEdit = !!quotationId;

  const [tab, setTab] = useState(0); // 0: Builder, 1: Review

  const existing = useQuotation(quotationId ?? null);
  const customers = useCustomerOptions();
  const templates = useQuotationTemplates();

  const { mutateAsync: createQuotation, isPending: isCreating } = useCreateQuotation();
  const { mutateAsync: updateQuotation, isPending: isUpdating } = useUpdateQuotation();
  const { mutateAsync: sendWhatsApp, isPending: isSending } = useSendQuotationWhatsApp();

  const { control, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      customerId: '',
      templateId: undefined,
      date: today(),
      amountInWords: '',
      items: [{ name: '', quantity: 1, price: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // Hydrate the form once the existing quotation lands.
  useEffect(() => {
    const q = existing.data;
    if (!q) return;
    reset({
      customerId: q.customer?.id ?? '',
      templateId: q.template?.id,
      date: (q.date || today()).slice(0, 10),
      amountInWords: q.amountInWords ?? '',
      items:
        q.items?.length > 0
          ? q.items.map((it) => ({
              name: it.name ?? '',
              quantity: Number(it.quantity) || 1,
              price: String(toNumber(it.price)),
            }))
          : [{ name: '', quantity: 1, price: '' }],
    });
  }, [existing.data, reset]);

  const values = useWatch({ control }) as FormValues;

  // Line totals in whole rupees — integer maths, no float display drift.
  const lineTotals = useMemo(
    () => (values.items ?? []).map((it) => parseRupees(it?.price) * (Number(it?.quantity) || 0)),
    [values.items],
  );
  const total = useMemo(() => lineTotals.reduce((sum, n) => sum + n, 0), [lineTotals]);

  const isBusy = isCreating || isUpdating || isSending;

  const buildItems = (v: FormValues): QuotationItem[] =>
    v.items.map((it) => {
      const price = parseRupees(it.price);
      const quantity = Number(it.quantity) || 1;
      return {
        name: it.name.trim(),
        quantity,
        price,
        amount: price * quantity,
      };
    });

  const save = async (v: FormValues, send: boolean) => {
    const items = buildItems(v);
    const sum = items.reduce((acc, it) => acc + it.amount, 0);

    const payload = {
      customerId: v.customerId,
      templateId: v.templateId,
      date: v.date,
      items,
      subTotal: sum,
      totalAmount: sum,
      amountInWords: v.amountInWords?.trim() || undefined,
    };

    try {
      const saved = isEdit
        ? await updateQuotation({ id: quotationId!, ...payload })
        : await createQuotation(payload);

      if (send) {
        // The backend renders the PDF, sends it, and flips a DRAFT to SENT.
        await sendWhatsApp({ id: saved.id });
        showToast('Quotation sent on WhatsApp', 'success');
      } else {
        showToast(isEdit ? 'Quotation updated' : `Quotation ${saved.quotationNumber} saved`, 'success');
      }
      navigation.goBack();
    } catch (err) {
      showToast(apiErrorMessage(err, 'Could not save the quotation'), 'error');
    }
  };

  // -------------------------------------------------------------------------

  if (isEdit && existing.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ padding: s.s4, gap: s.s4 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={64} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (isEdit && existing.isError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ padding: s.s4 }}>
          <ErrorState
            message={apiErrorMessage(existing.error, 'Could not load this quotation')}
            onRetry={existing.refetch}
          />
        </View>
      </SafeAreaView>
    );
  }

  const renderPicker = (
    options: Array<{ id: string; name: string }>,
    selectedId: string | undefined,
    onSelect: (id: string) => void,
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
        {options.map((option, i) => (
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
              trailing={
                option.id === selectedId ? <Check size={20} color={theme.colors.accent} /> : undefined
              }
              onPress={() => onSelect(option.id)}
              accessibilityLabel={`${option.name}${option.id === selectedId ? ', selected' : ''}`}
            />
          </React.Fragment>
        ))}
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
          paddingHorizontal: s.s4,
          paddingVertical: s.s3,
        }}
      >
        <Button
          variant="icon"
          icon={ArrowLeft}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <View style={{ flex: 1, marginHorizontal: s.s4 }}>
          <Segmented segments={['Builder', 'Review']} selectedIndex={tab} onChange={setTab} />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {tab === 0 ? (
          <ScrollView
            contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
          >
            <SectionHeader title="CUSTOMER" />
            {customers.isLoading ? (
              <Skeleton height={64} />
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
                    {renderPicker(
                      customers.data ?? [],
                      field.value,
                      field.onChange,
                      'No customers yet.',
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

            <View style={{ marginTop: s.s4 }}>
              <SectionHeader title="TEMPLATE (OPTIONAL)" />
              {templates.isLoading ? (
                <Skeleton height={64} />
              ) : (
                <Controller
                  control={control}
                  name="templateId"
                  render={({ field }) => (
                    <>
                      {renderPicker(
                        templates.data ?? [],
                        field.value,
                        field.onChange,
                        'No quotation templates configured.',
                      )}
                    </>
                  )}
                />
              )}
            </View>

            <View style={{ marginTop: s.s4 }}>
              <Controller
                control={control}
                name="date"
                render={({ field, fieldState }) => (
                  <Input
                    label="Date"
                    placeholder="YYYY-MM-DD"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                    accessibilityLabel="Quotation date"
                  />
                )}
              />
            </View>

            <SectionHeader title="LINE ITEMS" />
            {fields.map((f, index) => (
              <Card key={f.id} style={{ padding: s.s4, marginBottom: s.s3 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: s.s2,
                  }}
                >
                  <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}>
                    Item {index + 1}
                  </Text>
                  {fields.length > 1 && (
                    <Button
                      variant="icon"
                      icon={Trash2}
                      onPress={() => remove(index)}
                      accessibilityLabel={`Remove line item ${index + 1}`}
                    />
                  )}
                </View>

                <Controller
                  control={control}
                  name={`items.${index}.name`}
                  render={({ field, fieldState }) => (
                    <Input
                      label="Description"
                      placeholder="e.g. Hotel stay (3 nights)"
                      value={field.value}
                      onChangeText={field.onChange}
                      error={fieldState.error?.message}
                      accessibilityLabel={`Line item ${index + 1} description`}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name={`items.${index}.quantity`}
                  render={({ field }) => (
                    <View style={{ marginBottom: s.s3 }}>
                      <Stepper
                        label="Quantity"
                        value={field.value}
                        onChange={field.onChange}
                        min={1}
                        max={999}
                      />
                    </View>
                  )}
                />

                <Controller
                  control={control}
                  name={`items.${index}.price`}
                  render={({ field, fieldState }) => (
                    <CurrencyField
                      label="Unit price"
                      value={field.value ?? ''}
                      onChangeText={field.onChange}
                      error={fieldState.error?.message}
                      placeholder="0"
                    />
                  )}
                />

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>
                    Line total {formatRupees(lineTotals[index] ?? 0)}
                  </Text>
                </View>
              </Card>
            ))}

            <Button
              variant="secondary"
              label="Add item"
              icon={Plus}
              fullWidth
              onPress={() => append({ name: '', quantity: 1, price: '' })}
              accessibilityLabel="Add another line item"
            />

            {typeof formState.errors.items?.message === 'string' && (
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.status.danger, marginTop: s.s2 },
                ]}
              >
                {formState.errors.items.message}
              </Text>
            )}

            <View style={{ marginTop: s.s4 }}>
              <Controller
                control={control}
                name="amountInWords"
                render={({ field }) => (
                  <Input
                    label="Amount in words (optional)"
                    placeholder="e.g. Forty seven thousand rupees only"
                    value={field.value}
                    onChangeText={field.onChange}
                    accessibilityLabel="Amount in words"
                  />
                )}
              />
            </View>

            <View
              style={{
                marginTop: s.s4,
                padding: s.s4,
                backgroundColor: theme.colors.bg.surfaceRaised,
                borderRadius: theme.radius.md,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
                Total
              </Text>
              <Text style={[theme.typography.title2, { color: theme.colors.text.primary }]}>
                {formatRupees(total)}
              </Text>
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
            <SectionHeader title="REVIEW" />
            <Card style={{ overflow: 'hidden', marginBottom: s.s4 }}>
              {(values.items ?? []).map((item, i) => (
                <React.Fragment key={i}>
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
                    title={item?.name?.trim() || `Item ${i + 1}`}
                    subtitle={`${item?.quantity ?? 1} × ${formatRupees(parseRupees(item?.price))}`}
                    trailing={
                      <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>
                        {formatRupees(lineTotals[i] ?? 0)}
                      </Text>
                    }
                    accessibilityLabel={`${item?.name || `Item ${i + 1}`}, ${formatRupees(
                      lineTotals[i] ?? 0,
                    )}`}
                  />
                </React.Fragment>
              ))}
            </Card>

            <View
              style={{
                padding: s.s4,
                backgroundColor: theme.colors.bg.surfaceRaised,
                borderRadius: theme.radius.md,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
                Total
              </Text>
              <Text style={[theme.typography.title2, { color: theme.colors.text.primary }]}>
                {formatRupees(total)}
              </Text>
            </View>

            {isEdit && existing.data ? (
              <View style={{ marginTop: s.s4, flexDirection: 'row', gap: s.s2 }}>
                <Badge variant="neutral" label={existing.data.quotationNumber} />
                <Badge
                  variant={existing.data.status === 'ACCEPTED' ? 'success' : 'info'}
                  label={existing.data.status}
                />
              </View>
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <View
        style={{
          padding: s.s4,
          backgroundColor: theme.colors.bg.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border.hairline,
          gap: s.s3,
        }}
      >
        <Button
          variant="primary"
          label={isEdit ? 'Save changes' : 'Save quotation'}
          fullWidth
          loading={isCreating || isUpdating}
          disabled={isBusy}
          onPress={handleSubmit((v) => save(v, false))}
          accessibilityLabel={isEdit ? 'Save changes to the quotation' : 'Save the quotation'}
        />
        <Button
          variant="secondary"
          label="Save & send on WhatsApp"
          icon={MessageCircle}
          fullWidth
          loading={isSending}
          disabled={isBusy}
          onPress={handleSubmit((v) => save(v, true))}
          accessibilityLabel="Save the quotation and send it to the customer on WhatsApp"
        />
      </View>
    </SafeAreaView>
  );
}
