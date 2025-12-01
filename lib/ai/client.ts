import OpenAI from 'openai';

export class AIClient {
  private client: OpenAI | null = null;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (key) {
      this.client = new OpenAI({
        apiKey: key,
      });
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async analyzeSchema(schemaData: any): Promise<any> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `You are a database schema analyst. Analyze the following database schema and provide:

1. Friendly names for tables and columns (convert technical names to human-readable ones)
2. Identify important columns that should be shown by default in data grids
3. Suggest display formats for columns (text, number, currency, date, datetime, boolean, email, url)
4. Identify which aggregates would be useful (count, sum, avg, min, max)
5. Identify lookup relationships (when a column references another table, suggest which column to display)
6. Design profile page layouts for each table showing related tables in cards

Return your analysis as JSON with this structure:
{
  "friendlyNames": {
    "tableName": "Friendly Table Name",
    "schema.tableName": "Friendly Table Name (if schema exists)",
    "tableName.columnName": "Friendly Column Name",
    "schema.tableName.columnName": "Friendly Column Name (if schema exists)"
  },
  "columnConfigs": {
    "tableName.columnName": {
      "friendlyName": "Display Name",
      "displayFormat": "text|number|currency|date|datetime|boolean|email|url",
      "isImportant": true|false,
      "aggregate": "count|sum|avg|min|max"|null,
      "lookupTable": "referencedTable",
      "lookupColumn": "idColumn",
      "lookupDisplayColumn": "nameColumn"
    }
  },
  "importantColumns": {
    "tableName": ["column1", "column2"]
  },
  "profileLayouts": {
    "tableName": {
      "cards": [
        {
          "type": "fields|related-table|aggregate",
          "title": "Card Title",
          "table": "tableName",
          "columns": ["col1", "col2"],
          "relationship": {...},
          "aggregateType": "count|sum|avg|min|max",
          "aggregateColumn": "columnName"
        }
      ]
    }
  }
}

Schema data:
${JSON.stringify(schemaData, null, 2)}`;

    try {
      console.log('Sending request to OpenAI API...');
      const startTime = Date.now();
      
      const response = await Promise.race([
        this.client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a database schema analyst. Return only valid JSON, no markdown formatting.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI analysis timeout after 2 minutes')), 120000)
        ),
      ]) as any;

      const elapsed = Date.now() - startTime;
      console.log(`AI analysis completed in ${elapsed}ms`);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      console.log('Parsing AI response...');
      const parsed = JSON.parse(content);
      console.log('AI analysis parsed successfully');
      return parsed;
    } catch (error: any) {
      console.error('AI analysis error:', error);
      if (error.message?.includes('timeout')) {
        throw new Error('AI analysis took too long. Please try again or skip AI analysis.');
      }
      throw error;
    }
  }
}

