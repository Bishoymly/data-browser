import { NextRequest, NextResponse } from 'next/server';
import { createDatabaseAdapter } from '@/lib/db/factory';
import { SchemaAnalyzer } from '@/lib/schema/analyzer';
import { AISchemaAnalyzer } from '@/lib/ai/schema-analyzer';
import { AIClient } from '@/lib/ai/client';
import { DatabaseType, DatabaseConfig } from '@/types/database';

export async function POST(request: NextRequest) {
  let adapter: any = null;
  try {
    const body = await request.json();
    const {
      type,
      config,
      apiKey,
      selectedTables,
      selectedSchemas,
    } = body as {
      type: DatabaseType;
      config: DatabaseConfig;
      apiKey?: string;
      selectedTables?: string[]; // Array of "schema.table" or "table"
      selectedSchemas?: string[];
    };

    console.log('Schema extraction started for:', type, config.database);
    console.log('Selected tables:', selectedTables);
    console.log('Selected schemas:', selectedSchemas);

    // Connect to database
    adapter = createDatabaseAdapter(type, config);
    await adapter.connect();
    console.log('Database connected successfully');

    // Extract schema for selected tables only
    console.log('Starting schema analysis...');
    const analyzer = new SchemaAnalyzer(adapter);
    
    // Get table count for progress estimation
    const allSchemas = await adapter.getSchemas();
    const filteredSchemas = selectedSchemas 
      ? allSchemas.filter((s: string) => selectedSchemas.includes(s))
      : allSchemas;
    
    let totalTables = 0;
    for (const schema of filteredSchemas) {
      const tables = await adapter.getTables(schema);
      if (selectedTables && selectedTables.length > 0) {
        totalTables += tables.filter((t: any) => {
          const key = t.schema ? `${t.schema}.${t.name}` : t.name;
          return selectedTables.includes(key);
        }).length;
      } else {
        totalTables += tables.length;
      }
    }
    
    console.log(`Will process ${totalTables} tables`);
    
    const metadata = await analyzer.analyzeForSelectedTables(
      selectedTables,
      selectedSchemas
    );
    console.log('Schema extracted:', {
      schemas: metadata.schemas.length,
      tables: metadata.tables.length,
      relationships: metadata.relationships.length,
    });

    // AI analysis if API key provided
    let aiAnalysis = null;
    if (apiKey || process.env.OPENAI_API_KEY) {
      try {
        console.log('Starting AI analysis...');
        console.log(`Analyzing ${metadata.tables.length} tables and ${metadata.relationships.length} relationships`);
        const aiClient = new AIClient(apiKey);
        const aiAnalyzer = new AISchemaAnalyzer(aiClient);
        
        // Add timeout wrapper
        const aiAnalysisPromise = aiAnalyzer.analyze(metadata);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI analysis timeout')), 180000) // 3 minutes
        );
        
        aiAnalysis = await Promise.race([aiAnalysisPromise, timeoutPromise]);
        console.log('AI analysis completed successfully');
      } catch (aiError: any) {
        console.error('AI analysis failed:', aiError);
        console.error('AI error details:', {
          message: aiError.message,
          stack: aiError.stack,
          name: aiError.name,
        });
        // Continue without AI analysis - don't fail the whole request
        aiAnalysis = null;
      }
    } else {
      console.log('Skipping AI analysis - no API key provided');
    }

    await adapter.disconnect();
    console.log('Database disconnected');

    return NextResponse.json({
      metadata,
      aiAnalysis,
    });
  } catch (error: any) {
    console.error('Schema extraction error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      number: error.number,
      state: error.state,
      class: error.class,
      serverName: error.serverName,
      procName: error.procName,
      lineNumber: error.lineNumber,
    });

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
        error: error.message || 'Schema extraction failed',
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

