import { create } from 'zustand';
import { SchemaMetadata, AISchemaAnalysis } from '@/types/schema';

interface SchemaState {
  metadata: SchemaMetadata | null;
  aiAnalysis: AISchemaAnalysis | null;
  isLoading: boolean;
  error: string | null;
  setMetadata: (metadata: SchemaMetadata) => void;
  setAIAnalysis: (analysis: AISchemaAnalysis) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useSchemaStore = create<SchemaState>((set) => ({
  metadata: null,
  aiAnalysis: null,
  isLoading: false,
  error: null,

  setMetadata: (metadata) => set({ metadata }),
  setAIAnalysis: (analysis) => set({ aiAnalysis: analysis }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clear: () =>
    set({
      metadata: null,
      aiAnalysis: null,
      isLoading: false,
      error: null,
    }),
}));

