import { NextRequest, NextResponse } from 'next/server';
import { createDatabaseAdapter } from '@/lib/db/factory';
import { DatabaseType, DatabaseConfig } from '@/types/database';
import { AppConfig } from '@/types/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      config,
      appConfig,
      tableName = '_data_browser_config',
    } = body as {
      type: DatabaseType;
      config: DatabaseConfig;
      appConfig: AppConfig;
      tableName?: string;
    };

    const adapter = createDatabaseAdapter(type, config);
    await adapter.connect();

    // Create config table if it doesn't exist
    const createTableQuery = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '${tableName}')
      CREATE TABLE [${tableName}] (
        id NVARCHAR(50) PRIMARY KEY,
        config_data NVARCHAR(MAX) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `;

    await adapter.executeQuery(createTableQuery);

    // Save or update config
    const configJson = JSON.stringify(appConfig);
    const upsertQuery = `
      MERGE [${tableName}] AS target
      USING (SELECT @id AS id, @config AS config_data) AS source
      ON target.id = source.id
      WHEN MATCHED THEN
        UPDATE SET config_data = source.config_data, updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (id, config_data) VALUES (source.id, source.config_data);
    `;

    await adapter.executeQuery(upsertQuery, {
      id: 'main',
      config: configJson,
    });

    await adapter.disconnect();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to save config to database' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as DatabaseType;
    const configJson = searchParams.get('config');
    const tableName = searchParams.get('tableName') || '_data_browser_config';

    if (!type || !configJson) {
      return NextResponse.json(
        { error: 'Type and config required' },
        { status: 400 }
      );
    }

    const config = JSON.parse(configJson) as DatabaseConfig;
    const adapter = createDatabaseAdapter(type, config);
    await adapter.connect();

    const query = `SELECT config_data FROM [${tableName}] WHERE id = @id`;
    const result = await adapter.executeQuery(query, { id: 'main' });

    await adapter.disconnect();

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    const appConfig = JSON.parse(result.rows[0].config_data) as AppConfig;
    return NextResponse.json(appConfig);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load config from database' },
      { status: 500 }
    );
  }
}

