// FILE: mobile/src/features/cruises/screens/CruiseFormScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, CurrencyField, SectionHeader, ProgressBar } from '../../../ui';
import { ArrowLeft } from 'lucide-react-native';

export function CruiseFormScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [step, setStep] = useState(0); // 0: Details, 1: Media & inc/exc, 2: Cabins
  
  const s = theme.spacing;

  const handleNext = () => {
    if (step < 2) setStep(step + 1);
    else navigation.goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => step > 0 ? setStep(step - 1) : navigation.goBack()} />
        <View style={{ flex: 1, marginHorizontal: s.s4 }}>
          <ProgressBar progress={(step + 1) / 3} />
        </View>
        <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>{step + 1} of 3</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
          {step === 0 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Cruise Details" />
              <Input label="Name" value="" onChangeText={() => {}} placeholder="e.g. Mediterranean Bliss" />
              <Input label="Cruise Line" value="" onChangeText={() => {}} placeholder="e.g. Royal Caribbean" />
              <Input label="Departure Port" value="" onChangeText={() => {}} placeholder="e.g. Barcelona" />
              <Input label="Duration" value="" onChangeText={() => {}} placeholder="e.g. 7N/8D" />
            </View>
          )}

          {step === 1 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Media & Inclusions" />
              <Button variant="secondary" label="Upload Cover Image" onPress={() => {}} />
              <Input label="Add inclusion" value="" onChangeText={() => {}} placeholder="e.g. All meals" />
              <Button variant="secondary" label="Add Inclusion" onPress={() => {}} />
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Cabins" />
              <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.md, gap: s.s3 }}>
                <Input label="Cabin Type" value="Ocean View" onChangeText={() => {}} />
                <CurrencyField label="Price" value="85000" onChangeText={() => {}} />
                <Input label="Description" value="" onChangeText={() => {}} multiline />
              </View>
              <Button variant="secondary" label="Add Cabin Type" onPress={() => {}} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderTopWidth: 1, borderTopColor: theme.colors.border.hairline }}>
        <Button 
          variant="primary" 
          label={step === 2 ? "Save Cruise" : "Next"} 
          fullWidth 
          onPress={handleNext} 
        />
      </View>
    </SafeAreaView>
  );
}
