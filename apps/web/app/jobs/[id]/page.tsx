'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StageArtifactViewer } from '@/components/stage-artifact-viewer';
import {
  CheckCircle2,
  Circle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  List,
  PenLine,
  FileText,
  Linkedin,
  Send,
} from 'lucide-react';

type Stage = 'clarify' | 'outline' | 'write' | 'edit' | 'linkedin' | 'publish' | 'completed';

const STAGES: { id: Exclude<Stage, 'completed'>; label: string; description: string; icon: React.ElementType }[] = [
  { id: 'clarify', label: 'Clarify', description: 'Generating & answering questions', icon: Sparkles },
  { id: 'outline', label: 'Outline', description: 'Creating document structure', icon: List },
  { id: 'write', label: 'Write', description: 'Drafting initial content', icon: PenLine },
  { id: 'edit', label: 'Edit', description: 'Refining and polishing', icon: FileText },
  { id: 'linkedin', label: 'LinkedIn Draft', description: 'Generating LinkedIn post', icon: Linkedin },
  { id: 'publish', label: 'Publish', description: 'Publishing draft to dev.to', icon: Send },
];

const API_BASE = 'http://localhost:3001';

export default function JobProgressPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [job, setJob] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStage, setActiveStage] = useState<Stage>('clarify');
  const [selectedStage, setSelectedStage] = useState<Exclude<Stage, 'completed'> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const taskLocks = useRef<Record<string, boolean>>({});

  // ---------------------------------------------------------------------------
  // Poll job status
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchJob = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${id}`);
        if (!res.ok) {
          if (res.status === 404) setError('Job not found');
          return;
        }
        const data = await res.json();
        setJob(data);

        const completed = data.stageResults?.map((r: any) => r.stage) || [];
        if (completed.includes('publish')) setActiveStage('completed');
        else if (completed.includes('linkedin')) setActiveStage('publish');
        else if (completed.includes('edit')) setActiveStage('linkedin');
        else if (completed.includes('write')) setActiveStage('edit');
        else if (completed.includes('outline')) setActiveStage('write');
        else if (completed.includes('clarify') && data.status !== 'clarifying') setActiveStage('outline');
        else setActiveStage('clarify');
      } catch (err) {
        console.error(err);
      }
    };

    fetchJob();
    interval = setInterval(fetchJob, 2000);
    return () => clearInterval(interval);
  }, [id]);

  // ---------------------------------------------------------------------------
  // Orchestration engine
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!job) return;

    const run = async () => {
      try {
        const completed: string[] = job.stageResults?.map((r: any) => r.stage) || [];

        // 1. CLARIFY
        if (!completed.includes('clarify') && !taskLocks.current['clarify_init']) {
          taskLocks.current['clarify_init'] = true;
          const res = await fetch(`${API_BASE}/api/jobs/${id}/clarify`, { method: 'POST' });
          if (!res.ok) throw new Error('Failed to start clarification');
          const data = await res.json();
          const briefRes = await fetch(`${API_BASE}/api/briefs/${data.briefId}`);
          setBrief(await briefRes.json());
        }

        let currentBrief = brief;
        if (completed.includes('clarify') && !currentBrief) {
          const clarifyResult = job.stageResults.find((r: any) => r.stage === 'clarify');
          if (clarifyResult?.data?.briefId) {
            const briefRes = await fetch(`${API_BASE}/api/briefs/${clarifyResult.data.briefId}`);
            currentBrief = await briefRes.json();
            setBrief(currentBrief);
          }
        }

        if (!currentBrief || !currentBrief.isReady) return;

        // 2. OUTLINE
        if (!completed.includes('outline') && !taskLocks.current['outline']) {
          taskLocks.current['outline'] = true;
          await fetch(`${API_BASE}/api/jobs/${id}/outline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ briefId: currentBrief.id }),
          });
        }

        // 3. WRITE
        if (completed.includes('outline') && !completed.includes('write') && !taskLocks.current['write']) {
          const outlineResult = job.stageResults.find((r: any) => r.stage === 'outline');
          if (outlineResult?.data?.outlineId) {
            taskLocks.current['write'] = true;
            await fetch(`${API_BASE}/api/jobs/${id}/write`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ briefId: currentBrief.id, outlineId: outlineResult.data.outlineId }),
            });
          }
        }

        // 4. EDIT
        if (completed.includes('write') && !completed.includes('edit') && !taskLocks.current['edit']) {
          const writeResult = job.stageResults.find((r: any) => r.stage === 'write');
          if (writeResult?.data?.draftId) {
            taskLocks.current['edit'] = true;
            await fetch(`${API_BASE}/api/jobs/${id}/edit`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ draftId: writeResult.data.draftId }),
            });
          }
        }

        // 5. LINKEDIN
        if (completed.includes('edit') && !completed.includes('linkedin') && !taskLocks.current['linkedin']) {
          const editResult = job.stageResults.find((r: any) => r.stage === 'edit');
          const clarifyResult = job.stageResults.find((r: any) => r.stage === 'clarify');
          if (editResult?.data?.editedDraftId) {
            taskLocks.current['linkedin'] = true;
            await fetch(`${API_BASE}/api/jobs/${id}/linkedin`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                editedDraftId: editResult.data.editedDraftId,
                briefId: clarifyResult?.data?.briefId,
              }),
            });
          }
        }

        // 6. PUBLISH
        if (completed.includes('linkedin') && !completed.includes('publish') && !taskLocks.current['publish']) {
          const editResult = job.stageResults.find((r: any) => r.stage === 'edit');
          if (editResult?.data?.editedDraftId) {
            taskLocks.current['publish'] = true;
            await fetch(`${API_BASE}/api/jobs/${id}/publish`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ editedDraftId: editResult.data.editedDraftId, title: 'Generated Content' }),
            });
          }
        }
      } catch (err) {
        console.error('Orchestration error:', err);
      }
    };

    run();
  }, [job, id, brief]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brief) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/briefs/${brief.id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId: brief.id, answers }),
      });
      if (res.ok) {
        setBrief(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const completedStages: string[] = job?.stageResults?.map((r: any) => r.stage) || [];

  const isViewingArtifact = selectedStage !== null;
  const showingStage = selectedStage ?? activeStage;

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Card className="max-w-md w-full border-destructive border">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10 p-4 sm:p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-2">
              Job Progress
            </h1>
            <p className="text-muted-foreground text-lg">
              Track the generation of your content in real-time.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* ---------------------------------------------------------------- */}
            {/* Stepper / Timeline                                               */}
            {/* ---------------------------------------------------------------- */}
            <Card className="lg:col-span-1 border border-border/50 shadow-sm bg-card/50 backdrop-blur-sm self-start sticky top-8">
              <CardHeader>
                <CardTitle className="text-lg">Pipeline Stages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {STAGES.map((stage, idx) => {
                    const isCompleted = completedStages.includes(stage.id) && (stage.id !== 'clarify' || brief?.isReady);
                    const isActive = activeStage === stage.id;
                    const isPending = !isCompleted && !isActive;
                    const isSelected = selectedStage === stage.id;
                    const StageIcon = stage.icon;

                    return (
                      <Tooltip key={stage.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            disabled={!isCompleted}
                            onClick={() => {
                              if (isCompleted) {
                                setSelectedStage(isSelected ? null : stage.id);
                              }
                            }}
                            className={`
                              flex gap-3 relative w-full text-left rounded-lg px-2 py-1.5 -mx-2 transition-all duration-200
                              ${isCompleted ? 'cursor-pointer hover:bg-accent/60' : 'cursor-default'}
                              ${isSelected ? 'bg-accent ring-1 ring-primary/30' : ''}
                            `}
                          >
                            {/* Connection Line */}
                            {idx !== STAGES.length - 1 && (
                              <div
                                className={`absolute top-9 left-[22px] w-[2px] h-[calc(100%)] transition-colors duration-500 ${
                                  isCompleted ? 'bg-primary' : 'bg-muted'
                                }`}
                              />
                            )}

                            {/* Icon */}
                            <div className="relative z-10 flex items-center justify-center w-6 h-6 rounded-full mt-0.5 bg-background shrink-0">
                              {isCompleted ? (
                                <CheckCircle2 className="w-6 h-6 text-primary" />
                              ) : isActive ? (
                                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                              ) : (
                                <Circle className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>

                            {/* Label */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <StageIcon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-primary' : isPending ? 'text-muted-foreground' : 'text-foreground'}`} />
                                <p
                                  className={`text-sm font-semibold transition-colors duration-300 truncate ${
                                    isActive ? 'text-primary' : isPending ? 'text-muted-foreground' : 'text-foreground'
                                  }`}
                                >
                                  {stage.label}
                                </p>
                              </div>
                              <p className="text-muted-foreground text-xs mt-0.5">{stage.description}</p>
                            </div>
                          </button>
                        </TooltipTrigger>
                        {isCompleted && (
                          <TooltipContent side="right">
                            <p>Click to view {stage.label.toLowerCase()} artifact</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* ---------------------------------------------------------------- */}
            {/* Main Content Area                                                */}
            {/* ---------------------------------------------------------------- */}
            <div className="lg:col-span-2 space-y-6">
              {/* "Back to current" bar when viewing a past artifact */}
              {isViewingArtifact && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedStage(null)}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to current stage
                  </Button>
                  <Badge variant="outline" className="text-xs">
                    Viewing: {STAGES.find((s) => s.id === selectedStage)?.label}
                  </Badge>
                </div>
              )}

              {/* ---- Artifact view for a clicked completed stage ---- */}
              {isViewingArtifact && selectedStage && (
                <StageArtifactViewer stage={selectedStage} job={job} brief={brief} />
              )}

              {/* ---- Active stage content (default view) ---- */}
              {!isViewingArtifact && (
                <Card className="border shadow-lg">
                  <CardHeader className="bg-muted/30 border-b">
                    <CardTitle>
                      Current Status:{' '}
                      <span className="text-primary capitalize">
                        {activeStage === 'completed' ? 'Finished' : activeStage === 'linkedin' ? 'LinkedIn Draft' : activeStage}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {activeStage === 'clarify' && !brief && 'Generating clarifying questions...'}
                      {activeStage === 'clarify' && brief && !brief.isReady && 'We need a bit more info to tailor the content to you.'}
                      {activeStage !== 'clarify' && activeStage !== 'completed' && 'Our AI orchestration engine is working its magic.'}
                      {activeStage === 'completed' && 'Your content has been generated and published!'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-6">
                    {/* Clarify: Q&A form */}
                    {activeStage === 'clarify' && brief && !brief.isReady && (
                      <form onSubmit={handleAnswerSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                          {brief.clarifyingQuestions.map((q: any) => (
                            <div key={q.id} className="space-y-2">
                              <label className="text-sm font-medium text-foreground">{q.question}</label>
                              <Textarea
                                required
                                placeholder="Your answer..."
                                value={answers[q.id] || ''}
                                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                                className="bg-background focus:ring-primary/20"
                              />
                            </div>
                          ))}
                        </div>
                        <Button type="submit" disabled={isSubmitting} className="w-full">
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                            </>
                          ) : (
                            'Continue'
                          )}
                        </Button>
                      </form>
                    )}

                    {/* Processing spinner for intermediate stages */}
                    {['outline', 'write', 'edit', 'linkedin', 'publish'].includes(activeStage) && (
                      <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center animate-in fade-in zoom-in-95 duration-500">
                        <div className="relative">
                          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                          <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
                        </div>
                        <p className="text-lg text-muted-foreground max-w-sm">
                          {activeStage === 'linkedin'
                            ? 'Generating your LinkedIn post draft...'
                            : 'Please wait while we intelligently craft your content. This may take a few moments.'}
                        </p>
                      </div>
                    )}

                    {/* Completed state */}
                    {activeStage === 'completed' && (
                      <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center animate-in fade-in zoom-in-95 duration-700">
                        <CheckCircle2 className="h-20 w-20 text-green-500 drop-shadow-md" />
                        <div className="space-y-2">
                          <h2 className="text-2xl font-bold">All done!</h2>
                          <p className="text-muted-foreground pb-4 max-w-sm mx-auto text-balance">
                            Your content was fully generated and published as a draft on dev.to. Click any completed
                            stage on the left to review its output.
                          </p>

                          {job?.publishedPost?.postUrl && (
                            <div className="p-4 mb-6 bg-primary/10 border border-primary/20 rounded-lg max-w-md mx-auto">
                              <p className="text-sm font-medium mb-2">View your dev.to draft:</p>
                              <a
                                href={job.publishedPost.postUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline break-all"
                              >
                                {job.publishedPost.postUrl}
                              </a>
                            </div>
                          )}

                          <div className="flex flex-wrap justify-center gap-3 mt-4">
                            {completedStages.includes('linkedin') && (
                              <Button
                                variant="outline"
                                className="gap-2"
                                onClick={() => setSelectedStage('linkedin')}
                              >
                                <Linkedin className="h-4 w-4" />
                                View LinkedIn Draft
                              </Button>
                            )}
                            <Button onClick={() => router.push('/')} variant="outline" className="gap-2">
                              <ArrowRight className="h-4 w-4" /> Start New Content
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
