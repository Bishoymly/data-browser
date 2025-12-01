import { DatabaseAdapter } from '@/lib/db/base';
import { SchemaMetadata, Table, Relationship } from '@/types/schema';

export class SchemaAnalyzer {
  constructor(private adapter: DatabaseAdapter) {}

  async analyze(): Promise<SchemaMetadata> {
    return await this.adapter.getSchemaMetadata();
  }

  async analyzeForSelectedTables(
    selectedTables?: string[],
    selectedSchemas?: string[]
  ): Promise<SchemaMetadata> {
    // Get all schemas
    const schemas = await this.adapter.getSchemas();
    
    // Filter schemas if specified
    const filteredSchemas = selectedSchemas 
      ? schemas.filter(s => selectedSchemas.includes(s))
      : schemas;

    // Get all tables (without columns yet)
    const allTables: Table[] = [];
    for (const schema of filteredSchemas) {
      const schemaTables = await this.adapter.getTables(schema);
      allTables.push(...schemaTables);
    }

    // Filter tables if specific tables are selected
    let tablesToProcess: Table[] = [];
    if (selectedTables && selectedTables.length > 0) {
      // Parse selected tables (format: "schema.table" or "table")
      const selectedTableMap = new Set(selectedTables);
      tablesToProcess = allTables.filter(table => {
        const key = table.schema ? `${table.schema}.${table.name}` : table.name;
        return selectedTableMap.has(key);
      });
    } else {
      // Process all tables in selected schemas
      tablesToProcess = allTables;
    }

    console.log(`Processing ${tablesToProcess.length} tables...`);

    // Now fetch columns only for selected tables
    const tablesWithColumns: Table[] = [];
    const totalTables = tablesToProcess.length;
    
    for (let i = 0; i < tablesToProcess.length; i++) {
      const table = tablesToProcess[i];
      try {
        const tableKey = table.schema ? `${table.schema}.${table.name}` : table.name;
        console.log(`[${i + 1}/${totalTables}] Fetching columns for ${tableKey}`);
        const columns = await this.adapter.getColumns(table.name, table.schema);
        console.log(`Found ${columns.length} columns in ${tableKey}`);
        tablesWithColumns.push({
          ...table,
          columns,
        });
      } catch (error: any) {
        console.error(`Error fetching columns for ${table.name}:`, error);
        // Continue with empty columns
        tablesWithColumns.push({
          ...table,
          columns: [],
        });
      }
    }
    
    console.log(`Completed processing ${tablesWithColumns.length} tables`);

    // Get relationships only for selected tables
    const allRelationships = await this.adapter.getRelationships();
    const filteredRelationships = allRelationships.filter(rel => {
      const fromKey = rel.fromSchema 
        ? `${rel.fromSchema}.${rel.fromTable}` 
        : rel.fromTable;
      const toKey = rel.toSchema 
        ? `${rel.toSchema}.${rel.toTable}` 
        : rel.toTable;
      
      const selectedKeys = selectedTables || tablesToProcess.map(t => 
        t.schema ? `${t.schema}.${t.name}` : t.name
      );
      
      return selectedKeys.includes(fromKey) || selectedKeys.includes(toKey);
    });

    return {
      schemas: filteredSchemas,
      tables: tablesWithColumns,
      relationships: filteredRelationships,
    };
  }

  async getTablesForSchema(schema?: string): Promise<Table[]> {
    const tables = await this.adapter.getTables(schema);
    const tablesWithColumns: Table[] = [];
    
    for (const table of tables) {
      const columns = await this.adapter.getColumns(table.name, table.schema);
      tablesWithColumns.push({
        ...table,
        columns,
      });
    }
    
    return tablesWithColumns;
  }

  async getRelationshipsForTable(table: string, schema?: string): Promise<Relationship[]> {
    const allRelationships = await this.adapter.getRelationships();
    return allRelationships.filter(
      (rel) =>
        (rel.fromTable === table && rel.fromSchema === schema) ||
        (rel.toTable === table && rel.toSchema === schema)
    );
  }
}

