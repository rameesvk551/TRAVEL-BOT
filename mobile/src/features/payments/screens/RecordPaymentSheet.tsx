// FILE: mobile/src/features/payments/screens/RecordPaymentSheet.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme } from '../../../theme/ThemeProvider';
import { useRecordPayment } from '../api';
import { Button, Grabber, SectionHeader, Input, CurrencyField, Segmented } from '../../../ui';
import { showToast } from '../../../ui/Toast';

export interface RecordPaymentSheetProps {
  bookingRef?: string;
}

export const RecordPaymentSheet = React.forwardRef<BottomSheet, RecordPaymentSheetProps>(
  ({ bookingRef }, ref) => {
    const { theme } = useTheme();
    const snapPoints = useMemo(() => ['70%', '90%'], []);
    
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState(0); // 0: UPI, 1: Card, 2: Bank
    const [reference, setReference] = useState('');

    const { mutate: recordPayment, isPending } = useRecordPayment();

    const s = theme.spacing;

    const renderBackdrop = React.useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      ),
      []
    );

    const handleSave = () => {
      recordPayment({ bookingRef, amount, method, reference }, {
        onSuccess: () => {
          showToast('Payment recorded successfully', 'success');
          // @ts-ignore
          ref?.current?.close();
          setAmount('');
          setReference('');
        }
      });
    };

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        handleComponent={Grabber}
        keyboardBehavior="extend"
        backgroundStyle={{ backgroundColor: theme.colors.bg.surfaceRaised }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: s.s4, paddingBottom: s.s10 }} keyboardShouldPersistTaps="handled">
          <View style={{ marginBottom: s.s6, marginTop: s.s2 }}>
            <Text style={[theme.typography.title2, { color: theme.colors.text.primary }]}>Record Payment</Text>
            {bookingRef && <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary, marginTop: 4 }]}>For {bookingRef}</Text>}
          </View>

          <CurrencyField label="Amount Received" value={amount} onChangeText={setAmount} />
          
          <SectionHeader title="PAYMENT METHOD" />
          <View style={{ marginBottom: s.s4 }}>
            <Segmented segments={['UPI', 'Card', 'Bank']} selectedIndex={method} onChange={setMethod} />
          </View>

          <Input label="Transaction Reference (Optional)" placeholder="e.g. UTR number" value={reference} onChangeText={setReference} />

          <Button 
            variant="primary" 
            label="Save Payment" 
            fullWidth 
            style={{ marginTop: s.s6 }}
            loading={isPending}
            onPress={handleSave}
            disabled={!amount}
          />
        </BottomSheetScrollView>
      </BottomSheet>
    );
  }
);
