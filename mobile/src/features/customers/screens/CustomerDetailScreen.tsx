// FILE: mobile/src/features/customers/screens/CustomerDetailScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useCustomer,
  useCustomerActivity,
  useCustomerMessages,
  useCustomerLedger,
  customerStats,
  bookingItemName,
  type CustomerBooking,
} from '../api';
import { formatCurrency, formatDate, formatDateTime, truncate } from '../../../lib/formatters';
import {
  Avatar,
  Badge,
  Button,
  Segmented,
  Skeleton,
  Card,
  ListRow,
  SectionHeader,
  EmptyState,
  ErrorState,
} from '../../../ui';
import { showToast } from '../../../ui/Toast';
import { Phone, MessageCircle, ArrowLeft, Briefcase, FileText, Clock } from 'lucide-react-native';

const TABS = ['Profile', 'Bookings', 'Messages', 'Docs', 'Ledger', 'Timeline'];

function bookingBadge(status: CustomerBooking['status']) {
  if (status === 'CONFIRMED' || status === 'COMPLETED') return 'success' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  return 'warning' as const;
}

export function CustomerDetailScreen({ route, navigation }: any) {
  const { customerId } = route.params;
  const { theme } = useTheme();
  const [tab, setTab] = useState(0);

  const { data: customer, isLoading, isError, refetch } = useCustomer(customerId);
  // Deferred until their tab is opened — each hits a different permission.
  const messages = useCustomerMessages(customerId, tab === 2);
  const ledger = useCustomerLedger(customerId, tab === 4);
  const activity = useCustomerActivity(customerId, tab === 5);

  const s = theme.spacing;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ padding: s.s4, gap: s.s4 }}>
          <Skeleton height={200} />
          <Skeleton height={40} />
          <Skeleton height={300} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !customer) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
          <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        </View>
        <View style={{ padding: s.s4 }}>
          <ErrorState message="Couldn't load this customer." onRetry={refetch} />
        </View>
      </SafeAreaView>
    );
  }

  const stats = customerStats(customer);
  const name = customer.name || customer.phone || 'Customer';
  const bookings = customer.bookings ?? [];
  const documents = customer.documents ?? [];

  const dial = () => {
    if (!customer.phone) return showToast('No phone number on file', 'error');
    Linking.openURL(`tel:${customer.phone}`);
  };

  const whatsapp = () => {
    if (!customer.phone) return showToast('No phone number on file', 'error');
    Linking.openURL(`https://wa.me/${customer.phone.replace(/[^\d]/g, '')}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Identity */}
        <View style={{ alignItems: 'center', padding: s.s4 }}>
          <Avatar name={name} size={80} />
          <Text style={[theme.typography.title2, { color: theme.colors.text.primary, marginTop: s.s3 }]}>{name}</Text>
          <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, marginTop: s.s1 }]}>
            {customer.phone ?? '—'}
          </Text>

          <View style={{ flexDirection: 'row', gap: s.s3, marginTop: s.s4 }}>
            <Button variant="tinted" icon={Phone} label="Call" onPress={dial} accessibilityLabel={`Call ${name}`} />
            <Button
              variant="tinted"
              icon={MessageCircle}
              label="WhatsApp"
              onPress={whatsapp}
              accessibilityLabel={`Message ${name} on WhatsApp`}
            />
          </View>
        </View>

        {/* Financials — derived from the bookings the list endpoint embeds */}
        <View style={{ flexDirection: 'row', paddingHorizontal: s.s4, marginBottom: s.s6 }}>
          <Card style={{ flex: 1, marginRight: s.s2, padding: s.s3, alignItems: 'center' }}>
            <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Billed</Text>
            <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginTop: s.s1 }]}>
              {formatCurrency(stats.totalBilled)}
            </Text>
          </Card>
          <Card style={{ flex: 1, marginLeft: s.s2, padding: s.s3, alignItems: 'center' }}>
            <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Balance</Text>
            <Text
              style={[
                theme.typography.headline,
                {
                  color: stats.balanceDue > 0 ? theme.colors.status.danger : theme.colors.text.primary,
                  marginTop: s.s1,
                },
              ]}
            >
              {formatCurrency(stats.balanceDue)}
            </Text>
          </Card>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: s.s4, paddingBottom: s.s4 }}
        >
          <View style={{ width: 450 }}>
            <Segmented segments={TABS} selectedIndex={tab} onChange={setTab} />
          </View>
        </ScrollView>

        <View style={{ paddingHorizontal: s.s4 }}>
          {tab === 0 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="CONTACT" />
              <Card>
                <ListRow title="Phone" subtitle={customer.phone ?? '—'} />
                <ListRow title="Email" subtitle={customer.email ?? '—'} />
                <ListRow title="Source" subtitle={customer.source ?? '—'} />
                <ListRow title="Added" subtitle={formatDate(customer.createdAt)} />
              </Card>
              {!!customer.notes && (
                <>
                  <SectionHeader title="NOTES" />
                  <Card style={{ padding: s.s4 }}>
                    <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>{customer.notes}</Text>
                  </Card>
                </>
              )}
            </View>
          )}

          {tab === 1 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="BOOKINGS & SERVICES" />
              {bookings.length === 0 ? (
                <EmptyState icon={Briefcase} title="No bookings" message="This customer hasn't booked anything yet." />
              ) : (
                <Card>
                  {bookings.map((booking) => (
                    <ListRow
                      key={booking.id}
                      title={bookingItemName(booking)}
                      subtitle={`${booking.bookingRef || booking.itemType} · ${formatDate(
                        booking.travelDate || booking.createdAt,
                      )}`}
                      trailing={
                        <View style={{ alignItems: 'flex-end', gap: s.s1 }}>
                          <Text style={[theme.typography.subhead, { color: theme.colors.text.primary }]}>
                            {formatCurrency(booking.totalAmount ?? 0)}
                          </Text>
                          <Badge variant={bookingBadge(booking.status)} label={booking.status} />
                        </View>
                      }
                    />
                  ))}
                </Card>
              )}
            </View>
          )}

          {tab === 2 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="RECENT MESSAGES" />
              {messages.isLoading ? (
                <Skeleton height={200} />
              ) : messages.isError ? (
                <ErrorState message="Couldn't load messages." onRetry={messages.refetch} />
              ) : !messages.data?.length ? (
                <EmptyState icon={MessageCircle} title="No messages" message="No WhatsApp history with this customer." />
              ) : (
                <Card>
                  {messages.data.map((message) => (
                    <ListRow
                      key={message.id}
                      title={truncate(message.content ?? `[${message.type}]`, 60)}
                      subtitle={`${message.direction === 'inbound' ? 'Received' : 'Sent'} · ${formatDateTime(
                        message.timestamp,
                      )}`}
                    />
                  ))}
                </Card>
              )}
            </View>
          )}

          {tab === 3 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="DOCUMENTS" />
              {documents.length === 0 ? (
                <EmptyState icon={FileText} title="No documents" message="Passports and visas uploaded here." />
              ) : (
                <Card>
                  {documents.map((url, index) => (
                    <ListRow
                      key={url}
                      leading={<FileText color={theme.colors.text.tertiary} size={24} />}
                      title={decodeURIComponent(url.split('/').pop() || `Document ${index + 1}`)}
                      onPress={() => Linking.openURL(url)}
                      accessibilityLabel={`Open document ${index + 1}`}
                    />
                  ))}
                </Card>
              )}
            </View>
          )}

          {tab === 4 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="LEDGER" />
              {ledger.isLoading ? (
                <Skeleton height={200} />
              ) : ledger.isError ? (
                <ErrorState message="Couldn't load the ledger." onRetry={ledger.refetch} />
              ) : !ledger.data?.data?.length ? (
                <EmptyState icon={FileText} title="No transactions" message="No invoices or payments posted yet." />
              ) : (
                <Card>
                  {ledger.data.data.map((row) => (
                    <ListRow
                      key={row.id}
                      title={row.description || row.type || 'Entry'}
                      subtitle={`${row.referenceNumber ? `${row.referenceNumber} · ` : ''}${formatDate(row.date)}`}
                      trailing={
                        <View style={{ alignItems: 'flex-end', gap: s.s1 }}>
                          <Text style={[theme.typography.subhead, { color: theme.colors.text.primary }]}>
                            {row.debit ? formatCurrency(row.debit) : `- ${formatCurrency(row.credit)}`}
                          </Text>
                          <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>
                            {formatCurrency(row.runningBalance)}
                          </Text>
                        </View>
                      }
                    />
                  ))}
                </Card>
              )}
            </View>
          )}

          {tab === 5 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="ACTIVITY" />
              {activity.isLoading ? (
                <Skeleton height={200} />
              ) : activity.isError ? (
                <ErrorState message="Couldn't load the timeline." onRetry={activity.refetch} />
              ) : !activity.data?.timeline?.length ? (
                <EmptyState icon={Clock} title="No activity" message="Nothing has happened yet." />
              ) : (
                <Card>
                  {activity.data.timeline.map((event) => (
                    <ListRow
                      key={event.id}
                      title={event.title}
                      subtitle={`${event.description ? `${event.description} · ` : ''}${formatDateTime(event.time)}`}
                    />
                  ))}
                </Card>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
