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
}

export function RelationCard({ card, recordData, relatedData }: RelationCardProps) {
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
              {relatedData.slice(0, 5).map((row, index) => (
                <div key={index} className="text-sm border-b pb-2">
                  {card.columns?.map((col) => (
                    <div key={col}>
                      <span className="font-medium">{col}:</span> {String(row[col] || '')}
                    </div>
                  ))}
                </div>
              ))}
              {relatedData.length > 5 && (
                <p className="text-sm text-muted-foreground">
                  +{relatedData.length - 5} more records
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

