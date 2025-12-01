import { NextRequest, NextResponse } from 'next/server';
import { AppConfig } from '@/types/config';
import { ConfigImporter } from '@/lib/config/import';
import { ConfigExporter } from '@/lib/config/export';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

const CONFIG_DIR = join(process.cwd(), 'configs');

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json';

    // This would typically get config from the client's localStorage
    // For server-side export, we'd need the config passed in the request
    return NextResponse.json({ message: 'Use POST to export config' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config, filename } = body as {
      action: 'export' | 'import' | 'save-server' | 'load-server';
      config?: AppConfig;
      filename?: string;
    };

    switch (action) {
      case 'export':
        if (!config) {
          return NextResponse.json({ error: 'Config required' }, { status: 400 });
        }
        return NextResponse.json(ConfigExporter.export(config));

      case 'import':
        if (!config) {
          return NextResponse.json({ error: 'Config required' }, { status: 400 });
        }
        const imported = ConfigImporter.import(config);
        return NextResponse.json(imported);

      case 'save-server':
        if (!config || !filename) {
          return NextResponse.json(
            { error: 'Config and filename required' },
            { status: 400 }
          );
        }
        try {
          // Ensure configs directory exists
          const { mkdir } = await import('fs/promises');
          await mkdir(CONFIG_DIR, { recursive: true });
          
          const filePath = join(CONFIG_DIR, filename);
          await writeFile(filePath, JSON.stringify(config, null, 2));
          return NextResponse.json({ success: true, path: filePath });
        } catch (error: any) {
          return NextResponse.json(
            { error: `Failed to save: ${error.message}` },
            { status: 500 }
          );
        }

      case 'load-server':
        if (!filename) {
          return NextResponse.json(
            { error: 'Filename required' },
            { status: 400 }
          );
        }
        try {
          const filePath = join(CONFIG_DIR, filename);
          const content = await readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          const imported = ConfigImporter.import(data);
          return NextResponse.json(imported);
        } catch (error: any) {
          return NextResponse.json(
            { error: `Failed to load: ${error.message}` },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

