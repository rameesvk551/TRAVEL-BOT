// FILE: mobile/src/ui/MetricCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Card } from './Card';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react-native';

export interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaDirection?: 'up' | 'down';
  onPress?: () => void;
}

export function MetricCard({ label, value, delta, deltaDirection, onPress }: MetricCardProps) {
  const { theme } = useTheme();

  const isPositive = deltaDirection === 'up' || (delta && delta > 0);
  const statusColor = isPositive ? theme.colors.status.success : theme.colors.status.danger;
  const DeltaIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <Card onPress={onPress} style={{ padding: theme.spacing.s3 }}>
      <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary, marginBottom: theme.spacing.s1, textTransform: 'uppercase' }]}>
        {label}
      </Text>
      <Text style={[theme.typography.title1, { color: theme.colors.text.primary, fontVariant: ['tabular-nums'] }]}>
        {value}
      </Text>
      {delta !== undefined && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.s1 }}>
          <View style={{ backgroundColor: statusColor + '20', borderRadius: theme.radius.sm, paddingHorizontal: 4, paddingVertical: 2, flexDirection: 'row', alignItems: 'center' }}>
            <DeltaIcon color={statusColor} size={12} />
            <Text style={[theme.typography.caption, { color: statusColor, marginLeft: 2, fontWeight: '600' }]}>
              {Math.abs(delta)}%
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
}
