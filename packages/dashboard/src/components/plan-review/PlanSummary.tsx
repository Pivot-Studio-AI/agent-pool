import { Card } from '../shared/Card';

interface PlanSummaryProps {
  heading: string;
  content: string;
}

export function PlanSummary({ heading, content }: PlanSummaryProps) {
  return (
    <Card>
      <h3 className="text-sm font-bold text-text-primary mb-3">{heading}</h3>
      <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
        {content}
      </div>
    </Card>
  );
}
