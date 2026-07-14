// FILE: mobile/src/features/hrm/PunchGate.tsx
// Mandatory force-punch-in overlay. Mirrors frontend/src/components/PunchGate.jsx:
// blocks the app for HR-tracked staff who haven't clocked in yet on a working day.
// The server (GET /hrm/me → requiresPunchIn) has the final say; admins are exempt.
//
// Mount this once, high in the tree (e.g. inside AppNavigator), to gate the whole
// app. It is also rendered by HRMScreen so the gate exists today without touching
// navigation.

import React from 'react';
import { View, Text, Modal } from 'react-native';
import { MapPin, LogIn } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, showToast } from '../../ui';
import { getAuthState, useLogout } from '../../hooks/useAuth';
import api from '../../lib/api';
import { useMySpace, usePunch, usePunchLocation, apiErrorMessage } from './api';

export function PunchGate() {
  const { agent } = getAuthState();
  // Owner/admins are never trapped behind the punch wall.
  const eligible = Boolean(agent) && agent?.role !== 'ADMIN';

  const { data } = useMySpace({ enabled: eligible });

  // Only mount the overlay (and therefore only ask for GPS) when the server says
  // this user actually has to punch in. No gate, no location prompt.
  if (!eligible || !data?.requiresPunchIn) return null;

  return <PunchGateOverlay />;
}

function PunchGateOverlay() {
  const { theme } = useTheme();
  const s = theme.spacing;

  const { punchIn } = usePunch();
  const { location, status, error, refresh, isResolving } = usePunchLocation();
  const { mutate: logout, isPending: signingOut } = useLogout();

  const locationReady = status === 'ready' && !!location;

  const doPunchIn = () => {
    punchIn.mutate(undefined, {
      onSuccess: () => showToast('Punched in — have a great day!', 'success'),
      onError: (err) => showToast(apiErrorMessage(err, 'Could not punch in'), 'error'),
    });
  };

  const signOut = () => {
    logout(undefined, {
      onSettled: () => {
        // MMKV auth state is cleared by useLogout. This 401s and drives the
        // api client's auth-failure handler, which returns us to the Auth stack.
        api.get('/auth/me').catch(() => {});
      },
    });
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.bg.scrim,
          alignItems: 'center',
          justifyContent: 'center',
          padding: s.s4,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: theme.colors.bg.surface,
            borderRadius: theme.radius.xl,
            padding: s.s6,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.accentTint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MapPin size={28} color={theme.colors.accent} />
          </View>

          <Text style={[theme.typography.title3, { color: theme.colors.text.primary, marginTop: s.s4, textAlign: 'center' }]}>
            Punch in to continue
          </Text>
          <Text
            style={[
              theme.typography.subhead,
              { color: theme.colors.text.secondary, marginTop: s.s2, textAlign: 'center' },
            ]}
          >
            You need to clock in before using the app today. Your location is recorded with the punch.
          </Text>

          <View style={{ width: '100%', marginTop: s.s4 }}>
            <LocationNotice
              status={status}
              error={error}
              lat={location?.lat}
              lng={location?.lng}
              accuracy={location?.accuracy}
              onRetry={refresh}
              isResolving={isResolving}
            />
          </View>

          <View style={{ width: '100%', marginTop: s.s4 }}>
            <Button
              variant="primary"
              label={locationReady ? 'Punch In' : 'Location required'}
              icon={LogIn}
              fullWidth
              loading={punchIn.isPending}
              disabled={!locationReady || punchIn.isPending}
              onPress={doPunchIn}
              accessibilityLabel="Punch in with your current location"
              accessibilityHint={
                locationReady
                  ? 'Records your clock-in time and location'
                  : 'Disabled until your location can be read'
              }
            />
          </View>

          <View style={{ marginTop: s.s3 }}>
            <Button
              variant="plain"
              label="Sign out instead"
              loading={signingOut}
              onPress={signOut}
              accessibilityLabel="Sign out instead of punching in"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Shared location strip — shows the resolved fix (and accuracy) BEFORE the punch,
// or an explanation + retry when location is denied/unavailable.
// ---------------------------------------------------------------------------

export interface LocationNoticeProps {
  status: 'resolving' | 'ready' | 'denied' | 'unavailable';
  error: string | null;
  lat?: number;
  lng?: number;
  accuracy?: number;
  onRetry: () => void;
  isResolving: boolean;
}

export function LocationNotice({ status, error, lat, lng, accuracy, onRetry, isResolving }: LocationNoticeProps) {
  const { theme } = useTheme();
  const s = theme.spacing;
  const ready = status === 'ready' && lat != null && lng != null;

  const tone = ready
    ? theme.colors.status.success
    : status === 'resolving'
      ? theme.colors.text.secondary
      : theme.colors.status.danger;

  const message = ready
    ? `${lat!.toFixed(5)}, ${lng!.toFixed(5)}${accuracy != null ? ` · accurate to ±${accuracy} m` : ''}`
    : status === 'resolving'
      ? 'Finding your location…'
      : error || 'Location unavailable.';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s.s2,
        backgroundColor: theme.colors.bg.fill,
        borderRadius: theme.radius.md,
        paddingVertical: s.s3,
        paddingHorizontal: s.s3,
      }}
      accessibilityRole="text"
      accessibilityLabel={ready ? `Punch location ${message}` : `Location problem. ${message}`}
    >
      <MapPin size={16} color={tone} />
      <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, flex: 1 }]} numberOfLines={2}>
        {message}
      </Text>
      {status !== 'resolving' && !ready && (
        <Button
          variant="plain"
          label="Retry"
          onPress={onRetry}
          loading={isResolving}
          accessibilityLabel="Retry reading your location"
        />
      )}
    </View>
  );
}
