'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Circle, Loader2, ArrowRight } from 'lucide-react';

type Stage = 'clarify' | 'outline' | 'write' | 'edit' | 'publish' | 'completed';

const STAGES: { id: Stage; label: string; description: string }[] = [
  { id: 'clarify', label: 'Clarify', description: 'Generating & answering questions' },
  { id: 'outline', label: 'Outline', description: 'Creating document structure' },
  { id: 'write', label: 'Write', description: 'Drafting initial content' },
  { id: 'edit', label: 'Edit', description: 'Refining and polishing' },
  { id: 'publish', label: 'Publish', description: 'Sending to Blogger' },
];

export default function JobProgressPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [job, setJob] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStage, setActiveStage] = useState<Stage>('clarify');
  const [error, setError] = useState<string | null>(null);

  // Use refs to avoid starting multiple tasks at once during strict mode double renders
  const taskLocks = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    // Poll job status every 2 seconds
    const fetchJob = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/jobs/${id}`);
        if (!res.ok) {
          if (res.status === 404) setError('Job not found');
          return;
        }
        const data = await res.json();
        setJob(data);
        
        // Compute active stage based on stageResults
        const completedStages = data.stageResults?.map((r: any) => r.stage) || [];
        if (completedStages.includes('publish')) setActiveStage('completed');
        else if (completedStages.includes('edit')) setActiveStage('publish');
        else if (completedStages.includes('write')) setActiveStage('edit');
        else if (completedStages.includes('outline')) setActiveStage('write');
        else if (completedStages.includes('clarify') && data.status !== 'clarifying') setActiveStage('outline');
        else setActiveStage('clarify');

      } catch (err) {
        console.error(err);
      }
    };

    fetchJob();
    interval = setInterval(fetchJob, 2000);

    return () => clearInterval(interval);
  }, [id]);

  // Orchestration engine in frontend
  useEffect(() => {
    if (!job) return;

    const runOrchestrator = async () => {
      try {
        const completedStages = job.stageResults?.map((r: any) => r.stage) || [];

        // 1. CLARIFY
        if (!completedStages.includes('clarify') && !taskLocks.current['clarify_init']) {
          taskLocks.current['clarify_init'] = true;
          const res = await fetch(`http://localhost:3001/api/jobs/${id}/clarify`, { method: 'POST' });
          if (!res.ok) throw new Error('Failed to start clarification');
          const data = await res.json();
          // The backend returns { briefId, questions }
          const briefRes = await fetch(`http://localhost:3001/api/briefs/${data.briefId}`);
          setBrief(await briefRes.json());
        }

        // If clarify is completed, we should load the brief to check if it's ready
        let currentBrief = brief;
        if (completedStages.includes('clarify') && !currentBrief) {
          const clarifyResult = job.stageResults.find((r: any) => r.stage === 'clarify');
          if (clarifyResult?.data?.briefId) {
             const briefRes = await fetch(`http://localhost:3001/api/briefs/${clarifyResult.data.briefId}`);
             currentBrief = await briefRes.json();
             setBrief(currentBrief);
          }
        }

        // Only proceed if brief is ready
        if (!currentBrief || !currentBrief.isReady) return;

        // 2. OUTLINE
        if (!completedStages.includes('outline') && !taskLocks.current['outline']) {
          taskLocks.current['outline'] = true;
          await fetch(`http://localhost:3001/api/jobs/${id}/outline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ briefId: currentBrief.id })
          });
        }

        // 3. WRITE
        if (completedStages.includes('outline') && !completedStages.includes('write') && !taskLocks.current['write']) {
          const outlineResult = job.stageResults.find((r: any) => r.stage === 'outline');
          if (outlineResult?.data?.outlineId) {
             taskLocks.current['write'] = true;
             await fetch(`http://localhost:3001/api/jobs/${id}/write`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ briefId: currentBrief.id, outlineId: outlineResult.data.outlineId })
             });
          }
        }

        // 4. EDIT
        if (completedStages.includes('write') && !completedStages.includes('edit') && !taskLocks.current['edit']) {
          const writeResult = job.stageResults.find((r: any) => r.stage === 'write');
          if (writeResult?.data?.draftId) {
             taskLocks.current['edit'] = true;
             await fetch(`http://localhost:3001/api/jobs/${id}/edit`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ draftId: writeResult.data.draftId })
             });
          }
        }

        // 5. PUBLISH
        if (completedStages.includes('edit') && !completedStages.includes('publish') && !taskLocks.current['publish']) {
          const editResult = job.stageResults.find((r: any) => r.stage === 'edit');
          if (editResult?.data?.editedDraftId) {
             taskLocks.current['publish'] = true;
             await fetch(`http://localhost:3001/api/jobs/${id}/publish`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ editedDraftId: editResult.data.editedDraftId, title: "Generated Content" })
             });
          }
        }

      } catch (err) {
        console.error('Orchestration error:', err);
      }
    };

    runOrchestrator();

  }, [job, id, brief]);

  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brief) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`http://localhost:3001/api/briefs/${brief.id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId: brief.id, answers })
      });
      if (res.ok) {
         const updatedBrief = await res.json();
         setBrief(updatedBrief);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const completedStages = job?.stageResults?.map((r: any) => r.stage) || [];

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
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-2">
            Job Progress
          </h1>
          <p className="text-muted-foreground text-lg">
            Track the generation of your content in real-time.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Stepper / Timeline */}
          <Card className="lg:col-span-1 border border-border/50 shadow-sm bg-card/50 backdrop-blur-sm self-start sticky top-8">
            <CardHeader>
               <CardTitle className="text-lg">Pipeline Stages</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="space-y-6">
                 {STAGES.map((stage, idx) => {
                   const isCompleted = completedStages.includes(stage.id) && (stage.id !== 'clarify' || brief?.isReady);
                   const isActive = activeStage === stage.id;
                   const isPending = !isCompleted && !isActive;

                   return (
                     <div key={stage.id} className="flex gap-4 relative">
                       {/* Connection Line */}
                       {idx !== STAGES.length - 1 && (
                         <div className={`absolute top-8 left-3 w-[2px] h-full -ml-[1px] transition-colors duration-500 ${isCompleted ? 'bg-primary' : 'bg-muted'}`} />
                       )}
                       
                       {/* Icon Indicator */}
                       <div className="relative z-10 flex items-center justify-center w-6 h-6 rounded-full mt-1 bg-background">
                         {isCompleted ? (
                           <CheckCircle2 className="w-6 h-6 text-primary" />
                         ) : isActive ? (
                           <Loader2 className="w-6 h-6 text-primary animate-spin" />
                         ) : (
                           <Circle className="w-5 h-5 text-muted-foreground" />
                         )}
                       </div>

                       {/* Content */}
                       <div className="pb-1 text-sm flex-1">
                         <p className={`font-semibold transition-colors duration-300 ${isActive ? 'text-primary' : isPending ? 'text-muted-foreground' : 'text-foreground'}`}>
                           {stage.label}
                         </p>
                         <p className="text-muted-foreground text-xs">{stage.description}</p>
                       </div>
                     </div>
                   );
                 })}
               </div>
            </CardContent>
          </Card>

          {/* Main Action Area */}
          <div className="lg:col-span-2 space-y-6">
             <Card className="border shadow-lg">
               <CardHeader className="bg-muted/30 border-b">
                 <CardTitle>Current Status: <span className="text-primary capitalize">{activeStage === 'completed' ? 'Finished' : activeStage}</span></CardTitle>
                 <CardDescription>
                   {activeStage === 'clarify' && !brief && "Generating clarifying questions..."}
                   {activeStage === 'clarify' && brief && !brief.isReady && "We need a bit more info to tailor the content to you."}
                   {activeStage !== 'clarify' && activeStage !== 'completed' && "Our AI orchestration engine is working its magic."}
                   {activeStage === 'completed' && "Your content is ready to be published or has been published successfully!"}
                 </CardDescription>
               </CardHeader>
               
               <CardContent className="p-6">
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
                       {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : 'Continue'}
                     </Button>
                   </form>
                 )}

                 {(activeStage === 'outline' || activeStage === 'write' || activeStage === 'edit' || activeStage === 'publish') && (
                   <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center animate-in fade-in zoom-in-95 duration-500">
                     <div className="relative">
                       <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                       <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
                     </div>
                     <p className="text-lg text-muted-foreground max-w-sm">
                       Please wait while we intelligently craft your content. This may take a few moments depending on the step complexity.
                     </p>
                   </div>
                 )}

                 {activeStage === 'completed' && (
                   <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center animate-in fade-in zoom-in-95 duration-700">
                     <CheckCircle2 className="h-20 w-20 text-green-500 drop-shadow-md" />
                     <div className="space-y-2">
                       <h2 className="text-2xl font-bold">All done!</h2>
                       <p className="text-muted-foreground pb-4 max-w-sm mx-auto text-balance">
                         Your content was fully generated, drafted, and submitted to Blogger!
                       </p>
                       
                       {job?.publishedPost?.postUrl && (
                         <div className="p-4 mb-6 bg-primary/10 border border-primary/20 rounded-lg max-w-md mx-auto">
                           <p className="text-sm font-medium mb-2">View your draft:</p>
                           <a href={job.publishedPost.postUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">
                             {job.publishedPost.postUrl}
                           </a>
                         </div>
                       )}

                       <Button onClick={() => router.push('/')} variant="outline" className="gap-2 mt-4">
                          <ArrowRight className="h-4 w-4" /> Start New Content
                       </Button>
                     </div>
                   </div>
                 )}
               </CardContent>
             </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
