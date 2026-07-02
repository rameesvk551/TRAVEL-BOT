// FILE: mobile/src/features/itineraries/screens/ItineraryBuilderScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, CurrencyField, Segmented, SectionHeader, ProgressBar, Card } from '../../../ui';
import { ArrowLeft, Plus, MoreVertical } from 'lucide-react-native';

export function ItineraryBuilderScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [step, setStep] = useState(0); // 0: Basics, 1: Day plan, 2: Stay & transport, 3: Pricing, 4: Finish
  
  const s = theme.spacing;

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else navigation.goBack();
  };

  const [days, setDays] = useState([{ id: 1, title: 'Arrival in Goa', desc: 'Transfer to hotel and relax.' }]);
  const [hotels, setHotels] = useState([{ id: 1, name: 'Taj Exotica', nights: 3, room: 'Sea View' }]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => step > 0 ? setStep(step - 1) : navigation.goBack()} />
        <View style={{ flex: 1, marginHorizontal: s.s4 }}>
          <ProgressBar progress={(step + 1) / 5} />
        </View>
        <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>{step + 1} of 5</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
          {step === 0 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Basics" />
              <Input label="Name" value="" onChangeText={() => {}} placeholder="e.g. Goa Honeymoon" />
              <Input label="Destination" value="" onChangeText={() => {}} placeholder="e.g. Goa" />
              <Input label="Dates" value="" onChangeText={() => {}} placeholder="e.g. 12 Oct - 15 Oct" />
              <Input label="Customer" value="" onChangeText={() => {}} placeholder="Search customer..." />
              <Button variant="secondary" label="Start from Package" onPress={() => {}} />
            </View>
          )}

          {step === 1 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Day Plan" />
              {days.map((day, i) => (
                <Card key={day.id} style={{ padding: s.s3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>Day {i + 1}</Text>
                    <TouchableOpacity><MoreVertical size={20} color={theme.colors.text.tertiary} /></TouchableOpacity>
                  </View>
                  <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginTop: s.s1 }]}>{day.title}</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: s.s2 }]}>{day.desc}</Text>
                </Card>
              ))}
              <Button variant="secondary" icon={Plus} label="Add Day" onPress={() => setDays([...days, { id: Date.now(), title: 'New Day', desc: '' }])} />
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Stay & Transport" />
              <View style={{ gap: s.s3 }}>
                 <Text style={[theme.typography.subhead, { color: theme.colors.text.primary }]}>Hotels</Text>
                 {hotels.map(h => (
                   <Card key={h.id} style={{ padding: s.s3 }}>
                     <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>{h.name}</Text>
                     <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary, marginTop: 4 }]}>{h.nights} Nights • {h.room}</Text>
                   </Card>
                 ))}
                 <Button variant="secondary" label="Add Hotel" onPress={() => {}} />
              </View>

              <View style={{ gap: s.s3, marginTop: s.s4 }}>
                 <Text style={[theme.typography.subhead, { color: theme.colors.text.primary }]}>Transport</Text>
                 <Input label="Vehicle Type" value="" onChangeText={() => {}} placeholder="e.g. Sedan AC" />
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Pricing" />
              <View style={{ backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.md, padding: s.s4, gap: s.s3 }}>
                 <CurrencyField label="Per Room Price" value="" onChangeText={() => {}} placeholder="45000" />
                 <Input label="GST %" value="" onChangeText={() => {}} placeholder="5" keyboardType="numeric" />
              </View>
              <SectionHeader title="Inclusions & Exclusions" />
              <Button variant="secondary" label="Edit Inclusions" onPress={() => {}} />
              <Button variant="secondary" label="Edit Exclusions" onPress={() => {}} />
            </View>
          )}

          {step === 4 && (
            <View style={{ gap: s.s4, flex: 1 }}>
              <SectionHeader title="Preview & Send" />
              <Input label="Template" value="Honeymoon Special" onChangeText={() => {}} />
              
              {/* WebView Placeholder */}
              <View style={{ width: '100%', height: 400, backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border.hairline }}>
                 <Text style={[theme.typography.title3, { color: theme.colors.text.secondary }]}>PDF Render Preview</Text>
                 <Text style={[theme.typography.subhead, { color: theme.colors.text.tertiary, marginTop: s.s2 }]}>Handlebars Template</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderTopWidth: 1, borderTopColor: theme.colors.border.hairline }}>
        <Button 
          variant="primary" 
          label={step === 4 ? "Send Itinerary" : "Next"} 
          fullWidth 
          onPress={handleNext} 
        />
      </View>
    </SafeAreaView>
  );
}
