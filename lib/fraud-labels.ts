export const FLAG_THRESHOLD = 50
export const SUSPEND_THRESHOLD = 80

export function fraudRiskLabel(score: number): { label: string; variant: 'outline' | 'secondary' | 'default' | 'destructive' } {
  if (score >= SUSPEND_THRESHOLD) return { label: 'Critical', variant: 'destructive' }
  if (score >= FLAG_THRESHOLD) return { label: 'High', variant: 'default' }
  if (score >= 20) return { label: 'Medium', variant: 'secondary' }
  if (score > 0) return { label: 'Low', variant: 'outline' }
  return { label: 'Clean', variant: 'outline' }
}
