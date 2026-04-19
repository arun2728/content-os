'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LinkedInPreview } from '@/components/linkedin-preview';
import { ChevronDown, FileText, List, PenLine, Sparkles, ExternalLink } from 'lucide-react';

type Stage = 'clarify' | 'outline' | 'write' | 'edit' | 'linkedin' | 'publish';

interface StageArtifactViewerProps {
  stage: Stage;
  job: any;
  brief: any;
}

const API_BASE = 'http://localhost:3001';

function useFetchArtifact<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [url]);

  return { data, loading };
}

function ClarifyArtifact({ brief }: { brief: any }) {
  if (!brief) return <p className="text-muted-foreground">No brief data available.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-1">Original Prompt</h3>
        <p className="text-sm text-muted-foreground">{brief.initialPrompt}</p>
      </div>

      {brief.refinedPrompt && (
        <div>
          <h3 className="text-sm font-semibold mb-1">Refined Prompt</h3>
          <p className="text-sm text-foreground bg-muted/50 p-3 rounded-md">{brief.refinedPrompt}</p>
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Clarifying Questions & Answers</h3>
        {brief.clarifyingQuestions?.map((q: any) => (
          <Collapsible key={q.id} defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-sm font-medium hover:text-primary transition-colors group">
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]:-rotate-90" />
              <Badge variant="outline" className="text-[10px] capitalize">{q.category}</Badge>
              <span className="flex-1">{q.question}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-6 mt-1">
              <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                {q.userAnswer || <span className="italic">Not answered</span>}
              </p>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

function OutlineArtifact({ outlineId }: { outlineId: string }) {
  const { data: outline, loading } = useFetchArtifact<any>(
    outlineId ? `${API_BASE}/api/outlines/${outlineId}` : null
  );

  if (loading) return <p className="text-sm text-muted-foreground">Loading outline...</p>;
  if (!outline) return <p className="text-sm text-muted-foreground">Outline not found.</p>;

  return (
    <div className="space-y-1">
      {outline.items?.map((item: any) => (
        <div
          key={item.id}
          className="flex items-start gap-2 py-1.5"
          style={{ paddingLeft: `${item.depth * 1.5}rem` }}
        >
          <List className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">{item.title}</p>
            {item.description && (
              <p className="text-xs text-muted-foreground">{item.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContentArtifact({ artifactId, endpoint, icon: Icon, label }: {
  artifactId: string;
  endpoint: string;
  icon: React.ElementType;
  label: string;
}) {
  const { data: artifact, loading } = useFetchArtifact<any>(
    artifactId ? `${API_BASE}/api/${endpoint}/${artifactId}` : null
  );

  if (loading) return <p className="text-sm text-muted-foreground">Loading {label.toLowerCase()}...</p>;
  if (!artifact) return <p className="text-sm text-muted-foreground">{label} not found.</p>;

  return (
    <Tabs defaultValue="preview" className="w-full">
      <TabsList>
        <TabsTrigger value="preview" className="gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          Preview
        </TabsTrigger>
        <TabsTrigger value="raw" className="gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Raw Text
        </TabsTrigger>
      </TabsList>
      <TabsContent value="preview">
        <ScrollArea className="h-[400px] rounded-md border p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {artifact.content}
          </div>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="raw">
        <ScrollArea className="h-[400px] rounded-md border">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap">{artifact.content}</pre>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

function PublishArtifact({ job }: { job: any }) {
  const publishResult = job?.stageResults?.find((r: any) => r.stage === 'publish');

  return (
    <div className="space-y-4">
      {job?.publishedPost?.postUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-600">Published as Draft on dev.to</Badge>
          </div>
          <div className="p-4 bg-muted/30 border rounded-lg space-y-2">
            <p className="text-sm font-medium">dev.to Article URL</p>
            <a
              href={job.publishedPost.postUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline break-all flex items-center gap-1.5"
            >
              {job.publishedPost.postUrl}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          </div>
          {job.publishedPost.dashboardUrl && (
            <div className="p-4 bg-muted/30 border rounded-lg space-y-2">
              <p className="text-sm font-medium">dev.to Dashboard</p>
              <a
                href={job.publishedPost.dashboardUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline break-all flex items-center gap-1.5"
              >
                {job.publishedPost.dashboardUrl}
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {publishResult ? 'Post URL not available.' : 'Publish stage has not completed yet.'}
        </p>
      )}
    </div>
  );
}

export function StageArtifactViewer({ stage, job, brief }: StageArtifactViewerProps) {
  const stageResult = job?.stageResults?.find((r: any) => r.stage === stage);

  const stageLabels: Record<Stage, { title: string; icon: React.ElementType }> = {
    clarify: { title: 'Brief & Clarification', icon: Sparkles },
    outline: { title: 'Content Outline', icon: List },
    write: { title: 'Written Draft', icon: PenLine },
    edit: { title: 'Edited Draft', icon: FileText },
    linkedin: { title: 'LinkedIn Draft', icon: FileText },
    publish: { title: 'Published Post', icon: ExternalLink },
  };

  const { title, icon: StageIcon } = stageLabels[stage];

  return (
    <Card className="border shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardHeader className="bg-muted/30 border-b pb-4">
        <div className="flex items-center gap-2">
          <StageIcon className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="secondary" className="ml-auto text-xs">Completed</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {stage === 'clarify' && <ClarifyArtifact brief={brief} />}

        {stage === 'outline' && stageResult?.data?.outlineId && (
          <OutlineArtifact outlineId={stageResult.data.outlineId} />
        )}

        {stage === 'write' && stageResult?.data?.draftId && (
          <ContentArtifact
            artifactId={stageResult.data.draftId}
            endpoint="drafts"
            icon={PenLine}
            label="Draft"
          />
        )}

        {stage === 'edit' && stageResult?.data?.editedDraftId && (
          <ContentArtifact
            artifactId={stageResult.data.editedDraftId}
            endpoint="edited-drafts"
            icon={FileText}
            label="Edited Draft"
          />
        )}

        {stage === 'linkedin' && stageResult?.data?.linkedinDraftId && (
          <LinkedInPreview linkedinDraftId={stageResult.data.linkedinDraftId} />
        )}

        {stage === 'publish' && <PublishArtifact job={job} />}
      </CardContent>
    </Card>
  );
}
