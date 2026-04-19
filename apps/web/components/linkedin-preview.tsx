'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Check, Copy, Eye, FileText, User } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = 'http://localhost:3001';
const LINKEDIN_CHAR_LIMIT = 3000;

interface LinkedInPreviewProps {
  linkedinDraftId: string;
}

export function LinkedInPreview({ linkedinDraftId }: LinkedInPreviewProps) {
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!linkedinDraftId) return;
    setLoading(true);
    fetch(`${API_BASE}/api/linkedin-drafts/${linkedinDraftId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setDraft(d))
      .catch(() => setDraft(null))
      .finally(() => setLoading(false));
  }, [linkedinDraftId]);

  const handleCopy = async () => {
    if (!draft?.content) return;
    try {
      await navigator.clipboard.writeText(draft.content);
      setCopied(true);
      toast.success('LinkedIn draft copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading LinkedIn draft...</p>;
  if (!draft) return <p className="text-sm text-muted-foreground">LinkedIn draft not found.</p>;

  const charCount = draft.content?.length || 0;
  const isOverLimit = charCount > LINKEDIN_CHAR_LIMIT;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={isOverLimit ? 'destructive' : 'secondary'} className="text-xs tabular-nums">
            {charCount.toLocaleString()} / {LINKEDIN_CHAR_LIMIT.toLocaleString()} chars
          </Badge>
          {isOverLimit && (
            <span className="text-xs text-destructive">Over LinkedIn character limit</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy to Clipboard
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="preview" className="w-full">
        <TabsList>
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="raw" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Raw Text
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview">
          <div className="rounded-lg border bg-[#f3f2ef] dark:bg-[#1b1f23] p-4">
            <div className="max-w-lg mx-auto bg-card rounded-lg border shadow-sm overflow-hidden">
              {/* LinkedIn post header */}
              <div className="p-4 pb-2 flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Your Name</p>
                  <p className="text-xs text-muted-foreground">Your headline</p>
                  <p className="text-xs text-muted-foreground">Just now</p>
                </div>
              </div>

              {/* Post body */}
              <div className="px-4 pb-4">
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {draft.content}
                </div>
              </div>

              {/* Fake engagement bar */}
              <div className="border-t px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span>Like</span>
                <span>Comment</span>
                <span>Repost</span>
                <span>Send</span>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="raw">
          <ScrollArea className="h-[400px] rounded-md border">
            <pre className="p-4 text-sm font-mono whitespace-pre-wrap">{draft.content}</pre>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
