// FILE: mobile/src/features/packages/screens/PackageFinanceScreen.tsx
// Wired to GET /item-finance/PACKAGE/:id — the generic per-item ledger (the same
// route the web finance page uses), NOT /packages/:id/finance.
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useItemFinance,
  useCreateVendorCost,
  useDeleteVendorCost,
  useVendors,
  formatPaise,
  formatPaiseCompact,
  rupeesToPaise,
  getApiErrorMessage,
  FinancePayable,
} from '../api';
import {
  Button,
  Input,
  CurrencyField,
  Segmented,
  MetricCard,
  ListRow,
  Badge,
  Chip,
  Card,
  Banner,
  EmptyState,
  ErrorState,
  Skeleton,
  SectionHeader,
  BarChart,
  showToast,
} from '../../../ui';
import { ArrowLeft, CreditCard, Plus, Users, Trash2 } from 'lucide-react-native';

const TABS = ['Receivables', 'Payables', 'Vendors', 'Aging'];

export function PackageFinanceScreen({ route, navigation }: any) {
  const { packageId } = route.params;
  const { theme } = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: report, isLoading, isError, error, refetch } = useItemFinance('PACKAGE', packageId);
  const deleteCost = useDeleteVendorCost('PACKAGE', packageId);

  const s = theme.spacing;

  const confirmDeletePayable = (payable: FinancePayable) => {
    if (!payable.deletable) {
      showToast('Vendor bills are managed on the Vendors page', 'info');
      return;
    }
    Alert.alert('Delete cost', `Remove "${payable.service}" from ${payable.vendorName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteCost.mutate(payable.id, {
            onSuccess: () => showToast('Vendor cost deleted', 'success'),
            onError: (err) => showToast(getApiErrorMessage(err, 'Could not delete'), 'error'),
          }),
      },
    ]);
  };

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
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <View style={{ marginLeft: s.s2, flex: 1 }}>
          <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
            Finance
          </Text>
          {report ? (
            <Text
              style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}
              numberOfLines={1}
            >
              {report.item.name}
            </Text>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View style={{ padding: s.s4, gap: s.s4 }}>
          <Skeleton height={80} />
          <Skeleton height={80} />
          <Skeleton height={200} />
        </View>
      ) : isError ? (
        <View style={{ padding: s.s4 }}>
          <ErrorState
            message={getApiErrorMessage(error, 'Could not load the finance report')}
            onRetry={refetch}
          />
        </View>
      ) : !report ? null : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {/* KPI grid — all figures arrive in paise. */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              paddingHorizontal: s.s4,
              gap: s.s3,
              marginBottom: s.s5,
            }}
          >
            <View style={{ width: '48%' }}>
              <MetricCard label="Expected" value={formatPaiseCompact(report.revenue.expectedRevenue)} />
            </View>
            <View style={{ width: '48%' }}>
              <MetricCard label="Received" value={formatPaiseCompact(report.revenue.receivedRevenue)} />
            </View>
            <View style={{ width: '48%' }}>
              <MetricCard
                label="Pending"
                value={formatPaiseCompact(report.revenue.pendingRevenue)}
                deltaDirection={report.revenue.pendingRevenue > 0 ? 'down' : undefined}
              />
            </View>
            <View style={{ width: '48%' }}>
              <MetricCard label="Cost" value={formatPaiseCompact(report.costs.totalCost)} />
            </View>
            <View style={{ width: '48%' }}>
              <MetricCard
                label="Gross profit"
                value={formatPaiseCompact(report.profitability.grossProfit)}
              />
            </View>
            <View style={{ width: '48%' }}>
              <MetricCard label="Margin" value={`${report.profitability.profitPercent}%`} />
            </View>
          </View>

          <View style={{ paddingHorizontal: s.s4, marginBottom: s.s4 }}>
            <Segmented segments={TABS} selectedIndex={tabIndex} onChange={setTabIndex} />
          </View>

          <View style={{ paddingHorizontal: s.s4 }}>
            {tabIndex === 0 && (
              <View>
                {report.receivables.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No bookings yet"
                    message="Customer receivables appear here once this package is booked."
                  />
                ) : (
                  report.receivables.map((row) => (
                    <ListRow
                      key={row.bookingId}
                      title={row.customerName}
                      subtitle={`${row.bookingRef} · ${row.travellers} pax · ${formatPaise(row.paid)} paid`}
                      accessibilityLabel={`${row.customerName}, balance ${formatPaise(row.balance)}`}
                      trailing={
                        row.balance > 0 ? (
                          <Badge label={`${formatPaise(row.balance)} due`} variant="danger" />
                        ) : (
                          <Badge label="Paid" variant="success" />
                        )
                      }
                    />
                  ))
                )}
              </View>
            )}

            {tabIndex === 1 && (
              <View>
                {report.payables.length === 0 ? (
                  <EmptyState
                    icon={CreditCard}
                    title="No payables"
                    message="Add a vendor cost to track what this package costs you."
                    actionLabel="Add vendor cost"
                    onAction={() => setSheetOpen(true)}
                  />
                ) : (
                  report.payables.map((row) => (
                    <ListRow
                      key={row.id}
                      title={row.vendorName}
                      subtitle={`${row.service}${row.dueDate ? ` · due ${row.dueDate}` : ''} · ${formatPaise(row.cost)}`}
                      accessibilityLabel={`${row.vendorName}, ${row.service}, balance ${formatPaise(row.balance)}`}
                      trailing={
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.s2 }}>
                          <Badge
                            label={row.balance > 0 ? `${formatPaise(row.balance)} due` : 'Settled'}
                            variant={row.balance > 0 ? 'warning' : 'success'}
                          />
                          {row.deletable ? (
                            <Button
                              variant="icon"
                              icon={Trash2}
                              onPress={() => confirmDeletePayable(row)}
                              accessibilityLabel={`Delete ${row.service} cost from ${row.vendorName}`}
                            />
                          ) : null}
                        </View>
                      }
                    />
                  ))
                )}
              </View>
            )}

            {tabIndex === 2 && (
              <View style={{ gap: s.s3 }}>
                {report.vendorWise.length === 0 ? (
                  <EmptyState
                    icon={CreditCard}
                    title="No vendors"
                    message="Vendor-wise totals appear once costs are added."
                  />
                ) : (
                  report.vendorWise.map((v) => (
                    <Card key={v.vendorId}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[theme.typography.headline, { color: theme.colors.text.primary }]}
                          >
                            {v.vendorName}
                          </Text>
                          <Text
                            style={[
                              theme.typography.footnote,
                              { color: theme.colors.text.secondary, marginTop: 2 },
                            ]}
                            numberOfLines={2}
                          >
                            {v.services.join(', ')}
                          </Text>
                        </View>
                        <Badge
                          label={v.balance > 0 ? `${formatPaise(v.balance)} due` : 'Settled'}
                          variant={v.balance > 0 ? 'warning' : 'success'}
                        />
                      </View>
                      <View style={{ flexDirection: 'row', gap: s.s4, marginTop: s.s3 }}>
                        <Text
                          style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}
                        >
                          Cost {formatPaise(v.totalCost)}
                        </Text>
                        <Text
                          style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}
                        >
                          Paid {formatPaise(v.paid)}
                        </Text>
                      </View>
                    </Card>
                  ))
                )}
              </View>
            )}

            {tabIndex === 3 && (
              <View style={{ gap: s.s4 }}>
                <SectionHeader title="Outstanding by age" />
                {report.agingReport.every((b) => b.amount === 0) ? (
                  <EmptyState
                    icon={CreditCard}
                    title="Nothing outstanding"
                    message="Every booking on this package is fully collected."
                  />
                ) : (
                  <BarChart
                    data={report.agingReport.map((bucket) => ({
                      label: bucket.label,
                      value: bucket.amount,
                    }))}
                    variant="ordinal"
                    formatValue={(v) => formatPaiseCompact(v)}
                  />
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {tabIndex === 1 && report ? (
        <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
          <Button
            variant="fab"
            icon={Plus}
            onPress={() => setSheetOpen(true)}
            accessibilityLabel="Add vendor cost"
          />
        </View>
      ) : null}

      <VendorCostSheet
        visible={sheetOpen}
        packageId={packageId}
        onClose={() => setSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Add-payable sheet — POST /item-finance/PACKAGE/:id/vendor-costs
// ---------------------------------------------------------------------------

function VendorCostSheet({
  visible,
  packageId,
  onClose,
}: {
  visible: boolean;
  packageId: string;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const s = theme.spacing;

  const { data: vendors, isLoading: vendorsLoading } = useVendors();
  const createCost = useCreateVendorCost('PACKAGE', packageId);

  const [vendorId, setVendorId] = useState<string | null>(null);
  const [serviceLabel, setServiceLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [touched, setTouched] = useState(false);

  const amountPaise = rupeesToPaise(amount);
  const dueDateValid = !dueDate || /^\d{4}-\d{2}-\d{2}$/.test(dueDate);
  const errors = useMemo(
    () => ({
      vendorId: !vendorId ? 'Pick a vendor' : undefined,
      serviceLabel: !serviceLabel.trim() ? 'Describe what this cost is for' : undefined,
      amount: !amountPaise || amountPaise <= 0 ? 'Amount must be greater than 0' : undefined,
      dueDate: !dueDateValid ? 'Use YYYY-MM-DD' : undefined,
    }),
    [vendorId, serviceLabel, amountPaise, dueDateValid],
  );
  const isValid = !errors.vendorId && !errors.serviceLabel && !errors.amount && !errors.dueDate;

  const reset = () => {
    setVendorId(null);
    setServiceLabel('');
    setAmount('');
    setDueDate('');
    setTouched(false);
  };

  const submit = () => {
    setTouched(true);
    if (!isValid) return;
    createCost.mutate(
      {
        vendorId: vendorId!,
        serviceLabel: serviceLabel.trim(),
        amount: amountPaise!,
        dueDate: dueDate || null,
      },
      {
        onSuccess: () => {
          showToast('Vendor cost added', 'success');
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.bg.scrim, justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            style={{
              backgroundColor: theme.colors.bg.canvas,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: s.s4,
              gap: s.s4,
              maxHeight: '90%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[theme.typography.title3, { color: theme.colors.text.primary }]}>
                Add vendor cost
              </Text>
              <Button variant="plain" label="Cancel" onPress={onClose} accessibilityLabel="Cancel" />
            </View>

            <ScrollView contentContainerStyle={{ gap: s.s4 }} keyboardShouldPersistTaps="handled">
              {createCost.isError ? (
                <Banner
                  visible
                  variant="error"
                  message={getApiErrorMessage(createCost.error, 'Could not add the cost')}
                />
              ) : null}

              <View style={{ gap: s.s2 }}>
                <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}>
                  Vendor
                </Text>
                {vendorsLoading ? (
                  <Skeleton height={36} />
                ) : !vendors || vendors.length === 0 ? (
                  <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>
                    No vendors yet — add one from the Vendors page first.
                  </Text>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2 }}>
                    {vendors.map((v) => (
                      <Chip
                        key={v.id}
                        label={v.name}
                        selected={vendorId === v.id}
                        onPress={() => setVendorId(v.id)}
                      />
                    ))}
                  </View>
                )}
                {touched && errors.vendorId ? (
                  <Text style={[theme.typography.caption, { color: theme.colors.status.danger }]}>
                    {errors.vendorId}
                  </Text>
                ) : null}
              </View>

              <Input
                label="Service"
                value={serviceLabel}
                onChangeText={setServiceLabel}
                placeholder="e.g. Hotel booking"
                error={touched ? errors.serviceLabel : undefined}
                accessibilityLabel="Service label"
              />
              <CurrencyField
                label="Amount"
                value={amount}
                onChangeText={setAmount}
                placeholder="25000"
                error={touched ? errors.amount : undefined}
              />
              <Input
                label="Due date (optional)"
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="YYYY-MM-DD"
                error={touched ? errors.dueDate : undefined}
                accessibilityLabel="Due date"
              />

              <Button
                variant="primary"
                label="Add cost"
                fullWidth
                loading={createCost.isPending}
                onPress={submit}
                accessibilityLabel="Save vendor cost"
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
