'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';
import { ClarifyingQuestion } from '@content-os/shared';

interface ClarifierProps {
  jobId: string;
  onBriefReady: (briefId: string) => void;
  onBack: () => void;
}

export function Clarifier({ jobId, onBriefReady, onBack }: ClarifierProps) {
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [briefId, setBriefId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    // Generate clarifying questions
    const generateQuestions = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/jobs/${jobId}/clarify`, {
          method: 'POST',
        });

        if (res.ok) {
          const { briefId: newBriefId, questions: newQuestions } = await res.json();
          setBriefId(newBriefId);
          setQuestions(newQuestions);
          // Initialize answers object
          setAnswers(newQuestions.reduce((acc: Record<string, string>, q: ClarifyingQuestion) => {
            acc[q.id] = '';
            return acc;
          }, {}));
        }
      } catch (error) {
        console.error('[v0] Error generating questions:', error);
      } finally {
        setLoading(false);
      }
    };

    generateQuestions();
  }, [jobId]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmitAnswers = async () => {
    setAnswering(true);

    try {
      const res = await fetch(`http://localhost:3001/api/briefs/${briefId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId, answers }),
      });

      if (res.ok) {
        const brief = await res.json();
        if (brief.isReady) {
          onBriefReady(briefId);
        }
      }
    } catch (error) {
      console.error('[v0] Error submitting answers:', error);
    } finally {
      setAnswering(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Generating clarifying questions...</p>
        </CardContent>
      </Card>
    );
  }

  const allAnswered = questions.every((q) => answers[q.id]?.trim());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Clarifying Questions</h2>
        <Button variant="outline" onClick={onBack} disabled={answering}>
          Back
        </Button>
      </div>

      <p className="text-muted-foreground">
        Please answer these questions to help us create better content for you.
      </p>

      <div className="space-y-6">
        {questions.map((question) => (
          <Card key={question.id}>
            <CardHeader>
              <CardTitle className="text-lg">{question.question}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Your answer..."
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                rows={3}
                disabled={answering}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        onClick={handleSubmitAnswers}
        disabled={!allAnswered || answering}
        className="w-full"
        size="lg"
      >
        {answering ? 'Processing...' : 'Continue to Outline'}
      </Button>
    </div>
  );
}
