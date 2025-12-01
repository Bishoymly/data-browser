import { Relationship, Table } from '@/types/schema';

export class RelationshipAnalyzer {
  static analyzeRelationships(
    tables: Table[],
    relationships: Relationship[]
  ): Map<string, Relationship[]> {
    const tableRelationships = new Map<string, Relationship[]>();

    tables.forEach((table) => {
      const tableKey = table.schema
        ? `${table.schema}.${table.name}`
        : table.name;
      const related = relationships.filter(
        (rel) =>
          (rel.fromTable === table.name && rel.fromSchema === table.schema) ||
          (rel.toTable === table.name && rel.toSchema === table.schema)
      );
      tableRelationships.set(tableKey, related);
    });

    return tableRelationships;
  }

  static getRelatedTables(
    table: string,
    schema: string | undefined,
    relationships: Relationship[]
  ): { table: string; schema?: string; relationship: Relationship }[] {
    const related: { table: string; schema?: string; relationship: Relationship }[] = [];

    relationships.forEach((rel) => {
      if (rel.fromTable === table && rel.fromSchema === schema) {
        related.push({
          table: rel.toTable,
          schema: rel.toSchema,
          relationship: rel,
        });
      } else if (rel.toTable === table && rel.toSchema === schema) {
        related.push({
          table: rel.fromTable,
          schema: rel.fromSchema,
          relationship: rel,
        });
      }
    });

    return related;
  }

  static determineRelationshipType(relationship: Relationship): 'one-to-one' | 'one-to-many' | 'many-to-many' {
    // This is a simplified determination. In practice, you'd check for unique constraints
    // For now, default to one-to-many
    return 'one-to-many';
  }
}

