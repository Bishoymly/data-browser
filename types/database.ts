export type DatabaseType = 'sqlserver' | 'postgresql' | 'mysql';

export interface DatabaseConfig {
  server: string;
  database: string;
  username: string;
  password: string;
  port?: number;
  options?: Record<string, any>;
}

export interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  config: DatabaseConfig;
}

