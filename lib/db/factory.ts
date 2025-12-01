import { DatabaseType, DatabaseConfig } from '@/types/database';
import { DatabaseAdapter } from './base';
import { SQLServerAdapter } from './sqlserver';

export function createDatabaseAdapter(
  type: DatabaseType,
  config: DatabaseConfig
): DatabaseAdapter {
  switch (type) {
    case 'sqlserver':
      return new SQLServerAdapter(config);
    // Future: case 'postgresql': return new PostgreSQLAdapter(config);
    // Future: case 'mysql': return new MySQLAdapter(config);
    default:
      throw new Error(`Unsupported database type: ${type}`);
  }
}

