import { NextRequest, NextResponse } from 'next/server';
import { createDatabaseAdapter } from '@/lib/db/factory';
import { DatabaseType, DatabaseConfig } from '@/types/database';
import { QueryOptions } from '@/lib/db/base';

export async function POST(request: NextRequest) {
  let adapter: any = null;
  try {
    const body = await request.json();
    const {
      type,
      config,
      table,
      schema,
      options,
    } = body as {
      type: DatabaseType;
      config: DatabaseConfig;
      table: string;
      schema?: string;
      options?: QueryOptions;
    };

    console.log('Query request:', {
      type,
      table,
      schema,
      options: options ? {
        sorts: options.sorts?.length || 0,
        filters: options.filters?.length || 0,
        pagination: options.pagination,
      } : 'none',
    });

    adapter = createDatabaseAdapter(type, config);
    await adapter.connect();
    console.log('Database connected for query');

    const result = await adapter.getTableData(table, schema, options);
    console.log('Query result:', {
      rowCount: result.rows?.length || 0,
      totalCount: result.rowCount,
      columns: result.columns?.length || 0,
    });

    await adapter.disconnect();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Query error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      number: error.number,
    });

    if (adapter) {
      try {
        await adapter.disconnect();
      } catch (disconnectError) {
        console.error('Error disconnecting:', disconnectError);
      }
    }

    return NextResponse.json(
      {
        error: error.message || 'Query failed',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack,
          code: error.code,
          number: error.number,
        } : undefined,
      },
      { status: 500 }
    );
  }
}

