import { AppConfig, ExportConfig } from '@/types/config';

export class ConfigImporter {
  static validate(data: any): data is ExportConfig {
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (!Array.isArray(data.connections)) {
      return false;
    }

    // Basic validation - can be expanded
    return true;
  }

  static import(data: ExportConfig | AppConfig): AppConfig {
    if (!this.validate(data)) {
      throw new Error('Invalid configuration format');
    }

    // Remove export metadata if present
    const { version, exportedAt, ...config } = data;

    return config as AppConfig;
  }

  static fromFile(file: File): Promise<AppConfig> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          const config = this.import(data);
          resolve(config);
        } catch (error) {
          reject(new Error('Failed to parse configuration file'));
        }
      };
      reader.onerror = () => {
        reject(new Error('Failed to read configuration file'));
      };
      reader.readAsText(file);
    });
  }

  static fromJSON(json: string): AppConfig {
    try {
      const data = JSON.parse(json);
      return this.import(data);
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  }
}

