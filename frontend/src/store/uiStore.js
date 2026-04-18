// FILE: /frontend/src/store/uiStore.js
// DEPS: zustand

import { create } from 'zustand';

/**
 * UI store — manages sidebar, modals, and notification state.
 */
export const useUiStore = create((set) => ({
  sidebarOpen: false,          // mobile drawer open/close
  sidebarCollapsed: true,      // desktop collapsed (icons-only) mode
  activeChatCustomerId: null,
  chatPanelOpen: false,
  activeModal: null,
  modalData: null,
  notifications: [],

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  toggleSidebarCollapse: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  openChat: (customerId) =>
    set({ activeChatCustomerId: customerId, chatPanelOpen: true }),

  closeChat: () =>
    set({ activeChatCustomerId: null, chatPanelOpen: false }),

  openModal: (modal, data = null) =>
    set({ activeModal: modal, modalData: data }),

  closeModal: () =>
    set({ activeModal: null, modalData: null }),

  addNotification: (notification) =>
    set((s) => ({
      notifications: [
        { id: Date.now(), timestamp: new Date(), ...notification },
        ...s.notifications,
      ].slice(0, 50),
    })),

  clearNotifications: () => set({ notifications: [] }),
}));
