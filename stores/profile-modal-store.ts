import { create } from 'zustand';

interface ProfileModalState {
  isOpen: boolean;
  tableName: string | null;
  schema: string | undefined;
  recordId: string | number | null;
  openModal: (tableName: string, recordId: string | number, schema?: string) => void;
  closeModal: () => void;
}

export const useProfileModalStore = create<ProfileModalState>((set) => ({
  isOpen: false,
  tableName: null,
  schema: undefined,
  recordId: null,
  openModal: (tableName, recordId, schema) =>
    set({ isOpen: true, tableName, recordId, schema }),
  closeModal: () => set({ isOpen: false, tableName: null, recordId: null, schema: undefined }),
}));

