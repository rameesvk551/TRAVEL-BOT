// FILE: mobile/src/screens/ComponentGallery.tsx
// Renders every UI component in light + dark mode for visual verification.
// Accessible from the More hub in dev mode.

import React, { useState } from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import {
  Button,
  Card,
  MetricCard,
  ListRow,
  Segmented,
  Chip,
  FilterChipRow,
  Badge,
  Avatar,
  Input,
  Stepper,
  CurrencyField,
  SearchBar,
  Switch,
  Banner,
  Skeleton,
  EmptyState,
  ErrorState,
  SectionHeader,
  ProgressBar,
  Divider,
  Grabber,
} from '../ui';
import {
  Package, Users, AlertCircle, TrendingUp, TrendingDown,
  Calendar, Star, ChevronRight,
} from 'lucide-react-native';

export default function ComponentGallery() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const [segmentedIndex, setSegmentedIndex] = useState(0);
  const [switchValue, setSwitchValue] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [stepperValue, setStepperValue] = useState(2);
  const [currencyValue, setCurrencyValue] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [chipStates, setChipStates] = useState<Record<string, boolean>>({
    all: true, travel: false, resort: false, cleaning: false,
  });

  const s = theme.spacing;
  const c = theme.colors;
  const t = theme.typography;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg.canvas }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: s.s4, paddingBottom: s.s12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={[t.largeTitle, { color: c.text.primary, marginTop: s.s4, marginBottom: s.s2 }]}>
          Component Gallery
        </Text>
        <Text style={[t.footnote, { color: c.text.secondary, marginBottom: s.s6 }]}>
          Theme: {themeMode} · {theme.dark ? 'Dark' : 'Light'} mode
        </Text>

        {/* Theme toggle */}
        <SectionHeader title="THEME MODE" />
        <Segmented
          segments={['System', 'Light', 'Dark']}
          selectedIndex={themeMode === 'system' ? 0 : themeMode === 'light' ? 1 : 2}
          onChange={(i) => setThemeMode(i === 0 ? 'system' : i === 1 ? 'light' : 'dark')}
        />

        <View style={{ height: s.s8 }} />

        {/* Buttons */}
        <SectionHeader title="BUTTONS" />
        <View style={{ gap: s.s3 }}>
          <Button variant="primary" label="Primary Button" onPress={() => {}} />
          <Button variant="secondary" label="Secondary Button" onPress={() => {}} />
          <Button variant="tinted" label="Tinted Button" onPress={() => {}} />
          <Button variant="plain" label="Plain Button" onPress={() => {}} />
          <Button variant="destructive" label="Destructive" onPress={() => {}} />
          <View style={{ flexDirection: 'row', gap: s.s3, alignItems: 'center' }}>
            <Button variant="icon" icon={Star} onPress={() => {}} />
            <Button variant="icon" icon={Calendar} onPress={() => {}} />
            <Text style={[t.footnote, { color: c.text.secondary }]}>Icon buttons (44×44)</Text>
          </View>
          <Button variant="primary" label="Loading..." onPress={() => {}} loading />
        </View>

        <View style={{ height: s.s8 }} />

        {/* Cards */}
        <SectionHeader title="CARDS" />
        <Card>
          <Text style={[t.headline, { color: c.text.primary }]}>Basic Card</Text>
          <Text style={[t.subhead, { color: c.text.secondary, marginTop: s.s1 }]}>
            bg/surface with radius.lg and e1 shadow
          </Text>
        </Card>

        <View style={{ height: s.s3 }} />

        {/* Metric Cards */}
        <SectionHeader title="METRIC CARDS" />
        <View style={{ flexDirection: 'row', gap: s.s3 }}>
          <View style={{ flex: 1 }}>
            <MetricCard
              label="New Leads"
              value="127"
              delta={12.5}
              deltaDirection="up"
              onPress={() => {}}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MetricCard
              label="Revenue"
              value="₹4.2L"
              delta={-3.2}
              deltaDirection="down"
              onPress={() => {}}
            />
          </View>
        </View>

        <View style={{ height: s.s8 }} />

        {/* List Rows */}
        <SectionHeader title="LIST ROWS" />
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <ListRow
            leading={<Avatar name="Arjun Mehta" size={40} />}
            title="Arjun Mehta"
            subtitle="Kerala · 4 pax · Package"
            trailing={
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[t.headline, { color: c.text.primary }]}>₹1,25,000</Text>
                <Badge label="Confirmed" variant="success" />
              </View>
            }
            onPress={() => {}}
          />
          <Divider />
          <ListRow
            leading={<Avatar name="Priya Sharma" size={40} />}
            title="Priya Sharma"
            subtitle="Goa · 2 pax · Resort"
            trailing={
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[t.headline, { color: c.text.primary }]}>₹45,000</Text>
                <Badge label="Pending" variant="warning" />
              </View>
            }
            onPress={() => {}}
          />
          <Divider />
          <ListRow
            leading={<Avatar name="Raj Kumar" size={40} />}
            title="Raj Kumar"
            subtitle="Overdue · 3 days"
            trailing={
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[t.headline, { color: c.status.danger }]}>₹72,000</Text>
                <Badge label="Overdue" variant="danger" />
              </View>
            }
            onPress={() => {}}
          />
        </Card>

        <View style={{ height: s.s8 }} />

        {/* Segmented */}
        <SectionHeader title="SEGMENTED CONTROL" />
        <Segmented
          segments={['All', 'Confirmed', 'Pending', 'Cancelled']}
          selectedIndex={segmentedIndex}
          onChange={setSegmentedIndex}
        />

        <View style={{ height: s.s8 }} />

        {/* Chips */}
        <SectionHeader title="FILTER CHIPS" />
        <FilterChipRow
          chips={Object.entries(chipStates).map(([key, selected]) => ({
            key,
            label: key.charAt(0).toUpperCase() + key.slice(1),
            selected,
          }))}
          onToggle={(key) =>
            setChipStates((prev) => ({ ...prev, [key]: !prev[key] }))
          }
        />

        <View style={{ height: s.s8 }} />

        {/* Badges */}
        <SectionHeader title="BADGES" />
        <View style={{ flexDirection: 'row', gap: s.s2, flexWrap: 'wrap' }}>
          <Badge label="Confirmed" variant="success" />
          <Badge label="Pending" variant="warning" />
          <Badge label="Failed" variant="danger" />
          <Badge label="Sent" variant="info" />
          <Badge label="Inactive" variant="neutral" />
          <Badge variant="success" dot />
          <Badge variant="danger" dot />
        </View>

        <View style={{ height: s.s8 }} />

        {/* Avatars */}
        <SectionHeader title="AVATARS" />
        <View style={{ flexDirection: 'row', gap: s.s3, alignItems: 'center' }}>
          <Avatar name="Arjun Mehta" size={48} />
          <Avatar name="Priya S" size={40} />
          <Avatar name="R" size={36} />
          <Avatar name="Dev Team" size={32} />
        </View>

        <View style={{ height: s.s8 }} />

        {/* Inputs */}
        <SectionHeader title="INPUTS" />
        <Input
          label="Email"
          placeholder="you@example.com"
          value={inputValue}
          onChangeText={setInputValue}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View style={{ height: s.s3 }} />
        <Input
          label="Password"
          placeholder="Enter password"
          value=""
          onChangeText={() => {}}
          secureTextEntry
          error="Password must be at least 8 characters"
        />

        <View style={{ height: s.s8 }} />

        {/* Stepper */}
        <SectionHeader title="STEPPER" />
        <Stepper
          value={stepperValue}
          onChange={setStepperValue}
          min={1}
          max={10}
          label="Travellers"
        />

        <View style={{ height: s.s8 }} />

        {/* Currency Field */}
        <SectionHeader title="CURRENCY FIELD" />
        <CurrencyField
          label="Amount"
          value={currencyValue}
          onChangeText={setCurrencyValue}
          placeholder="0"
        />

        <View style={{ height: s.s8 }} />

        {/* Search Bar */}
        <SectionHeader title="SEARCH BAR" />
        <SearchBar
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search modules..."
        />

        <View style={{ height: s.s8 }} />

        {/* Switch */}
        <SectionHeader title="SWITCH" />
        <Switch
          value={switchValue}
          onValueChange={setSwitchValue}
          label="Enable notifications"
        />

        <View style={{ height: s.s8 }} />

        {/* Progress Bar */}
        <SectionHeader title="PROGRESS BAR" />
        <ProgressBar progress={0.65} />
        <View style={{ height: s.s2 }} />
        <Text style={[t.footnote, { color: c.text.secondary }]}>Step 3 of 4 · Inclusions</Text>

        <View style={{ height: s.s8 }} />

        {/* Skeleton */}
        <SectionHeader title="SKELETON LOADING" />
        <View style={{ gap: s.s3 }}>
          <Skeleton width="100%" height={80} radius={theme.radius.lg} />
          <View style={{ flexDirection: 'row', gap: s.s3 }}>
            <Skeleton width="50%" height={100} radius={theme.radius.lg} />
            <Skeleton width="50%" height={100} radius={theme.radius.lg} />
          </View>
          <Skeleton width="60%" height={20} radius={theme.radius.sm} />
        </View>

        <View style={{ height: s.s8 }} />

        {/* Empty State */}
        <SectionHeader title="EMPTY STATE" />
        <EmptyState
          icon={Package}
          title="No packages yet"
          message="Create your first tour package to start selling"
          actionLabel="Create Package"
          onAction={() => {}}
        />

        <View style={{ height: s.s8 }} />

        {/* Error State */}
        <SectionHeader title="ERROR STATE" />
        <ErrorState
          message="Unable to load bookings. Please check your connection."
          onRetry={() => {}}
        />

        <View style={{ height: s.s8 }} />

        {/* Banner */}
        <SectionHeader title="BANNERS" />
        <Banner visible message="You are offline. Showing cached data." variant="offline" />
        <View style={{ height: s.s2 }} />
        <Banner visible message="Connection restored" variant="info" />

        <View style={{ height: s.s8 }} />

        {/* Grabber */}
        <SectionHeader title="GRABBER (SHEET HANDLE)" />
        <Card style={{ alignItems: 'center', paddingTop: s.s2 }}>
          <Grabber />
          <Text style={[t.footnote, { color: c.text.secondary, marginTop: s.s3 }]}>
            Sheet handle indicator
          </Text>
        </Card>

        <View style={{ height: s.s8 }} />

        {/* Divider */}
        <SectionHeader title="DIVIDER" />
        <Card>
          <Text style={[t.body, { color: c.text.primary }]}>Content above</Text>
          <Divider style={{ marginVertical: theme.spacing.s3 }} />
          <Text style={[t.body, { color: c.text.primary }]}>Content below</Text>
        </Card>

        <View style={{ height: s.s12 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
});
