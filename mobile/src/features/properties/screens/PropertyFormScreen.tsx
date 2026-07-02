// FILE: mobile/src/features/properties/screens/PropertyFormScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, CurrencyField, Segmented, SectionHeader, ProgressBar, Switch, Chip } from '../../../ui';
import { ArrowLeft } from 'lucide-react-native';

export function PropertyFormScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [step, setStep] = useState(0); // 0: Basics, 1: Address, 2: Amenities, 3: Media
  
  const [type, setType] = useState(0); // 0: For sale, 1: For rent
  const [isActive, setIsActive] = useState(true);

  const s = theme.spacing;

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else navigation.goBack();
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
              <Input label="Name" value="" onChangeText={() => {}} placeholder="e.g. Sunset Villa" />
              <View>
                <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: s.s2 }]}>Type</Text>
                <Segmented segments={['For sale', 'For rent']} selectedIndex={type} onChange={setType} />
              </View>
              <CurrencyField label="Price" value="" onChangeText={() => {}} placeholder="12000" />
            </View>
          )}

          {step === 1 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Address & Description" />
              <Input label="Location" value="" onChangeText={() => {}} placeholder="e.g. Goa" />
              <Input label="Full Address" value="" onChangeText={() => {}} multiline placeholder="123 Beach Road..." />
              <Input label="Description" value="" onChangeText={() => {}} multiline placeholder="A beautiful villa..." />
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Amenities" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2 }}>
                {['Pool', 'WiFi', 'Kitchen', 'AC', 'Heater', 'Parking'].map(item => (
                   <Chip key={item} label={item} selected={item === 'Pool' || item === 'WiFi'} onPress={() => {}} />
                ))}
              </View>
              
              <View style={{ marginTop: s.s4 }}>
                 <Input label="Add Custom Amenity" value="" onChangeText={() => {}} />
                 <Button variant="secondary" label="Add" onPress={() => {}} />
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Media & Settings" />
              <Button variant="secondary" label="Upload Cover Image" onPress={() => {}} />
              <Button variant="secondary" label="Upload PDF Brochure" onPress={() => {}} />
              
              <View style={{ marginTop: s.s4 }}>
                <Switch label="Active Listing" value={isActive} onValueChange={setIsActive} />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderTopWidth: 1, borderTopColor: theme.colors.border.hairline }}>
        <Button 
          variant="primary" 
          label={step === 3 ? "Save Property" : "Next"} 
          fullWidth 
          onPress={handleNext} 
        />
      </View>
    </SafeAreaView>
  );
}
