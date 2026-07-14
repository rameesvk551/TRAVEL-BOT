// FILE: mobile/src/features/hrm/screens/HRMScreen.tsx
// Attendance + leave, wired to the real HRM API. The punch is the headline:
// it captures GPS and REQUIRES it — no location, no punch.

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { CalendarDays, LogIn, LogOut, Plus, X } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  MetricCard, SectionHeader, ListRow, Card, Badge, Skeleton, EmptyState, ErrorState,
  Avatar, Button, Input, Switch, Segmented, BarChart, showToast,
} from '../../../ui';
import { getAuthState } from '../../../hooks/useAuth';
import { PunchGate, LocationNotice } from '../PunchGate';
import {
  useMySpace, useMyTimesheet, useMyLeaves, useLeaveTypes, usePunch, usePunchLocation,
  useRequestLeave, useCancelMyLeave, useTeamLeaves, useReviewLeave, apiErrorMessage,
  Attendance, LeaveRequest, LeaveStatus, LeaveBalance,
} from '../api';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtTime(value: string | null | undefined): string {
  if (!value) return '—';
  return format(new Date(value), 'h:mm a');
}

function fmtDay(value: string): string {
  try {
    return format(parseISO(value), 'd MMM');
  } catch {
    return value;
  }
}

function minutesToHours(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

const LEAVE_BADGE: Record<LeaveStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROVED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function HRMScreen(_props: any) {
  const { theme } = useTheme();
  const s = theme.spacing;

  const { agent } = getAuthState();
  const canManage: boolean =
    agent?.role === 'ADMIN' || Boolean(agent?.permissions?.includes?.('hrm.manage'));

  const mySpace = useMySpace();
  const timesheet = useMyTimesheet();
  const myLeaves = useMyLeaves();
  const teamLeaves = useTeamLeaves('PENDING', { enabled: canManage });

  const { punchIn, punchOut } = usePunch();
  const punchLocation = usePunchLocation();
  const cancelLeave = useCancelMyLeave();
  const review = useReviewLeave();

  const [leaveFormOpen, setLeaveFormOpen] = useState(false);

  const today: Attendance | null = mySpace.data?.today ?? null;
  const hasIn = Boolean(today?.punchInAt);
  const hasOut = Boolean(today?.punchOutAt);
  const punching = punchIn.isPending || punchOut.isPending;
  const locationReady = punchLocation.status === 'ready' && !!punchLocation.location;

  // Worked hours over the last 7 recorded days — real attendance, no pie charts.
  const workedBars = useMemo(() => {
    const rows = (timesheet.data?.attendance || []).filter((a) => a.workedMinutes != null);
    return rows.slice(-7).map((a) => ({
      label: fmtDay(a.date),
      value: Math.round(((a.workedMinutes as number) / 60) * 10) / 10,
    }));
  }, [timesheet.data]);

  const refreshAll = () => {
    mySpace.refetch();
    timesheet.refetch();
    myLeaves.refetch();
    if (canManage) teamLeaves.refetch();
  };

  const doPunch = (direction: 'in' | 'out') => {
    const mutation = direction === 'in' ? punchIn : punchOut;
    mutation.mutate(undefined, {
      onSuccess: () =>
        showToast(direction === 'in' ? 'Punched in — have a great day!' : 'Punched out. See you tomorrow!', 'success'),
      onError: (err) => showToast(apiErrorMessage(err, 'Could not record punch'), 'error'),
    });
  };

  const loading = mySpace.isLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary }]}>Attendance</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={mySpace.isRefetching} onRefresh={refreshAll} tintColor={theme.colors.accent} />
        }
      >
        {mySpace.isError ? (
          <View style={{ paddingHorizontal: s.s4 }}>
            <ErrorState
              message={apiErrorMessage(mySpace.error, 'Could not load your attendance.')}
              onRetry={() => mySpace.refetch()}
            />
          </View>
        ) : loading ? (
          <View style={{ paddingHorizontal: s.s4, gap: s.s4 }}>
            <Skeleton height={190} />
            <Skeleton height={72} />
            <Skeleton height={72} />
          </View>
        ) : (
          <>
            {/* ---------------- Punch card ---------------- */}
            <View style={{ paddingHorizontal: s.s4 }}>
              <Card>
                <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>
                  {format(new Date(), 'EEEE, d MMMM').toUpperCase()}
                </Text>

                <View style={{ flexDirection: 'row', marginTop: s.s3, gap: s.s4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>PUNCH IN</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.s2, marginTop: s.s1 }}>
                      <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
                        {fmtTime(today?.punchInAt)}
                      </Text>
                      {today?.isLate ? <Badge label="Late" variant="danger" /> : null}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>PUNCH OUT</Text>
                    <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginTop: s.s1 }]}>
                      {fmtTime(today?.punchOutAt)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>STATUS</Text>
                    <View style={{ marginTop: s.s1, alignItems: 'flex-start' }}>
                      <Badge
                        label={(today?.status || 'ABSENT').replace('_', ' ')}
                        variant={today?.status === 'PRESENT' ? 'success' : today?.status === 'HALF_DAY' ? 'warning' : 'neutral'}
                      />
                    </View>
                  </View>
                </View>

                {/* Location is shown BEFORE the punch is confirmed. */}
                <View style={{ marginTop: s.s4 }}>
                  <LocationNotice
                    status={punchLocation.status}
                    error={punchLocation.error}
                    lat={punchLocation.location?.lat}
                    lng={punchLocation.location?.lng}
                    accuracy={punchLocation.location?.accuracy}
                    onRetry={punchLocation.refresh}
                    isResolving={punchLocation.isResolving}
                  />
                </View>

                <View style={{ marginTop: s.s4 }}>
                  {!hasIn && (
                    <Button
                      variant="primary"
                      label={locationReady ? 'Punch In' : 'Location required'}
                      icon={LogIn}
                      fullWidth
                      loading={punchIn.isPending}
                      disabled={!locationReady || punching}
                      onPress={() => doPunch('in')}
                      accessibilityLabel="Punch in with your current location"
                      accessibilityHint={
                        locationReady ? 'Records your clock-in time and location' : 'Disabled until your location can be read'
                      }
                    />
                  )}
                  {hasIn && !hasOut && (
                    <Button
                      variant="secondary"
                      label={locationReady ? 'Punch Out' : 'Location required'}
                      icon={LogOut}
                      fullWidth
                      loading={punchOut.isPending}
                      disabled={!locationReady || punching}
                      onPress={() => doPunch('out')}
                      accessibilityLabel="Punch out with your current location"
                      accessibilityHint={
                        locationReady ? 'Records your clock-out time and location' : 'Disabled until your location can be read'
                      }
                    />
                  )}
                  {hasIn && hasOut && (
                    <View
                      style={{
                        backgroundColor: theme.colors.bg.fill,
                        borderRadius: theme.radius.md,
                        paddingVertical: s.s3,
                        alignItems: 'center',
                      }}
                      accessibilityRole="text"
                      accessibilityLabel={`Day complete. ${minutesToHours(today?.workedMinutes)} worked.`}
                    >
                      <Text style={[theme.typography.subhead, { color: theme.colors.status.success }]}>
                        Day complete · {minutesToHours(today?.workedMinutes)} worked
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            </View>

            {/* ---------------- Leave balances ---------------- */}
            <View style={{ paddingHorizontal: s.s4, marginTop: s.s6 }}>
              <SectionHeader title="Leave balance" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
                <View style={{ width: '48%' }}>
                  <MetricCard label="Pending requests" value={mySpace.data?.pendingLeaves ?? 0} />
                </View>
                {(mySpace.data?.balances || []).slice(0, 3).map((b: LeaveBalance) => (
                  <View key={b.leaveTypeId} style={{ width: '48%' }}>
                    <MetricCard label={b.name} value={b.balance === null ? '∞' : `${b.balance} / ${b.quota}`} />
                  </View>
                ))}
              </View>
            </View>

            {/* ---------------- Worked hours ---------------- */}
            {workedBars.length > 0 && (
              <View style={{ paddingHorizontal: s.s4, marginTop: s.s6 }}>
                <SectionHeader title="Hours worked" />
                <Card>
                  <BarChart data={workedBars} variant="nominal" formatValue={(v) => `${v}h`} />
                </Card>
              </View>
            )}

            {/* ---------------- My leave requests ---------------- */}
            <View style={{ paddingHorizontal: s.s4, marginTop: s.s6 }}>
              <SectionHeader title="My leave" action="Request" onAction={() => setLeaveFormOpen(true)} />
              {myLeaves.isError ? (
                <ErrorState
                  message={apiErrorMessage(myLeaves.error, 'Could not load your leave requests.')}
                  onRetry={() => myLeaves.refetch()}
                />
              ) : myLeaves.isLoading ? (
                <View style={{ gap: s.s3 }}>
                  <Skeleton height={72} />
                  <Skeleton height={72} />
                </View>
              ) : !myLeaves.data?.length ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No leave requests"
                  message="Request time off and track approvals here."
                  actionLabel="Request leave"
                  onAction={() => setLeaveFormOpen(true)}
                />
              ) : (
                <View style={{ gap: s.s3 }}>
                  {myLeaves.data.map((lr: LeaveRequest) => (
                    <Card key={lr.id} style={{ padding: 0, overflow: 'hidden' }}>
                      <ListRow
                        title={lr.leaveType?.name || 'Leave'}
                        subtitle={`${fmtDay(lr.startDate)} → ${fmtDay(lr.endDate)} · ${Number(lr.dayCount)} day${Number(lr.dayCount) === 1 ? '' : 's'}`}
                        trailing={
                          <View style={{ alignItems: 'flex-end', gap: s.s1 }}>
                            <Badge label={lr.status} variant={LEAVE_BADGE[lr.status]} />
                            {lr.status === 'PENDING' && (
                              <Button
                                variant="plain"
                                label="Cancel"
                                loading={cancelLeave.isPending}
                                onPress={() =>
                                  cancelLeave.mutate(lr.id, {
                                    onSuccess: () => showToast('Request cancelled', 'success'),
                                    onError: (err) => showToast(apiErrorMessage(err, 'Could not cancel'), 'error'),
                                  })
                                }
                                accessibilityLabel={`Cancel ${lr.leaveType?.name || 'leave'} request`}
                              />
                            )}
                          </View>
                        }
                      />
                    </Card>
                  ))}
                </View>
              )}
            </View>

            {/* ---------------- Approvals (managers) ---------------- */}
            {canManage && (
              <View style={{ paddingHorizontal: s.s4, marginTop: s.s6 }}>
                <SectionHeader title="Pending approvals" />
                {teamLeaves.isError ? (
                  <ErrorState
                    message={apiErrorMessage(teamLeaves.error, 'Could not load leave requests.')}
                    onRetry={() => teamLeaves.refetch()}
                  />
                ) : teamLeaves.isLoading ? (
                  <Skeleton height={72} />
                ) : !teamLeaves.data?.length ? (
                  <EmptyState icon={CalendarDays} title="All clear" message="No leave requests waiting on you." />
                ) : (
                  <View style={{ gap: s.s3 }}>
                    {teamLeaves.data.map((lr: LeaveRequest) => (
                      <Card key={lr.id} style={{ padding: 0, overflow: 'hidden' }}>
                        <ListRow
                          leading={<Avatar name={lr.agent?.name} />}
                          title={lr.agent?.name || 'Employee'}
                          subtitle={`${lr.leaveType?.name || 'Leave'} · ${fmtDay(lr.startDate)} → ${fmtDay(lr.endDate)} · ${Number(lr.dayCount)}d`}
                        />
                        <View style={{ flexDirection: 'row', gap: s.s2, paddingHorizontal: s.s4, paddingBottom: s.s3 }}>
                          <View style={{ flex: 1 }}>
                            <Button
                              variant="primary"
                              label="Approve"
                              fullWidth
                              loading={review.isPending}
                              onPress={() =>
                                review.mutate(
                                  { id: lr.id, decision: 'approve' },
                                  {
                                    onSuccess: () => showToast('Leave approved', 'success'),
                                    onError: (err) => showToast(apiErrorMessage(err, 'Could not approve'), 'error'),
                                  },
                                )
                              }
                              accessibilityLabel={`Approve leave for ${lr.agent?.name || 'employee'}`}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Button
                              variant="destructive"
                              label="Reject"
                              fullWidth
                              loading={review.isPending}
                              onPress={() =>
                                review.mutate(
                                  { id: lr.id, decision: 'reject' },
                                  {
                                    onSuccess: () => showToast('Leave rejected', 'success'),
                                    onError: (err) => showToast(apiErrorMessage(err, 'Could not reject'), 'error'),
                                  },
                                )
                              }
                              accessibilityLabel={`Reject leave for ${lr.agent?.name || 'employee'}`}
                            />
                          </View>
                        </View>
                      </Card>
                    ))}
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <RequestLeaveSheet open={leaveFormOpen} onClose={() => setLeaveFormOpen(false)} />

      {/* Force-punch-in gate. Mount in AppNavigator to gate the whole app. */}
      <PunchGate />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Request leave — real validation, real mutation, server errors surfaced
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const leaveSchema = z
  .object({
    leaveTypeId: z.string().min(1, 'Pick a leave type'),
    startDate: z.string().regex(DATE_RE, 'Use YYYY-MM-DD'),
    endDate: z.string().regex(DATE_RE, 'Use YYYY-MM-DD'),
    isHalfDay: z.boolean(),
    reason: z.string().max(500, 'Keep it under 500 characters').optional(),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ['endDate'], message: 'End date cannot be before the start date' })
  .refine((v) => !v.isHalfDay || v.startDate === v.endDate, {
    path: ['endDate'],
    message: 'A half day must start and end on the same date',
  });

type LeaveFormValues = z.infer<typeof leaveSchema>;

function RequestLeaveSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const s = theme.spacing;
  const leaveTypes = useLeaveTypes({ activeOnly: true });
  const requestLeave = useRequestLeave();
  const [serverError, setServerError] = useState<string | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { leaveTypeId: '', startDate: todayStr, endDate: todayStr, isHalfDay: false, reason: '' },
  });

  const selectedTypeId = watch('leaveTypeId');
  const isHalfDay = watch('isHalfDay');
  const types = leaveTypes.data || [];
  const typeIndex = Math.max(0, types.findIndex((t) => t.id === selectedTypeId));

  // Default to the first leave type once they load.
  React.useEffect(() => {
    if (open && types.length && !selectedTypeId) setValue('leaveTypeId', types[0].id);
  }, [open, types, selectedTypeId, setValue]);

  const close = () => {
    setServerError(null);
    reset({ leaveTypeId: '', startDate: todayStr, endDate: todayStr, isHalfDay: false, reason: '' });
    onClose();
  };

  const onSubmit = (values: LeaveFormValues) => {
    setServerError(null);
    requestLeave.mutate(
      {
        leaveTypeId: values.leaveTypeId,
        startDate: values.startDate,
        endDate: values.isHalfDay ? values.startDate : values.endDate,
        isHalfDay: values.isHalfDay,
        reason: values.reason?.trim() || undefined,
      },
      {
        onSuccess: () => {
          showToast('Leave request submitted', 'success');
          close();
        },
        onError: (err) => setServerError(apiErrorMessage(err, 'Could not submit your request')),
      },
    );
  };

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
          <Button variant="icon" icon={X} onPress={close} accessibilityLabel="Close leave request form" />
          <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>
            Request leave
          </Text>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 40 }}>
            {serverError && (
              <View style={{ marginBottom: s.s4 }}>
                <ErrorState message={serverError} onRetry={handleSubmit(onSubmit)} />
              </View>
            )}

            <SectionHeader title="Leave type" />
            {leaveTypes.isLoading ? (
              <Skeleton height={44} />
            ) : types.length ? (
              <Segmented
                segments={types.slice(0, 4).map((t) => t.code || t.name)}
                selectedIndex={typeIndex}
                onChange={(i) => setValue('leaveTypeId', types[i].id, { shouldValidate: true })}
              />
            ) : (
              <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}>
                No leave types configured.
              </Text>
            )}
            {errors.leaveTypeId && (
              <Text style={[theme.typography.caption, { color: theme.colors.status.danger, marginTop: s.s1 }]}>
                {errors.leaveTypeId.message}
              </Text>
            )}

            <View style={{ marginTop: s.s5 }}>
              <SectionHeader title="Dates" />
              <Controller
                control={control}
                name="isHalfDay"
                render={({ field: { value, onChange } }) => (
                  <Switch label="Half day" value={value} onValueChange={onChange} />
                )}
              />
              <View style={{ marginTop: s.s3 }}>
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <Input
                      label="From (YYYY-MM-DD)"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="2026-07-20"
                      keyboardType="numbers-and-punctuation"
                      autoCapitalize="none"
                      error={errors.startDate?.message}
                      accessibilityLabel="Leave start date"
                    />
                  )}
                />
                {!isHalfDay && (
                  <Controller
                    control={control}
                    name="endDate"
                    render={({ field: { value, onChange, onBlur } }) => (
                      <Input
                        label="To (YYYY-MM-DD)"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="2026-07-22"
                        keyboardType="numbers-and-punctuation"
                        autoCapitalize="none"
                        error={errors.endDate?.message}
                        accessibilityLabel="Leave end date"
                      />
                    )}
                  />
                )}
              </View>
            </View>

            <View style={{ marginTop: s.s5 }}>
              <SectionHeader title="Reason" />
              <Controller
                control={control}
                name="reason"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    label="Optional — helps your manager decide faster"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Family function"
                    multiline
                    error={errors.reason?.message}
                    accessibilityLabel="Reason for leave"
                  />
                )}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View
          style={{
            padding: s.s4,
            backgroundColor: theme.colors.bg.surface,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border.hairline,
          }}
        >
          <Button
            variant="primary"
            label="Submit request"
            fullWidth
            loading={requestLeave.isPending}
            disabled={requestLeave.isPending}
            onPress={handleSubmit(onSubmit)}
            icon={Plus}
            accessibilityLabel="Submit leave request"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
