import sql from 'mssql';
import { DatabaseAdapter, QueryResult, QueryOptions, FilterParams, SortParams } from './base';
import { DatabaseConfig } from '@/types/database';
import { SchemaMetadata, Table, Column, Relationship, ForeignKey } from '@/types/schema';

export class SQLServerAdapter extends DatabaseAdapter {
  private pool: sql.ConnectionPool | null = null;

  async connect(): Promise<void> {
    const config: sql.config = {
      server: this.config.server,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      port: this.config.port || 1433,
      options: {
        encrypt: true,
        trustServerCertificate: true,
        ...this.config.options,
      },
    };

    this.pool = new sql.ConnectionPool(config);
    await this.pool.connect();
    this.connection = this.pool;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.pool) {
        await this.connect();
      }
      const result = await this.pool!.request().query('SELECT 1 as test');
      return result.recordset.length > 0;
    } catch (error) {
      return false;
    }
  }

  async getSchemas(): Promise<string[]> {
    const query = `
      SELECT DISTINCT SCHEMA_NAME(schema_id) AS schema_name
      FROM sys.tables
      ORDER BY schema_name
    `;
    const result = await this.pool!.request().query(query);
    return result.recordset.map((row: any) => row.schema_name);
  }

  async getTables(schema?: string): Promise<Table[]> {
    let query = `
      SELECT 
        t.name AS table_name,
        SCHEMA_NAME(t.schema_id) AS schema_name,
        (SELECT COUNT(*) FROM sys.partitions p WHERE p.object_id = t.object_id AND p.index_id IN (0,1)) AS row_count
      FROM sys.tables t
    `;
    
    if (schema) {
      query += ` WHERE SCHEMA_NAME(t.schema_id) = @schema`;
    }
    
    query += ` ORDER BY schema_name, table_name`;

    const request = this.pool!.request();
    if (schema) {
      request.input('schema', sql.NVarChar, schema);
    }
    
    const result = await request.query(query);
    return result.recordset.map((row: any) => ({
      name: row.table_name,
      schema: row.schema_name,
      columns: [],
      rowCount: row.row_count,
    }));
  }

  async getColumns(table: string, schema?: string): Promise<Column[]> {
    // Simplified query using sys views only for better compatibility
    const query = `
      SELECT 
        c.name AS column_name,
        t.name AS type_name,
        c.is_nullable,
        c.max_length,
        c.precision,
        c.scale,
        OBJECT_DEFINITION(c.default_object_id) AS column_default,
        CASE WHEN pk.column_name IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key
      FROM sys.columns c
      INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
      INNER JOIN sys.tables tab ON c.object_id = tab.object_id
      LEFT JOIN (
        SELECT 
          SCHEMA_NAME(tab.schema_id) AS table_schema,
          tab.name AS table_name,
          c.name AS column_name
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        INNER JOIN sys.tables tab ON c.object_id = tab.object_id
        WHERE i.is_primary_key = 1
      ) pk ON pk.table_schema = SCHEMA_NAME(tab.schema_id)
        AND pk.table_name = tab.name
        AND pk.column_name = c.name
      WHERE tab.name = @tableName
        ${schema ? 'AND SCHEMA_NAME(tab.schema_id) = @schemaName' : ''}
      ORDER BY c.column_id
    `;

    try {
      const request = this.pool!.request();
      request.input('tableName', sql.NVarChar, table);
      if (schema) {
        request.input('schemaName', sql.NVarChar, schema);
      }

      const result = await request.query(query);
    
      // Get foreign keys for this table
      const fkQuery = `
        SELECT 
          fk.name AS constraint_name,
          OBJECT_NAME(fk.parent_object_id) AS table_name,
          COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
          OBJECT_SCHEMA_NAME(fk.parent_object_id) AS table_schema,
          OBJECT_NAME(fk.referenced_object_id) AS referenced_table_name,
          COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column_name,
          OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS referenced_schema_name
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        WHERE OBJECT_NAME(fk.parent_object_id) = @tableName
          ${schema ? 'AND OBJECT_SCHEMA_NAME(fk.parent_object_id) = @schemaName' : ''}
      `;

      const fkRequest = this.pool!.request();
      fkRequest.input('tableName', sql.NVarChar, table);
      if (schema) {
        fkRequest.input('schemaName', sql.NVarChar, schema);
      }
      const fkResult = await fkRequest.query(fkQuery);
      
      const foreignKeys = new Map<string, ForeignKey>();
      fkResult.recordset.forEach((row: any) => {
        foreignKeys.set(row.column_name, {
          referencedTable: row.referenced_table_name,
          referencedSchema: row.referenced_schema_name,
          referencedColumn: row.referenced_column_name,
          constraintName: row.constraint_name,
        });
      });

      return result.recordset.map((row: any) => ({
        name: row.column_name,
        type: row.type_name,
        nullable: row.is_nullable,
        primaryKey: row.is_primary_key === 1,
        foreignKey: foreignKeys.get(row.column_name),
        maxLength: row.max_length > 0 ? row.max_length : undefined,
        precision: row.precision > 0 ? row.precision : undefined,
        scale: row.scale > 0 ? row.scale : undefined,
        defaultValue: row.column_default,
      }));
    } catch (error: any) {
      console.error(`Error in getColumns for ${schema ? schema + '.' : ''}${table}:`, error);
      throw error;
    }
  }

  async getRelationships(): Promise<Relationship[]> {
    const query = `
      SELECT 
        fk.name AS constraint_name,
        OBJECT_SCHEMA_NAME(fk.parent_object_id) AS from_schema,
        OBJECT_NAME(fk.parent_object_id) AS from_table,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS from_column,
        OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS to_schema,
        OBJECT_NAME(fk.referenced_object_id) AS to_table,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS to_column
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      ORDER BY from_schema, from_table, constraint_name
    `;

    const result = await this.pool!.request().query(query);
    
    return result.recordset.map((row: any) => ({
      fromTable: row.from_table,
      fromSchema: row.from_schema,
      fromColumn: row.from_column,
      toTable: row.to_table,
      toSchema: row.to_schema,
      toColumn: row.to_column,
      constraintName: row.constraint_name,
      relationshipType: 'one-to-many', // Default, can be refined with additional queries
    }));
  }

  async executeQuery(sqlQuery: string, params?: Record<string, any>): Promise<QueryResult> {
    const request = this.pool!.request();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });
    }

    const result = await request.query(sqlQuery);
    
    return {
      rows: result.recordset,
      columns: [],
      rowCount: result.recordset.length,
    };
  }

  async getTableData(
    table: string,
    schema: string | undefined,
    options?: QueryOptions
  ): Promise<QueryResult> {
    const tableName = schema ? `[${schema}].[${table}]` : `[${table}]`;
    let query = `SELECT * FROM ${tableName}`;
    const params: Record<string, any> = {};
    const whereClauses: string[] = [];

    // Apply filters
    if (options?.filters && options.filters.length > 0) {
      options.filters.forEach((filter, index) => {
        const paramName = `filter${index}`;
        let clause = '';
        
        switch (filter.operator) {
          case 'equals':
            clause = `[${filter.column}] = @${paramName}`;
            params[paramName] = filter.value;
            break;
          case 'contains':
            clause = `[${filter.column}] LIKE @${paramName}`;
            params[paramName] = `%${filter.value}%`;
            break;
          case 'startsWith':
            clause = `[${filter.column}] LIKE @${paramName}`;
            params[paramName] = `${filter.value}%`;
            break;
          case 'endsWith':
            clause = `[${filter.column}] LIKE @${paramName}`;
            params[paramName] = `%${filter.value}`;
            break;
          case 'greaterThan':
            clause = `[${filter.column}] > @${paramName}`;
            params[paramName] = filter.value;
            break;
          case 'lessThan':
            clause = `[${filter.column}] < @${paramName}`;
            params[paramName] = filter.value;
            break;
        }
        
        if (clause) {
          whereClauses.push(clause);
        }
      });
    }
    
    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // Apply sorting (required for OFFSET/FETCH)
    // If no explicit sort, use first column or primary key
    if (options?.sorts && options.sorts.length > 0) {
      const orderBy = options.sorts
        .map(sort => `[${sort.column}] ${sort.direction.toUpperCase()}`)
        .join(', ');
      query += ` ORDER BY ${orderBy}`;
    } else if (options?.pagination) {
      // OFFSET/FETCH requires ORDER BY, so add a default one
      // Try to use first column, or just use a simple ordering
      query += ` ORDER BY (SELECT NULL)`;
    }

    // Apply pagination
    if (options?.pagination) {
      const { page, pageSize } = options.pagination;
      const offset = (page - 1) * pageSize;
      query += ` OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
    }

    // Get total count (with same WHERE clause if filters exist)
    let countQuery = `SELECT COUNT(*) as total FROM ${tableName}`;
    if (whereClauses.length > 0) {
      countQuery += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    const countRequest = this.pool!.request();
    Object.keys(params).forEach(key => {
      countRequest.input(key, params[key]);
    });
    const countResult = await countRequest.query(countQuery);
    const totalCount = countResult.recordset[0]?.total || 0;

    // Get columns
    const columns = await this.getColumns(table, schema);

    // Execute main query
    const result = await this.executeQuery(query, params);

    return {
      rows: result.rows,
      columns,
      rowCount: totalCount,
    };
  }

  async getSchemaMetadata(): Promise<SchemaMetadata> {
    try {
      console.log('Getting schemas...');
      const schemas = await this.getSchemas();
      console.log(`Found ${schemas.length} schemas`);

      const tables: Table[] = [];
      console.log('Getting relationships...');
      const relationships = await this.getRelationships();
      console.log(`Found ${relationships.length} relationships`);

      for (const schemaName of schemas) {
        try {
          console.log(`Processing schema: ${schemaName}`);
          const schemaTables = await this.getTables(schemaName);
          console.log(`Found ${schemaTables.length} tables in schema ${schemaName}`);

          for (const table of schemaTables) {
            try {
              console.log(`Getting columns for table: ${schemaName}.${table.name}`);
              table.columns = await this.getColumns(table.name, schemaName);
              console.log(`Found ${table.columns.length} columns in ${schemaName}.${table.name}`);
              tables.push(table);
            } catch (tableError: any) {
              console.error(`Error getting columns for table ${schemaName}.${table.name}:`, tableError);
              // Continue with other tables even if one fails
              table.columns = [];
              tables.push(table);
            }
          }
        } catch (schemaError: any) {
          console.error(`Error processing schema ${schemaName}:`, schemaError);
          // Continue with other schemas
        }
      }

      console.log(`Schema metadata extraction complete: ${tables.length} tables`);
      return {
        schemas,
        tables,
        relationships,
      };
    } catch (error: any) {
      console.error('Error in getSchemaMetadata:', error);
      throw error;
    }
  }
}

