import { AppConfig, ExportConfig } from '@/types/config';

export class ConfigExporter {
  static export(config: AppConfig): ExportConfig {
    return {
      ...config,
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
    };
  }

  static download(config: AppConfig, filename: string = 'data-browser-config.json'): void {
    const exportData = this.export(config);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static toJSON(config: AppConfig): string {
    return JSON.stringify(this.export(config), null, 2);
  }
}

