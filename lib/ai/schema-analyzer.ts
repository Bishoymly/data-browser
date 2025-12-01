import { SchemaMetadata, AISchemaAnalysis } from '@/types/schema';
import { AIClient } from './client';

export class AISchemaAnalyzer {
  constructor(private aiClient: AIClient) {}

  async analyze(schemaMetadata: SchemaMetadata): Promise<AISchemaAnalysis> {
    if (!this.aiClient.isAvailable()) {
      throw new Error('AI client not available');
    }

    // Prepare schema data for AI analysis
    const schemaData = {
      schemas: schemaMetadata.schemas,
      tables: schemaMetadata.tables.map((table) => ({
        name: table.name,
        schema: table.schema,
        columns: table.columns.map((col) => ({
          name: col.name,
          type: col.type,
          nullable: col.nullable,
          primaryKey: col.primaryKey,
          foreignKey: col.foreignKey,
        })),
      })),
      relationships: schemaMetadata.relationships,
    };

    const aiResult = await this.aiClient.analyzeSchema(schemaData);

    // Transform AI result to match our type structure
    const analysis: AISchemaAnalysis = {
      friendlyNames: aiResult.friendlyNames || {},
      columnConfigs: aiResult.columnConfigs || {},
      relationships: schemaMetadata.relationships, // Use detected relationships
      profileLayouts: aiResult.profileLayouts || {},
      importantColumns: aiResult.importantColumns || {},
    };

    return analysis;
  }
}

