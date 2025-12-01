import { DatabaseConnection } from './database';
import { AISchemaAnalysis, Relationship } from './schema';

export interface SchemaConfig {
  selectedSchemas?: string[];
  selectedTables?: string[];
  showAll: boolean;
}

export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export interface UIPreferences {
  hiddenColumns: Record<string, string[]>; // table -> column names
  columnOrder: Record<string, string[]>; // table -> ordered column names
  defaultSorts: Record<string, SortConfig[]>; // table -> sort configs
}

export interface ConnectionConfig extends DatabaseConnection {
  schemaConfig: SchemaConfig;
  aiAnalysis?: AISchemaAnalysis;
  uiPreferences: UIPreferences;
  aiApiKey?: string; // User-provided API key if not in env
}

export interface AppConfig {
  connections: ConnectionConfig[];
  activeConnectionId?: string;
  globalApiKey?: string; // Global API key saved separately from connections
}

export interface ExportConfig extends AppConfig {
  version: string;
  exportedAt: string;
}

