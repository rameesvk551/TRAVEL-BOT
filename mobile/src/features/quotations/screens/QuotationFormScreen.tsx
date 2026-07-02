// FILE: mobile/src/features/quotations/screens/QuotationFormScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, CurrencyField, Segmented, SectionHeader, ListRow } from '../../../ui';
import { ArrowLeft, MessageCircle } from 'lucide-react-native';

export function QuotationFormScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [tab, setTab] = useState(0); // 0: Builder, 1: Preview
  const s = theme.spacing;

  const [items, setItems] = useState([
    { name: 'Hotel Stay (3N)', price: 45000 },
    { name: 'Airport Transfer', price: 2000 },
  ]);

  const total = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1, marginHorizontal: s.s4 }}>
          <Segmented segments={['Builder', 'Preview']} selectedIndex={tab} onChange={setTab} />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {tab === 0 ? (
          <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Details" />
              <Input label="Customer" value="Ravi Kumar" onChangeText={() => {}} />
              <Input label="Template" value="Standard Travel Estimate" onChangeText={() => {}} />
              <Input label="Date" value={new Date().toLocaleDateString()} onChangeText={() => {}} />

              <SectionHeader title="Line Items" />
              <View style={{ backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.md, overflow: 'hidden' }}>
                {items.map((item, i) => (
                  <View key={i} style={{ padding: s.s3, borderBottomWidth: 1, borderBottomColor: theme.colors.border.hairline }}>
                    <Text style={[theme.typography.subhead, { color: theme.colors.text.primary }]}>{item.name}</Text>
                    <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginTop: 4 }]}>₹{item.price.toLocaleString('en-IN')}</Text>
                  </View>
                ))}
              </View>

              <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.md, gap: s.s3 }}>
                 <Input label="Item Name" value="" onChangeText={() => {}} placeholder="e.g. Flight Tickets" />
                 <CurrencyField label="Amount" value="" onChangeText={() => {}} placeholder="0" />
                 <Button variant="secondary" label="Add Item" onPress={() => {}} />
              </View>

              <View style={{ marginTop: s.s4, alignItems: 'flex-end' }}>
                 <Text style={[theme.typography.title2, { color: theme.colors.text.primary }]}>Total: ₹{total.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: s.s4 }}>
            {/* WebView Placeholder */}
            <View style={{ width: '100%', height: '80%', backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border.hairline }}>
               <Text style={[theme.typography.title3, { color: theme.colors.text.secondary }]}>PDF Render Preview</Text>
               <Text style={[theme.typography.subhead, { color: theme.colors.text.tertiary, marginTop: s.s2 }]}>Handlebars Template</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderTopWidth: 1, borderTopColor: theme.colors.border.hairline }}>
        {tab === 0 ? (
          <Button variant="primary" label="Save Draft" fullWidth onPress={() => navigation.goBack()} />
        ) : (
          <Button variant="primary" label="Send on WhatsApp" icon={MessageCircle} fullWidth onPress={() => navigation.goBack()} style={{ backgroundColor: '#25D366' }} />
        )}
      </View>
    </SafeAreaView>
  );
}
