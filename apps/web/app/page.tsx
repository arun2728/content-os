'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: prompt }),
      });

      if (response.ok) {
        const job = await response.json();
        console.log('[v0] Created job:', job);
        router.push(`/jobs/${job.id}`);
      } else {
        setError('Failed to create job. Please check if the API is running on port 3001.');
      }
    } catch (err) {
      console.error('[v0] Error creating job:', err);
      setError('Could not connect to the API server. Make sure it\'s running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Content OS
          </h1>
          <p className="text-lg text-muted-foreground">
            AI-powered content orchestration: clarify, outline, write, edit, and publish to dev.to
          </p>
        </div>

        {/* Main Card */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Create New Content</CardTitle>
            <CardDescription>
              Describe what you want to write about, and we&apos;ll guide you through every step
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Idea</label>
                <Textarea
                  placeholder="What would you like to write about?"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={!prompt.trim() || loading}
                className="w-full"
              >
                {loading ? 'Creating...' : 'Start Writing'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info Section */}
        <div className="mt-12 grid sm:grid-cols-3 gap-4">
          {[
            {
              title: 'Clarify',
              description: 'Interactive questions to refine your idea',
            },
            {
              title: 'Create',
              description: 'Outline, write, and edit with AI assistance',
            },
            {
              title: 'Publish',
              description: 'Publish as a draft on dev.to',
            },
          ].map((item) => (
            <Card key={item.title} className="text-center">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
