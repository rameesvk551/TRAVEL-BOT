// FILE: mobile/src/features/automations/screens/FlowBuilderScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Card, SectionHeader, Input } from '../../../ui';
import { ArrowLeft, Zap, Mail, Plus, Clock } from 'lucide-react-native';

export function FlowBuilderScreen({ navigation }: any) {
  const { theme } = useTheme();
  
  const [nodes, setNodes] = useState([
    { id: 1, type: 'trigger', label: 'When Lead Created', icon: Zap },
    { id: 2, type: 'action', label: 'Send Welcome WhatsApp', icon: Mail },
    { id: 3, type: 'delay', label: 'Wait 2 Days', icon: Clock },
    { id: 4, type: 'action', label: 'Send Follow-up Email', icon: Mail },
  ]);

  const s = theme.spacing;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} />
        <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>Flow Builder</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
         <SectionHeader title="Settings" />
         <View style={{ marginBottom: s.s6 }}>
            <Input label="Automation Name" value="Welcome Flow" onChangeText={() => {}} />
         </View>

         <SectionHeader title="Visual Flow" />
         <View style={{ alignItems: 'center', gap: s.s3 }}>
            {nodes.map((node, index) => (
              <React.Fragment key={node.id}>
                <Card style={{ width: '80%', padding: s.s4, alignItems: 'center', backgroundColor: node.type === 'trigger' ? theme.colors.bg.surfaceRaised : theme.colors.bg.surface, borderColor: node.type === 'trigger' ? theme.colors.accent : 'transparent', borderWidth: 1 }}>
                   <node.icon size={24} color={node.type === 'trigger' ? theme.colors.accent : theme.colors.text.primary} />
                   <Text style={[theme.typography.subhead, { color: theme.colors.text.primary, marginTop: s.s2, textAlign: 'center' }]}>
                     {node.label}
                   </Text>
                </Card>
                {index < nodes.length - 1 && (
                  <View style={{ height: 24, width: 2, backgroundColor: theme.colors.border.hairline }} />
                )}
              </React.Fragment>
            ))}
            
            <View style={{ height: 24, width: 2, backgroundColor: theme.colors.border.hairline }} />
            
            <Button variant="secondary" icon={Plus} label="Add Step" onPress={() => {}} />
         </View>
      </ScrollView>

      <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderTopWidth: 1, borderTopColor: theme.colors.border.hairline }}>
        <Button 
          variant="primary" 
          label="Save & Activate" 
          fullWidth 
          onPress={() => navigation.goBack()} 
        />
      </View>
    </SafeAreaView>
  );
}
