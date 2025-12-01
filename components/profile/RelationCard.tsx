'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileCard } from '@/types/schema';
import { ConnectionConfig } from '@/types/config';
import Link from 'next/link';

interface RelationCardProps {
  card: ProfileCard;
  recordData: any;
  relatedData: any[];
  connection: ConnectionConfig;
  tableName?: string;
  schema?: string;
}

export function RelationCard({ card, recordData, relatedData, tableName, schema }: RelationCardProps) {
  if (card.type === 'fields' && card.columns) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{card.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {card.columns.map((col) => (
              <div key={col}>
                <div className="text-sm font-medium text-muted-foreground">{col}</div>
                <div className="text-sm">{String(recordData[col] || '')}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (card.type === 'related-table') {
    // Get primary key column for navigation
    const getRecordId = (row: any): string => {
      // Try common ID column names
      const idColumns = ['id', 'Id', 'ID', `${tableName}Id`, `${tableName}_id`];
      for (const col of idColumns) {
        if (row[col] !== null && row[col] !== undefined) {
          return encodeURIComponent(String(row[col]));
        }
      }
      // Fallback to first column value
      const firstCol = Object.keys(row)[0];
      return firstCol ? encodeURIComponent(String(row[firstCol] || '')) : '';
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>{card.title}</CardTitle>
          <CardDescription>
            {relatedData.length} related record{relatedData.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {relatedData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No related records</p>
          ) : (
            <div className="space-y-2">
              {relatedData.slice(0, 10).map((row, index) => {
                const recordId = getRecordId(row);
                const relatedTableKey = schema 
                  ? `${schema}.${tableName || card.title}` 
                  : (tableName || card.title);
                const profileUrl = recordId ? `/profile/${encodeURIComponent(relatedTableKey)}/${recordId}` : null;

                return (
                  <div 
                    key={index} 
                    className={`text-sm border-b pb-2 ${profileUrl ? 'cursor-pointer hover:bg-muted/50 p-2 rounded-md -m-2 transition-colors' : ''}`}
                    onClick={profileUrl ? () => window.location.href = profileUrl : undefined}
                  >
                    {card.columns && card.columns.length > 0 ? (
                      // Show specified columns
                      card.columns.map((col) => (
                        <div key={col} className="mb-1">
                          <span className="font-medium text-muted-foreground">{col}:</span>{' '}
                          <span>{String(row[col] || '')}</span>
                        </div>
                      ))
                    ) : (
                      // Show all columns (fallback)
                      Object.entries(row).slice(0, 5).map(([col, val]) => (
                        <div key={col} className="mb-1">
                          <span className="font-medium text-muted-foreground">{col}:</span>{' '}
                          <span>{String(val || '')}</span>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
              {relatedData.length > 10 && (
                <p className="text-sm text-muted-foreground pt-2">
                  +{relatedData.length - 10} more records
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (card.type === 'aggregate') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{card.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {card.aggregateType === 'count'
              ? relatedData.length
              : card.aggregateColumn
                ? relatedData.reduce((sum, row) => sum + (Number(row[card.aggregateColumn!]) || 0), 0)
                : 0}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

