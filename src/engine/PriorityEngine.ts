import type { ForgeElement } from './TaskIndex';

export type Urgency = 'critical' | 'high' | 'medium' | 'low';

export function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export class PriorityEngine {
  static calculate(el: ForgeElement): number {
    let score = el.priority * 10;
    if (el.starred) score += 30;
    score += this.dueBonus(el.dueDate);
    score += this.storyPointsBonus(el.storyPoints);
    return score;
  }

  static dueBonus(due: string | null): number {
    const days = daysUntil(due);
    if (days === null) return 0;
    if (days < 0) return 60;
    if (days === 0) return 55;
    if (days === 1) return 45;
    if (days <= 3) return 35;
    if (days <= 7) return 20;
    if (days <= 14) return 10;
    if (days <= 30) return 5;
    return 0;
  }

  static storyPointsBonus(sp: number | null): number {
    if (sp === null) return 0;
    if (sp <= 2) return 15;
    if (sp <= 3) return 12;
    if (sp <= 5) return 8;
    if (sp <= 8) return 5;
    return 0;
  }

  static urgency(score: number): Urgency {
    if (score >= 90) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }
}