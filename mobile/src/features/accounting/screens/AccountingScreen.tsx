// FILE: mobile/src/features/accounting/screens/AccountingScreen.tsx
//
// Read-only accounting overview: the two control-ledger balances (receivables /
// payables) and the P&L summary. Mobile never posts to the ledger — journal
// entries are immutable, period-locked and gap-free-numbered, so all write
// paths live on the web app.
import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { usePayablesReceivables, useProfitLoss } from '../api';
import {
  MetricCard,
  SectionHeader,
  ListRow,
  Card,
  Skeleton,
  ErrorState,
  BarChart,
} from '../../../ui';
import { FileText } from 'lucide-react-native';
import { formatCurrency, formatCurrencyCompact, formatPercent } from '../../../lib/formatters';

export function AccountingScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = theme.spacing;

  const balances = usePayablesReceivables();
  const pnl = useProfitLoss();

  const isLoading = balances.isLoading || pnl.isLoading;
  const isError = balances.isError || pnl.isError;

  const refetch = () => {
    balances.refetch();
    pnl.refetch();
  };

  const summary = pnl.data?.summary;

  // All three are non-negative magnitudes, so they compare cleanly in one chart.
  // Net profit stays a KPI tile — it can go negative, which a bar cannot show.
  const pnlBars = summary
    ? [
        { label: 'Revenue', value: Math.max(0, summary.revenue) },
        { label: 'Cost of sales', value: Math.max(0, summary.costOfSales) },
        { label: 'Operating exp.', value: Math.max(0, summary.operatingExpenses) },
      ].filter((b) => b.value > 0)
    : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary }]}>
          Accounting
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={theme.colors.accent}
          />
        }
      >
        {isLoading ? (
          <View style={{ padding: s.s4, flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ width: '48%' }}>
                <Skeleton height={100} />
              </View>
            ))}
          </View>
        ) : isError ? (
          <View style={{ padding: s.s4 }}>
            <ErrorState message="Couldn't load accounting data." onRetry={refetch} />
          </View>
        ) : (
          <View style={{ gap: s.s5 }}>
            {/* Control-ledger balances + P&L headline */}
            <View
              style={{
                paddingHorizontal: s.s4,
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: s.s3,
              }}
            >
              <View style={{ width: '48%' }}>
                <MetricCard
                  label="Receivables"
                  value={formatCurrencyCompact(balances.data?.receivables.balance)}
                />
              </View>
              <View style={{ width: '48%' }}>
                <MetricCard
                  label="Payables"
                  value={formatCurrencyCompact(balances.data?.payables.balance)}
                />
              </View>
              <View style={{ width: '48%' }}>
                <MetricCard label="Revenue" value={formatCurrencyCompact(summary?.revenue)} />
              </View>
              <View style={{ width: '48%' }}>
                <MetricCard
                  label="Net profit"
                  value={formatCurrencyCompact(summary?.netProfit)}
                />
              </View>
            </View>

            {/* P&L breakdown */}
            {pnlBars.length > 0 && (
              <View style={{ paddingHorizontal: s.s4, gap: s.s3 }}>
                <SectionHeader title="Profit & Loss" />
                <Card>
                  <BarChart
                    data={pnlBars}
                    variant="nominal"
                    formatValue={(v) => formatCurrencyCompact(v)}
                  />
                </Card>
                <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}>
                  Net margin {formatPercent(summary?.netMargin)} • Gross profit{' '}
                  {formatCurrency(summary?.grossProfit)}
                </Text>
              </View>
            )}

            {/* Modules */}
            <View style={{ paddingHorizontal: s.s4, gap: s.s3 }}>
              <SectionHeader title="Modules" />
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <ListRow
                  leading={<FileText size={20} color={theme.colors.accent} />}
                  title="Invoices"
                  subtitle="View customer billing"
                  onPress={() => navigation.navigate('Invoices')}
                  accessibilityLabel="Open invoices"
                />
              </Card>
              <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}>
                Ledgers and journal entries are read-only on mobile. Post them from the web app.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
