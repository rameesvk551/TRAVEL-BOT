// FILE: mobile/src/features/campaigns/screens/CampaignFormScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, Segmented, SectionHeader, ProgressBar, Switch, ListRow } from '../../../ui';
import { ArrowLeft, Users, Mail } from 'lucide-react-native';

export function CampaignFormScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [step, setStep] = useState(0); // 0: Basics, 1: Audience, 2: Content, 3: Schedule
  
  const [type, setType] = useState(0); // 0: WhatsApp, 1: Email
  const [sendNow, setSendNow] = useState(true);

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
              <SectionHeader title="Campaign Basics" />
              <Input label="Campaign Name" value="" onChangeText={() => {}} placeholder="e.g. Diwali Special" />
              <View>
                <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: s.s2 }]}>Channel</Text>
                <Segmented segments={['WhatsApp', 'Email']} selectedIndex={type} onChange={setType} />
              </View>
            </View>
          )}

          {step === 1 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Audience Selection" />
              <View style={{ backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.md, overflow: 'hidden' }}>
                 <ListRow leading={<Users size={20} color={theme.colors.text.tertiary}/>} title="All Customers" subtitle="1,500 contacts" />
                 <View style={{ height: 1, backgroundColor: theme.colors.border.hairline, marginLeft: 56 }} />
                 <ListRow leading={<Users size={20} color={theme.colors.text.tertiary}/>} title="Hot Leads" subtitle="120 contacts" />
              </View>
              <Button variant="secondary" label="Create New Segment" onPress={() => {}} />
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Content" />
              <Button variant="secondary" icon={Mail} label="Select Template" onPress={() => {}} />
              <View style={{ marginTop: s.s4 }}>
                <Input label="Message Preview" value="Hi {{name}},\n\nSpecial offer..." onChangeText={() => {}} multiline />
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Schedule" />
              <Switch label="Send Immediately" value={sendNow} onValueChange={setSendNow} />
              {!sendNow && (
                 <View style={{ gap: s.s3 }}>
                    <Input label="Date" value="" onChangeText={() => {}} placeholder="YYYY-MM-DD" />
                    <Input label="Time" value="" onChangeText={() => {}} placeholder="HH:MM" />
                 </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderTopWidth: 1, borderTopColor: theme.colors.border.hairline }}>
        <Button 
          variant="primary" 
          label={step === 3 ? (sendNow ? "Send Now" : "Schedule") : "Next"} 
          fullWidth 
          onPress={handleNext} 
        />
      </View>
    </SafeAreaView>
  );
}
