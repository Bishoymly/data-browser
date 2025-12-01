import { AppConfig, ConnectionConfig } from '@/types/config';

const CONFIG_KEY = 'data_browser_config';

export class ConfigStorage {
  static get(): AppConfig | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      if (stored) {
        const config = JSON.parse(stored) as AppConfig;
        console.log('Config loaded from localStorage:', {
          connectionsCount: config.connections.length,
          activeConnectionId: config.activeConnectionId,
          key: CONFIG_KEY,
        });
        return config;
      } else {
        console.log('No config found in localStorage, key:', CONFIG_KEY);
      }
    } catch (error) {
      console.error('Error reading config from localStorage:', error);
    }

    return null;
  }

  static set(config: AppConfig): void {
    if (typeof window === 'undefined') {
      console.warn('ConfigStorage.set called on server side');
      return;
    }

    // Check if localStorage is available
    try {
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
    } catch (e) {
      console.error('localStorage is not available:', e);
      alert('localStorage is not available. Your settings cannot be saved. Please enable localStorage in your browser settings.');
      return;
    }

    try {
      const json = JSON.stringify(config);
      localStorage.setItem(CONFIG_KEY, json);
      
      // Verify it was saved
      const verify = localStorage.getItem(CONFIG_KEY);
      if (!verify) {
        console.error('Failed to verify save - localStorage item not found after save');
        throw new Error('Failed to save to localStorage');
      }
      
      console.log('Config saved to localStorage:', {
        connectionsCount: config.connections.length,
        activeConnectionId: config.activeConnectionId,
        key: CONFIG_KEY,
        dataSize: json.length,
      });
    } catch (error) {
      console.error('Error saving config to localStorage:', error);
      alert(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  static getConnection(id: string): ConnectionConfig | null {
    const config = this.get();
    if (!config) {
      return null;
    }

    return config.connections.find((conn) => conn.id === id) || null;
  }

  static addConnection(connection: ConnectionConfig): void {
    const config = this.get() || { connections: [] };
    config.connections.push(connection);
    this.set(config);
  }

  static updateConnection(id: string, updates: Partial<ConnectionConfig>): void {
    const config = this.get();
    if (!config) {
      return;
    }

    const index = config.connections.findIndex((conn) => conn.id === id);
    if (index !== -1) {
      config.connections[index] = { ...config.connections[index], ...updates };
      this.set(config);
    }
  }

  static deleteConnection(id: string): void {
    const config = this.get();
    if (!config) {
      return;
    }

    config.connections = config.connections.filter((conn) => conn.id !== id);
    if (config.activeConnectionId === id) {
      config.activeConnectionId = config.connections[0]?.id;
    }
    this.set(config);
  }

  static setActiveConnection(id: string | undefined): void {
    const config = this.get() || { connections: [] };
    config.activeConnectionId = id;
    this.set(config);
  }

  static clear(): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.removeItem(CONFIG_KEY);
  }

  static setGlobalApiKey(apiKey: string): void {
    const config = this.get() || { connections: [] };
    config.globalApiKey = apiKey;
    this.set(config);
    console.log('Global API key saved');
  }

  static getGlobalApiKey(): string | null {
    const config = this.get();
    return config?.globalApiKey || null;
  }
}

