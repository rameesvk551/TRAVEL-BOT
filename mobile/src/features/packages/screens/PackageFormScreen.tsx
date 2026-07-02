// FILE: mobile/src/features/packages/screens/PackageFormScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, CurrencyField, Segmented, SectionHeader, ProgressBar } from '../../../ui';
import { ArrowLeft, Save } from 'lucide-react-native';

export function PackageFormScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [step, setStep] = useState(0); // 0: Basics, 1: Inclusions, 2: Exclusions, 3: Media
  
  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState(0);
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');

  const s = theme.spacing;

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else {
      // Save
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => step > 0 ? setStep(step - 1) : navigation.goBack()} />
        <View style={{ flex: 1, marginHorizontal: s.s4 }}>
          <ProgressBar progress={(step + 1) / 4} />
        </View>
        <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>{step + 1} of 4</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
          {step === 0 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Basic Details" />
              <Input label="Package Name" value={name} onChangeText={setName} placeholder="e.g. Goa Beach Escape" />
              <View>
                <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: s.s2 }]}>Category</Text>
                <Segmented segments={['Domestic', 'International']} selectedIndex={category} onChange={setCategory} />
              </View>
              <CurrencyField label="Base Price" value={price} onChangeText={setPrice} placeholder="25000" />
              <Input label="Duration" value={duration} onChangeText={setDuration} placeholder="e.g. 4N/5D" />
            </View>
          )}

          {step === 1 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Inclusions" />
              <Input label="Add inclusion" value="" onChangeText={() => {}} placeholder="e.g. Breakfast included" />
              <Button variant="secondary" label="Add" onPress={() => {}} />
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Exclusions" />
              <Input label="Add exclusion" value="" onChangeText={() => {}} placeholder="e.g. Flights not included" />
              <Button variant="secondary" label="Add" onPress={() => {}} />
            </View>
          )}

          {step === 3 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Media" />
              <Button variant="secondary" label="Upload Cover Image" onPress={() => {}} />
              <Button variant="secondary" label="Upload PDF Brochure" onPress={() => {}} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderTopWidth: 1, borderTopColor: theme.colors.border.hairline }}>
        <Button 
          variant="primary" 
          label={step === 3 ? "Save Package" : "Next"} 
          fullWidth 
          onPress={handleNext} 
        />
      </View>
    </SafeAreaView>
  );
}
