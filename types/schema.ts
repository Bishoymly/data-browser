export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: ForeignKey;
  defaultValue?: any;
  maxLength?: number;
  precision?: number;
  scale?: number;
}

export interface ForeignKey {
  referencedTable: string;
  referencedSchema?: string;
  referencedColumn: string;
  constraintName: string;
}

export interface Table {
  name: string;
  schema?: string;
  columns: Column[];
  rowCount?: number;
}

export interface Relationship {
  fromTable: string;
  fromSchema?: string;
  fromColumn: string;
  toTable: string;
  toSchema?: string;
  toColumn: string;
  constraintName: string;
  relationshipType: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface SchemaMetadata {
  schemas: string[];
  tables: Table[];
  relationships: Relationship[];
}

export interface ColumnConfig {
  friendlyName?: string;
  displayFormat?: 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'boolean' | 'email' | 'url';
  isImportant?: boolean;
  isHidden?: boolean;
  aggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max' | null;
  lookupTable?: string;
  lookupColumn?: string;
  lookupDisplayColumn?: string;
}

export interface ProfileLayout {
  cards: ProfileCard[];
}

export interface ProfileCard {
  type: 'fields' | 'related-table' | 'aggregate';
  title: string;
  table?: string;
  columns?: string[];
  relationship?: Relationship;
  aggregateType?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  aggregateColumn?: string;
}

export interface AISchemaAnalysis {
  friendlyNames: Record<string, string>; // table/column path -> friendly name
  columnConfigs: Record<string, ColumnConfig>; // table.column -> config
  relationships: Relationship[];
  profileLayouts: Record<string, ProfileLayout>; // table -> layout
  importantColumns: Record<string, string[]>; // table -> column names
}

