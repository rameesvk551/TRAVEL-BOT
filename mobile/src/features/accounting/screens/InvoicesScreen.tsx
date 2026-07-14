// FILE: mobile/src/features/accounting/screens/InvoicesScreen.tsx
//
// Read-only invoice list. Creating an invoice posts a journal entry into the
// governed control ledgers (immutable, period-locked, gap-free numbering), so
// there is deliberately no create/edit/void affordance on mobile.
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useInvoices,
  invoiceOutstanding,
  isInvoiceOverdue,
  invoiceStatusLabel,
  Invoice,
  InvoiceStatus,
} from '../api';
import {
  Segmented,
  ListRow,
  Badge,
  BadgeVariant,
  EmptyState,
  ErrorState,
  Skeleton,
  Avatar,
  Button,
} from '../../../ui';
import { FileText, ArrowLeft } from 'lucide-react-native';
import { formatCurrency, formatDate } from '../../../lib/formatters';

const TABS: { label: string; status?: InvoiceStatus }[] = [
  { label: 'All' },
  { label: 'Issued', status: 'ISSUED' },
  { label: 'Part paid', status: 'PARTIALLY_PAID' },
  { label: 'Paid', status: 'PAID' },
];

function statusVariant(invoice: Invoice): BadgeVariant {
  if (isInvoiceOverdue(invoice)) return 'danger';
  switch (invoice.status) {
    case 'PAID':
      return 'success';
    case 'PARTIALLY_PAID':
      return 'warning';
    case 'ISSUED':
      return 'info';
    default:
      return 'neutral';
  }
}

export function InvoicesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [tab, setTab] = useState(0);
  const { data: invoices, isLoading, isError, refetch } = useInvoices(TABS[tab].status);

  const s = theme.spacing;

  const renderItem = ({ item }: { item: Invoice }) => {
    const overdue = isInvoiceOverdue(item);
    const due = invoiceOutstanding(item);
    const name = item.customer?.name || item.invoiceNumber;
    const dueLabel = item.dueDate ? `Due ${formatDate(item.dueDate)}` : 'No due date';

    return (
      <ListRow
        leading={<Avatar name={name} />}
        title={name}
        subtitle={
          <Text
            style={[
              theme.typography.subhead,
              { color: overdue ? theme.colors.status.danger : theme.colors.text.secondary },
            ]}
          >
            {item.invoiceNumber} • {dueLabel}
          </Text>
        }
        trailing={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
              {formatCurrency(item.totalAmount)}
            </Text>
            <Badge
              label={overdue ? 'Overdue' : invoiceStatusLabel(item.status)}
              variant={statusVariant(item)}
            />
          </View>
        }
        accessibilityLabel={`Invoice ${item.invoiceNumber} for ${name}, ${formatCurrency(
          item.totalAmount,
        )}, ${overdue ? 'overdue' : invoiceStatusLabel(item.status)}${
          due > 0 ? `, ${formatCurrency(due)} outstanding` : ''
        }`}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: s.s4,
          paddingTop: s.s4,
        }}
      >
        <Button
          variant="icon"
          icon={ArrowLeft}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text
          style={[
            theme.typography.largeTitle,
            { color: theme.colors.text.primary, marginLeft: s.s2 },
          ]}
        >
          Invoices
        </Text>
      </View>

      <View style={{ paddingHorizontal: s.s4, paddingVertical: s.s4 }}>
        <Segmented segments={TABS.map((t) => t.label)} selectedIndex={tab} onChange={setTab} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={72} />
            ))}
          </View>
        ) : isError ? (
          <View style={{ padding: s.s4 }}>
            <ErrorState message="Couldn't load invoices." onRetry={refetch} />
          </View>
        ) : !invoices || invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices"
            message="Invoices raised on the web app will appear here."
          />
        ) : (
          <FL
            data={invoices}
            renderItem={renderItem}
            estimatedItemSize={76}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={refetch}
                tintColor={theme.colors.accent}
              />
            }
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.colors.border.hairline,
                  marginLeft: 16,
                }}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
