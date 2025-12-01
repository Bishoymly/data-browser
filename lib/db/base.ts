import { DatabaseConfig, DatabaseType } from '@/types/database';
import { SchemaMetadata, Table, Column } from '@/types/schema';

export interface QueryResult {
  rows: any[];
  columns: Column[];
  rowCount: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface FilterParams {
  column: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between' | 'in';
  value: any;
}

export interface SortParams {
  column: string;
  direction: 'asc' | 'desc';
}

export interface QueryOptions {
  filters?: FilterParams[];
  sorts?: SortParams[];
  pagination?: PaginationParams;
}

export abstract class DatabaseAdapter {
  protected config: DatabaseConfig;
  protected connection: any;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(): Promise<boolean>;
  
  abstract getSchemas(): Promise<string[]>;
  abstract getTables(schema?: string): Promise<Table[]>;
  abstract getColumns(table: string, schema?: string): Promise<Column[]>;
  abstract getRelationships(): Promise<SchemaMetadata['relationships']>;
  
  abstract executeQuery(sql: string, params?: Record<string, any>): Promise<QueryResult>;
  abstract getTableData(
    table: string,
    schema: string | undefined,
    options?: QueryOptions
  ): Promise<QueryResult>;
  
  abstract getSchemaMetadata(): Promise<SchemaMetadata>;
}

