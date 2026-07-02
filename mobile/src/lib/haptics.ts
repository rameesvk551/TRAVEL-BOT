// FILE: mobile/src/lib/haptics.ts
// Haptic feedback helpers (§6). Wraps expo-haptics with semantic intent.
// Respects Reduce Motion: haptics still fire (they're not visual motion),
// but the caller can check if needed.

import * as Haptics from 'expo-haptics';

/** Light impact — selection, filter toggle, chip press */
export function light() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Medium impact — primary submit, drag-drop land */
export function medium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Heavy impact — destructive confirm */
export function heavy() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Selection changed — segmented control, picker scroll */
export function selection() {
  Haptics.selectionAsync();
}

/** Success notification — action completed */
export function success() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Warning notification — attention needed */
export function warning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Error notification — action failed */
export function error() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
