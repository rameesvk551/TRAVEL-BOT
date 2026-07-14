// FILE: mobile/src/ui/charts/AreaChart.tsx
// Trend over time, single series → area. One hue (the accent), no legend: the
// section title names the series. Touch-scrub stands in for the desktop hover
// crosshair. Y domain is anchored to zero so the filled area can't exaggerate.

import React, { useMemo, useState } from 'react';
import { View, Text, PanResponder, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

export interface AreaPoint {
  label: string;
  value: number;
}

export interface AreaChartProps {
  data: AreaPoint[];
  height?: number;
  /** Formats values for the y-axis, the scrub readout, and the a11y summary. */
  formatValue?: (v: number) => string;
  /** Screen-reader summary. Defaults to a first→last narration of the series. */
  accessibilityLabel?: string;
}

const PLOT_PAD_LEFT = 44;   // room for y labels
const PLOT_PAD_RIGHT = 8;
const PLOT_PAD_TOP = 16;    // room for the scrub dot's ring
const AXIS_BAND = 20;       // x labels live here, INSIDE `height` — never clipped

/** Monotone-cubic path. Smooths the line without overshooting real data points. */
function buildPath(pts: { x: number; y: number }[], closeToY?: number): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) {
    const p = pts[0];
    return closeToY == null ? `M${p.x},${p.y}` : `M${p.x},${closeToY}L${p.x},${p.y}`;
  }

  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
  }

  if (closeToY != null) {
    d += ` L${pts[pts.length - 1].x},${closeToY} L${pts[0].x},${closeToY} Z`;
  }
  return d;
}

