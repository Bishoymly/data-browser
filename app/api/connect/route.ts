import { NextRequest, NextResponse } from 'next/server';
import { createDatabaseAdapter } from '@/lib/db/factory';
import { DatabaseType, DatabaseConfig } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, config } = body as { type: DatabaseType; config: DatabaseConfig };

    const adapter = createDatabaseAdapter(type, config);
    await adapter.connect();

    const isConnected = await adapter.testConnection();
    await adapter.disconnect();

    if (!isConnected) {
      return NextResponse.json(
        { error: 'Failed to connect to database' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Connection failed' },
      { status: 500 }
    );
  }
}

