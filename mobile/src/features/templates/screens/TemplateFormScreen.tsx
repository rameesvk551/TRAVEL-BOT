// FILE: mobile/src/features/templates/screens/TemplateFormScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, Segmented, SectionHeader, Switch } from '../../../ui';
import { ArrowLeft, Save } from 'lucide-react-native';

export function TemplateFormScreen({ navigation }: any) {
  const { theme } = useTheme();
  
  const [channel, setChannel] = useState(0); // 0: WhatsApp, 1: Email
  const s = theme.spacing;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} />
        <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>Template</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
          <View style={{ gap: s.s4 }}>
            <SectionHeader title="Details" />
            <Input label="Name" value="" onChangeText={() => {}} placeholder="e.g. Diwali Offer" />
            <Input label="Category" value="" onChangeText={() => {}} placeholder="e.g. Marketing" />
            <View>
              <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: s.s2 }]}>Channel</Text>
              <Segmented segments={['WhatsApp', 'Email']} selectedIndex={channel} onChange={setChannel} />
            </View>

            <SectionHeader title="Content" />
            <Input label="Message Body" value="" onChangeText={() => {}} multiline placeholder="Use {{name}} for variables..." />
            
            <View style={{ backgroundColor: theme.colors.bg.surface, padding: s.s3, borderRadius: theme.radius.md }}>
               <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Available Variables: {"{{name}}"}, {"{{company}}"}, {"{{date}}"}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderTopWidth: 1, borderTopColor: theme.colors.border.hairline }}>
        <Button 
          variant="primary" 
          label="Submit for Approval" 
          fullWidth 
          onPress={() => navigation.goBack()} 
        />
      </View>
    </SafeAreaView>
  );
}
