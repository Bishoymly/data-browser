import { create } from 'zustand';

interface UIState {
  showFriendlyNames: boolean;
  sidebarOpen: boolean;
  setShowFriendlyNames: (show: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  showFriendlyNames: true,
  sidebarOpen: true,

  setShowFriendlyNames: (show) => set({ showFriendlyNames: show }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));

