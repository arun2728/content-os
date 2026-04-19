'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useJobProgress } from '@/hooks/use-job-progress';
import { useState } from 'react';

interface JobDashboardProps {
  jobId: string;
  onComplete: () => void;
}

const stages = ['clarify', 'outline', 'write', 'edit', 'publish'];

export function JobDashboard({ jobId, onComplete }: JobDashboardProps) {
  const [stageProgress, setStageProgress] = useState<Record<string, number>>({});

  const { isConnected, lastEvent } = useJobProgress({
    jobId,
    onProgress: (event) => {
      if (event.progress) {
        setStageProgress((prev) => ({
          ...prev,
          [event.stage]: event.progress,
        }));
      }

      if (event.status === 'completed') {
        // Automatically move to next stage
        const currentIndex = stages.indexOf(event.stage);
        if (currentIndex < stages.length - 1) {
          advanceStage(stages[currentIndex + 1]);
        }
      }
    },
  });

  const advanceStage = async (stage: string) => {
    console.log('[v0] Advancing to stage:', stage);
    // This would call the API endpoints for each stage
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-muted-foreground">
          {isConnected ? 'Live' : 'Connecting'} - {lastEvent?.stage || 'Initializing'}
        </span>
      </div>

      {/* Stages Progress */}
      <div className="space-y-3">
        {stages.map((stage) => (
          <Card key={stage} className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base capitalize">{stage}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${stageProgress[stage] || 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {stageProgress[stage] || 0}%
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status Info */}
      {lastEvent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Current Stage:</dt>
                <dd className="font-medium capitalize">{lastEvent.stage}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status:</dt>
                <dd className="font-medium capitalize">{lastEvent.status}</dd>
              </div>
              {lastEvent.message && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Message:</dt>
                  <dd className="font-medium">{lastEvent.message}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Completion Message */}
      {lastEvent?.status === 'completed' && lastEvent?.stage === 'publish' && (
        <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <CardHeader>
            <CardTitle className="text-green-900 dark:text-green-100">
              Content Published!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-green-800 dark:text-green-200">
              Your content has been successfully published to dev.to.
            </p>
            <Button onClick={onComplete} className="w-full">
              Create Another Post
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
