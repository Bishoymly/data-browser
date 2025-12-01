import { create } from 'zustand';
import { ConnectionConfig } from '@/types/config';
import { ConfigStorage } from '@/lib/config/storage';

interface ConnectionState {
  connections: ConnectionConfig[];
  activeConnectionId: string | undefined;
  setConnections: (connections: ConnectionConfig[]) => void;
  addConnection: (connection: ConnectionConfig) => void;
  updateConnection: (id: string, updates: Partial<ConnectionConfig>) => void;
  deleteConnection: (id: string) => void;
  setActiveConnection: (id: string | undefined) => void;
  getActiveConnection: () => ConnectionConfig | null;
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeConnectionId: undefined,

  setConnections: (connections) => set({ connections }),

  addConnection: (connection) => {
    const { connections } = get();
    set({ connections: [...connections, connection] });
    get().saveToStorage();
  },

  updateConnection: (id, updates) => {
    const { connections } = get();
    set({
      connections: connections.map((conn) =>
        conn.id === id ? { ...conn, ...updates } : conn
      ),
    });
    get().saveToStorage();
  },

  deleteConnection: (id) => {
    const { connections, activeConnectionId } = get();
    const newConnections = connections.filter((conn) => conn.id !== id);
    set({
      connections: newConnections,
      activeConnectionId:
        activeConnectionId === id
          ? newConnections[0]?.id
          : activeConnectionId,
    });
    get().saveToStorage();
  },

  setActiveConnection: (id) => {
    set({ activeConnectionId: id });
    get().saveToStorage();
  },

  getActiveConnection: () => {
    const { connections, activeConnectionId } = get();
    if (!activeConnectionId) {
      return null;
    }
    return connections.find((conn) => conn.id === activeConnectionId) || null;
  },

  loadFromStorage: () => {
    const config = ConfigStorage.get();
    if (config) {
      set({
        connections: config.connections,
        activeConnectionId: config.activeConnectionId,
      });
    }
  },

  saveToStorage: () => {
    const { connections, activeConnectionId } = get();
    console.log('Saving to storage from store:', {
      connectionsCount: connections.length,
      activeConnectionId,
    });
    ConfigStorage.set({
      connections,
      activeConnectionId,
    });
  },
}));