export function AreaChart({
  data,
  height = 180,
  formatValue = (v) => String(Math.round(v)),
  accessibilityLabel,
}: AreaChartProps) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const plotW = Math.max(0, width - PLOT_PAD_LEFT - PLOT_PAD_RIGHT);
  const plotH = Math.max(0, height - PLOT_PAD_TOP - AXIS_BAND);

  const { points, yMax, maxIndex } = useMemo(() => {
    if (data.length === 0 || plotW <= 0) {
      return { points: [] as { x: number; y: number }[], yMax: 0, maxIndex: -1 };
    }

    const peak = Math.max(...data.map((d) => d.value), 0);
    // Anchor at zero and add ~10% headroom so the peak isn't flush with the top.
    const max = peak === 0 ? 1 : peak * 1.1;
    const step = data.length === 1 ? 0 : plotW / (data.length - 1);

    return {
      points: data.map((d, i) => ({
        x: PLOT_PAD_LEFT + (data.length === 1 ? plotW / 2 : i * step),
        y: PLOT_PAD_TOP + plotH - (d.value / max) * plotH,
      })),
      yMax: max,
      maxIndex: data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0),
    };
  }, [data, plotW, plotH]);

  const baselineY = PLOT_PAD_TOP + plotH;

  // Touch scrub — the mobile equivalent of a hover crosshair.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => locate(e.nativeEvent.locationX),
        onPanResponderMove: (e) => locate(e.nativeEvent.locationX),
        onPanResponderRelease: () => setScrubIndex(null),
        onPanResponderTerminate: () => setScrubIndex(null),
      }),
    [points],
  );

  function locate(x: number) {
    if (points.length === 0) return;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - x);
      if (dist < best) {
        best = dist;
        nearest = i;
      }
    });
    setScrubIndex(nearest);
  }

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const summary =
    accessibilityLabel ??
    (data.length
      ? `Trend chart, ${data.length} points, from ${formatValue(data[0].value)} to ${formatValue(
          data[data.length - 1].value,
        )}. Peak ${formatValue(data[maxIndex]?.value ?? 0)} at ${data[maxIndex]?.label}.`
      : 'Trend chart, no data');

  if (data.length === 0) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={[theme.typography.footnote, { color: theme.colors.text.tertiary }]}>No data yet</Text>
      </View>
    );
  }

  // X labels: first / middle / last only. Anything denser collides on a phone.
  const labelIdx = data.length <= 3
    ? data.map((_, i) => i)
    : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  const active = scrubIndex != null ? points[scrubIndex] : null;

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={summary}>
      <View {...panResponder.panHandlers}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.colors.accent} stopOpacity={theme.dark ? 0.34 : 0.24} />
                <Stop offset="1" stopColor={theme.colors.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* Gridlines — solid and recessive. Never dashed. */}
            {[0, 0.5, 1].map((t) => {
              const y = PLOT_PAD_TOP + plotH * t;
              return (
                <Line
                  key={t}
                  x1={PLOT_PAD_LEFT}
                  y1={y}
                  x2={PLOT_PAD_LEFT + plotW}
                  y2={y}
                  stroke={theme.colors.chart.grid}
                  strokeWidth={1}
                />
              );
            })}

            <Path d={buildPath(points, baselineY)} fill="url(#areaFill)" />
            <Path
              d={buildPath(points)}
              stroke={theme.colors.accent}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Selective direct label: the peak gets a marker, nothing else does. */}
            {maxIndex >= 0 && !active && (
              <Circle
                cx={points[maxIndex].x}
                cy={points[maxIndex].y}
                r={4}
                fill={theme.colors.accent}
                stroke={theme.colors.bg.surface}
                strokeWidth={2}
              />
            )}

            {active && (
              <>
                <Line
                  x1={active.x}
                  y1={PLOT_PAD_TOP}
                  x2={active.x}
                  y2={baselineY}
                  stroke={theme.colors.chart.axis}
                  strokeWidth={1}
                />
                {/* 2px surface ring so the dot stays legible over the fill. */}
                <Circle
                  cx={active.x}
                  cy={active.y}
                  r={5}
                  fill={theme.colors.accent}
                  stroke={theme.colors.bg.surface}
                  strokeWidth={2}
                />
              </>
            )}

            {/* Transparent hit surface — bigger than the marks, per interaction spec. */}
            <Rect x={0} y={0} width={width} height={height} fill="transparent" />
          </Svg>
        )}
      </View>

      {/* Y labels and X labels are RN Text (not SvgText) so they inherit Dynamic Type. */}
      {width > 0 && (
        <>
          {[1, 0.5, 0].map((t, i) => (
            <Text
              key={i}
              style={[
                theme.typography.caption2,
                {
                  position: 'absolute',
                  left: 0,
                  width: PLOT_PAD_LEFT - 6,
                  textAlign: 'right',
                  color: theme.colors.text.tertiary,
                  top: PLOT_PAD_TOP + plotH * (1 - t) - 6,
                  fontVariant: ['tabular-nums'],
                },
              ]}
            >
              {formatValue(yMax * t)}
            </Text>
          ))}

          {labelIdx.map((i) => (
            <Text
              key={i}
              style={[
                theme.typography.caption2,
                {
                  position: 'absolute',
                  top: height - AXIS_BAND + 2,
                  left: points[i].x - 24,
                  width: 48,
                  textAlign: 'center',
                  color: theme.colors.text.tertiary,
                },
              ]}
            >
              {data[i].label}
            </Text>
          ))}

          {/* Scrub readout — value in text ink, not the series color. */}
          {active && scrubIndex != null && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: Math.min(Math.max(active.x - 50, PLOT_PAD_LEFT), width - 100),
                width: 100,
                alignItems: 'center',
                backgroundColor: theme.colors.bg.surfaceRaised,
                borderRadius: theme.radius.sm,
                paddingVertical: 2,
                ...theme.elevation.e1,
              }}
            >
              <Text
                style={[
                  theme.typography.caption2,
                  { color: theme.colors.text.primary, fontVariant: ['tabular-nums'] },
                ]}
              >
                {data[scrubIndex].label} · {formatValue(data[scrubIndex].value)}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}
