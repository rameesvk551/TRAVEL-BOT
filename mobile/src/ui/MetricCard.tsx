// FILE: mobile/src/ui/MetricCard.tsx
// The stat tile: value + delta + optional sparkline. This — not a one-bar bar
// chart — is the right form for a single headline number.

import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Card } from './Card';
import { Sparkline } from './charts/Sparkline';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react-native';

export interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaDirection?: 'up' | 'down';
  /** Recent values, oldest → newest. Renders a sparkline under the value. */
  trend?: number[];
  /** Set when a *rise* is bad (e.g. overdue count) so the delta colors correctly. */
  invertDelta?: boolean;
  onPress?: () => void;
}

export function MetricCard({
  label,
  value,
  delta,
  deltaDirection,
  trend,
  invertDelta = false,
  onPress,
}: MetricCardProps) {
  const { theme } = useTheme();

  // A flat delta is neither good nor bad — it must not render as danger red.
  const direction: 'up' | 'down' | 'flat' =
    deltaDirection ?? (delta == null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down');

  const isGood = invertDelta ? direction === 'down' : direction === 'up';

  const statusColor =
    direction === 'flat'
      ? theme.colors.status.neutral
      : isGood
        ? theme.colors.status.success
        : theme.colors.status.danger;

  const DeltaIcon = direction === 'flat' ? Minus : direction === 'up' ? ArrowUpRight : ArrowDownRight;

  const deltaText = delta != null ? `${Math.abs(delta)}%` : undefined;

  return (
    <Card
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        deltaText
          ? `${label}: ${value}, ${direction === 'flat' ? 'no change' : `${direction} ${deltaText}`}`
          : `${label}: ${value}`
      }
      style={{ padding: theme.spacing.s3 }}
    >
      <Text
        style={[
          theme.typography.caption2,
          { color: theme.colors.text.secondary, marginBottom: theme.spacing.s1, textTransform: 'uppercase' },
        ]}
      >
        {label}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Text
          style={[
            theme.typography.title1,
            { color: theme.colors.text.primary, fontVariant: ['tabular-nums'] },
          ]}
        >
          {value}
        </Text>
        {trend && trend.length > 1 && (
          <Sparkline values={trend} width={56} height={20} color={theme.colors.chart.categorical[0]} />
        )}
      </View>

      {delta !== undefined && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.s1 }}>
          <View
            style={{
              backgroundColor: theme.colors.bg.fill,
              borderRadius: theme.radius.sm,
              paddingHorizontal: 4,
              paddingVertical: 2,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            {/* Icon + text, never color alone — the delta stays readable under CVD. */}
            <DeltaIcon color={statusColor} size={12} />
            <Text style={[theme.typography.caption, { color: statusColor, marginLeft: 2, fontWeight: '600' }]}>
              {deltaText}
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
}
