import { NextRequest, NextResponse } from 'next/server';
import { createDatabaseAdapter } from '@/lib/db/factory';
import { DatabaseType, DatabaseConfig } from '@/types/database';

export async function POST(request: NextRequest) {
  let adapter: any = null;
  try {
    const body = await request.json();
    const {
      type,
      config,
    } = body as {
      type: DatabaseType;
      config: DatabaseConfig;
    };

    console.log('Fetching table list for:', type, config.database);

    // Connect to database
    adapter = createDatabaseAdapter(type, config);
    await adapter.connect();
    console.log('Database connected successfully');

    // Get just schemas and table names (no columns)
    const schemas = await adapter.getSchemas();
    const tables = await adapter.getTables();

    await adapter.disconnect();
    console.log('Database disconnected');

    return NextResponse.json({
      schemas,
      tables: tables.map((t: any) => ({
        name: t.name,
        schema: t.schema,
        rowCount: t.rowCount,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching tables:', error);

    // Ensure connection is closed on error
    if (adapter) {
      try {
        await adapter.disconnect();
      } catch (disconnectError) {
        console.error('Error disconnecting:', disconnectError);
      }
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch tables',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack,
        } : undefined,
      },
      { status: 500 }
    );
  }
}

