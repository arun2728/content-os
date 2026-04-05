'use client';

import { useEffect, useState, useCallback } from 'react';
import { JobProgressEvent } from '@content-os/shared';

interface UseJobProgressOptions {
  jobId: string;
  onProgress?: (event: JobProgressEvent) => void;
  onError?: (error: Error) => void;
  autoStart?: boolean;
}

export function useJobProgress({
  jobId,
  onProgress,
  onError,
  autoStart = true,
}: UseJobProgressOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<JobProgressEvent | null>(null);

  const connect = useCallback(() => {
    if (!jobId) return;

    setIsConnected(true);

    const eventSource = new EventSource(
      `http://localhost:3001/api/jobs/${jobId}/progress`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastEvent(data);
        onProgress?.(data);
      } catch (error) {
        console.error('[useJobProgress] Error parsing SSE:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[useJobProgress] SSE error:', error);
      setIsConnected(false);
      eventSource.close();

      if (onError) {
        onError(
          new Error('Failed to connect to job progress stream')
        );
      }
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [jobId, onProgress, onError]);

  useEffect(() => {
    if (autoStart && jobId) {
      return connect();
    }
  }, [jobId, autoStart, connect]);

  return {
    isConnected,
    lastEvent,
    reconnect: connect,
  };
}
