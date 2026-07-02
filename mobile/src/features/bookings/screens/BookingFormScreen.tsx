// FILE: mobile/src/features/bookings/screens/BookingFormScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useCreateBooking } from '../api';
import { Button, ProgressBar, Input, Segmented, SectionHeader, Stepper, CurrencyField } from '../../../ui';
import { ArrowLeft, CheckCircle2, ChevronLeft } from 'lucide-react-native';
import { showToast } from '../../../ui/Toast';

export function BookingFormScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const { mutate: createBooking, isPending } = useCreateBooking();

  // Form State
  const [customerType, setCustomerType] = useState(0); // 0: Existing, 1: New
  const [customerName, setCustomerName] = useState('');
  const [itemType, setItemType] = useState(0);
  const [itemName, setItemName] = useState('');
  const [travellers, setTravellers] = useState(2);
  const [basePrice, setBasePrice] = useState('50000');
  
  const s = theme.spacing;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      createBooking({}, {
        onSuccess: () => {
          showToast('Booking created successfully', 'success');
          navigation.goBack();
        }
      });
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s2, paddingTop: s.s2, paddingBottom: s.s4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.hairline }}>
        <Button variant="plain" icon={step === 1 ? ArrowLeft : ChevronLeft} onPress={handleBack} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>New Booking</Text>
          <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Step {step} of {totalSteps}</Text>
        </View>
        <View style={{ width: 44 }} /> {/* Balance for center alignment */}
      </View>

      <ProgressBar progress={step / totalSteps} height={2} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: s.s4 }} keyboardShouldPersistTaps="handled">
          
          {step === 1 && (
            <View>
              <SectionHeader title="CUSTOMER" />
              <View style={{ marginBottom: s.s6 }}>
                <Segmented segments={['Existing', 'New']} selectedIndex={customerType} onChange={setCustomerType} />
              </View>
              
              {customerType === 0 ? (
                <View style={{ padding: s.s6, alignItems: 'center', backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.lg }}>
                  <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>[ Customer Picker Sheet ]</Text>
                  <Button variant="secondary" label="Select Customer" onPress={() => {}} style={{ marginTop: s.s4 }} />
                </View>
              ) : (
                <View>
                  <Input label="Name" placeholder="Full Name" value={customerName} onChangeText={setCustomerName} />
                  <Input label="Phone" placeholder="+91" keyboardType="phone-pad" />
                  <Input label="Email" placeholder="email@example.com" keyboardType="email-address" />
                </View>
              )}
            </View>
          )}

          {step === 2 && (
            <View>
              <SectionHeader title="SERVICE" />
              <View style={{ marginBottom: s.s6 }}>
                <Segmented segments={['Package', 'Property', 'Cruise']} selectedIndex={itemType} onChange={setItemType} />
              </View>

              <View style={{ padding: s.s6, alignItems: 'center', backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.lg }}>
                <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>[ Item Picker Sheet ]</Text>
                <Button variant="secondary" label="Select Item" onPress={() => setItemName('Bali Escape')} style={{ marginTop: s.s4 }} />
              </View>

              {itemName ? (
                <View style={{ marginTop: s.s6, flexDirection: 'row', alignItems: 'center', gap: s.s2 }}>
                  <CheckCircle2 color={theme.colors.status.success} size={20} />
                  <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>Selected: {itemName}</Text>
                </View>
              ) : null}
            </View>
          )}

          {step === 3 && (
            <View>
              <SectionHeader title="PRICING & DATES" />
              <View style={{ marginBottom: s.s6 }}>
                <Stepper label="Travellers" value={travellers} onChange={setTravellers} min={1} max={20} />
              </View>

              <CurrencyField label="Base Price" value={basePrice} onChangeText={setBasePrice} />
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: s.s4, padding: s.s4, backgroundColor: theme.colors.bg.surfaceRaised, borderRadius: theme.radius.md }}>
                <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>Total</Text>
                <Text style={[theme.typography.title2, { color: theme.colors.text.primary }]}>₹{(Number(basePrice.replace(/,/g, '')) * travellers).toLocaleString('en-IN')}</Text>
              </View>

              <Input label="Travel Date" placeholder="Select date" />
              <Input label="Notes" placeholder="Any special requests..." multiline />
            </View>
          )}

        </ScrollView>

        <View style={{ padding: s.s4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border.hairline, backgroundColor: theme.colors.bg.surface }}>
          <Button 
            variant="primary" 
            label={step === totalSteps ? 'Save Booking' : 'Next'} 
            fullWidth 
            onPress={handleNext}
            loading={isPending}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
