import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Clock, TrendingDown, TrendingUp, Target,
  Zap, CheckCircle2, Search, MousePointerClick, Activity,
  CalendarX, Layers, ArrowUpRight, Lightbulb, FileText,
  BarChart2, Globe, Link2, Eye,
} from "lucide-react";
import type { GSCData, GSCQuery, GSCPage } from "@/integrations/searchConsole";
import type { GA4Data, GA4TrafficSource } from "@/integrations/googleAnalytics";

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = "critical" | "warning" | "opportunity" | "win";

interface Insight {
  id: string;
  severity: Severity;
  icon: React.ElementType;
  title: string;
  detail: string;
  impact: number;   // 0–100, used to sort within severity tiers
  action?: { label: string; onClick: () => void };
}

interface Props {
  clientId: string;
  onTabChange?: (tab: string) => void;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SEV_BORDER: Record<Severity, string> = {
  critical:    "border-l-red-500",
  warning:     "border-l-amber-500",
  opportunity: "border-l-blue-500",
  win:         "border-l-green-500",
};
const SEV_BG: Record<Severity, string> = {
  critical:    "bg-red-50    dark:bg-red-950/20",
  warning:     "bg-amber-50  dark:bg-amber-950/20",
  opportunity: "bg-blue-50   dark:bg-blue-950/20",
  win:         "bg-green-50  dark:bg-green-950/20",
};
const SEV_ICON: Record<Severity, string> = {
  critical:    "text-red-500",
  warning:     "text-amber-500",
  opportunity: "text-blue-500",
  win:         "text-green-500",
};
const SEV_ORDER: Record<Severity, number> = {
  critical: 0, warning: 1, opportunity: 2, win: 3,
};

const COUNT_BASED = ["Backlinks", "Content Writing", "Social Media"];
const ACTIVE_ST   = ["not_started", "in_progress", "blocked", "pending_approval"];

// ─── Util helpers ─────────────────────────────────────────────────────────────

const pct = (a: number, b: number) =>
  b === 0 ? 0 : Math.round(((a - b) / b) * 100);

const avg = (arr: number[]) =>
  arr.length === 0 ? 0 : arr.reduce((s, n) => s + n, 0) / arr.length;

function shortPage(url: string, max = 42): string {
  try {
    const u = new URL(url);
    const p = u.pathname === "/" ? u.hostname : u.pathname;
    return p.length > max ? p.slice(0, max) + "…" : p;
  } catch {
    return url.slice(0, max);
  }
}

function todayStr()    { return new Date().toISOString().slice(0, 10); }
function addDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function daysLeft() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
}
function snapshotDayGap(a?: string, b?: string): number {
  if (!a || !b) return 0;
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

// ─── Health score ─────────────────────────────────────────────────────────────

function healthScore(params: {
  overdueTasks: number;
  completedThisMonth: number;
  totalTasks: number;
  timeBudgetOk: boolean;
  deliverableAvg: number;         // 0-1, -1 = no data
  gscClickPct: number;
  hasGSC: boolean;
  ga4SessionPct: number;
  hasGA4: boolean;
  highBounce: boolean;
}): number {
  const { overdueTasks, completedThisMonth, totalTasks,
          timeBudgetOk, deliverableAvg,
          gscClickPct, hasGSC,
          ga4SessionPct, hasGA4, highBounce } = params;

  let s = 80;                                       // start healthy
  s -= Math.min(overdueTasks * 10, 30);             // overdue tasks
  if (totalTasks > 0 && completedThisMonth > 0)
    s += Math.min(Math.round((completedThisMonth / totalTasks) * 10), 10);
  if (!timeBudgetOk) s -= 7;
  if (deliverableAvg >= 0) {
    if (deliverableAvg < 0.3)      s -= 12;
    else if (deliverableAvg < 0.6) s -= 5;
    else if (deliverableAvg > 0.85) s += 5;
  }
  if (hasGSC) {
    if (gscClickPct >= 15)       s += 8;
    else if (gscClickPct >= 5)   s += 3;
    else if (gscClickPct <= -20) s -= 12;
    else if (gscClickPct <= -10) s -= 6;
  }
  if (hasGA4) {
    if (ga4SessionPct <= -15) s -= 8;
    if (highBounce)            s -= 5;
    if (ga4SessionPct >= 15)  s += 5;
  }
  return Math.max(0, Math.min(100, s));
}

function scoreColor(s: number) {
  return s >= 72 ? "text-green-600" : s >= 52 ? "text-amber-600" : "text-red-600";
}
function scoreLabel(s: number) {
  return s >= 80 ? "Healthy" : s >= 65 ? "On track" : s >= 45 ? "Needs attention" : "At risk";
}
function scoreBarBg(s: number) {
  return s >= 72 ? "#22c55e" : s >= 52 ? "#f59e0b" : "#ef4444";
}

// ─── Task insight generators ──────────────────────────────────────────────────

function taskInsights(
  tasks: any[],
  timeLogs: any[],
  deliverableMap: Record<string, number>,
  navigate: (p: string) => void,
  onTabChange?: (t: string) => void,
): Insight[] {
  const today   = todayStr();
  const in3days = addDays(3);
  const list: Insight[] = [];

  const overdue  = tasks.filter(t => ACTIVE_ST.includes(t.status) && t.due_date && t.due_date < today);
  const atRisk   = tasks.filter(t => ACTIVE_ST.includes(t.status) && t.due_date && t.due_date >= today && t.due_date <= in3days);

  if (overdue.length > 0) {
    list.push({
      id: "overdue", severity: "critical", icon: CalendarX,
      impact: Math.min(overdue.length * 20, 100),
      title: `${overdue.length} task${overdue.length > 1 ? "s" : ""} overdue`,
      detail: overdue.slice(0, 2).map((t: any) => `"${t.title}"`).join(", ") +
        (overdue.length > 2 ? ` and ${overdue.length - 2} more` : ""),
      action: { label: "Review tasks", onClick: () => onTabChange?.("tasks") },
    });
  }

  if (atRisk.length > 0) {
    list.push({
      id: "at-risk", severity: "warning", icon: Clock,
      impact: atRisk.length * 15,
      title: `${atRisk.length} task${atRisk.length > 1 ? "s" : ""} due within 3 days`,
      detail: atRisk.map((t: any) => `"${t.title}"`).slice(0, 2).join(", "),
      action: { label: "View tasks", onClick: () => onTabChange?.("tasks") },
    });
  }

  // Time over-budget
  const timeByTask: Record<string, number> = {};
  for (const l of timeLogs as any[]) timeByTask[l.task_id] = (timeByTask[l.task_id] || 0) + l.duration_minutes;
  const overBudget = tasks.filter((t: any) => t.estimated_minutes > 0 && (timeByTask[t.id] || 0) > t.estimated_minutes * 1.2);
  if (overBudget.length > 0) {
    const t = overBudget[0] as any;
    const over = Math.round(((timeByTask[t.id] - t.estimated_minutes) / t.estimated_minutes) * 100);
    list.push({
      id: "over-budget", severity: "warning", icon: Activity,
      impact: Math.min(over, 60),
      title: `Time over budget on ${overBudget.length} task${overBudget.length > 1 ? "s" : ""}`,
      detail: `"${t.title}" is ${over}% over its estimate. Review scope or update the estimate.`,
      action: { label: "View time log", onClick: () => onTabChange?.("time") },
    });
  }

  // Deliverable targets behind pace
  const countBased = tasks.filter((t: any) => COUNT_BASED.includes(t.service_type) && ACTIVE_ST.includes(t.status) && t.target_count);
  for (const t of countBased as any[]) {
    const done = deliverableMap[t.id] || 0;
    const pctDone = done / t.target_count;
    const dl = daysLeft();
    if ((pctDone < 0.5 && dl < 10) || (pctDone < 0.25 && dl < 20)) {
      list.push({
        id: `behind-${t.id}`, severity: "critical", icon: Target,
        impact: Math.round((1 - pctDone) * 60),
        title: `Deliverable target at risk`,
        detail: `"${t.title}" is ${Math.round(pctDone * 100)}% complete (${done}/${t.target_count}) with ${dl} day${dl !== 1 ? "s" : ""} left this month.`,
        action: { label: "Open task", onClick: () => onTabChange?.("tasks") },
      });
    }
  }

  // Wins: tasks completed this month
  const monthStart    = startOfMonth();
  const completedThis = tasks.filter((t: any) => t.status === "completed" && t.created_at >= monthStart);
  if (completedThis.length > 0) {
    const stillActive = tasks.filter((t: any) => ACTIVE_ST.includes(t.status)).length;
    list.push({
      id: "completed", severity: "win", icon: CheckCircle2,
      impact: Math.min(completedThis.length * 10, 50),
      title: `${completedThis.length} task${completedThis.length > 1 ? "s" : ""} completed this month`,
      detail: `${stillActive} active task${stillActive !== 1 ? "s" : ""} remaining.`,
    });
  }

  return list;
}

// ─── GSC insight generators ───────────────────────────────────────────────────

function gscInsights(
  snap0: GSCData,
  snap1: GSCData | undefined,
  hasGap: boolean, // true = snapshots are ≥10 days apart → per-entity comparison is meaningful
  onTabChange?: (t: string) => void,
  navigate?: (p: string) => void,
  clientId?: string,
): Insight[] {
  const list: Insight[] = [];
  const cur  = snap0.current;
  const prev = snap0.previous; // always available (30d summary)

  // ── Summary-level (always available) ────────────────────────────────────

  const clickPct = pct(cur.summary.clicks, prev.summary.clicks);
  if (clickPct <= -20) {
    list.push({
      id: "gsc-click-drop", severity: "critical", icon: TrendingDown,
      impact: Math.min(Math.abs(clickPct), 100),
      title: `Organic clicks down ${Math.abs(clickPct)}% vs previous 30 days`,
      detail: `${cur.summary.clicks.toLocaleString()} clicks this period vs ${prev.summary.clicks.toLocaleString()} previously. Investigate which queries lost rankings.`,
      action: { label: "View Search Console", onClick: () => onTabChange?.("integrations") },
    });
  } else if (clickPct <= -8) {
    list.push({
      id: "gsc-click-soft-drop", severity: "warning", icon: TrendingDown,
      impact: Math.abs(clickPct),
      title: `Organic clicks dipped ${Math.abs(clickPct)}%`,
      detail: `${cur.summary.clicks.toLocaleString()} clicks vs ${prev.summary.clicks.toLocaleString()} previously. Monitor closely for continued decline.`,
    });
  }

  const posDelta = cur.summary.avgPosition - prev.summary.avgPosition; // positive = worse
  if (posDelta >= 3) {
    list.push({
      id: "gsc-pos-drop", severity: "warning", icon: Search,
      impact: Math.round(posDelta * 10),
      title: `Average ranking slipped ${posDelta.toFixed(1)} positions`,
      detail: `Average position moved from ${prev.summary.avgPosition.toFixed(1)} to ${cur.summary.avgPosition.toFixed(1)}. Run an on-page SEO audit and check for new competitors.`,
      action: { label: "Create On-Page task", onClick: () => navigate?.(`/tasks?new=1&service=On-Page+SEO&client=${clientId}`) },
    });
  }

  // Impression collapse with clicks holding → likely lost non-brand visibility
  const impPct = pct(cur.summary.impressions, prev.summary.impressions);
  if (impPct <= -25 && clickPct > -10) {
    list.push({
      id: "gsc-imp-drop", severity: "warning", icon: Eye,
      impact: Math.abs(impPct),
      title: `Impressions down ${Math.abs(impPct)}% but clicks held`,
      detail: `Site may have lost rankings for informational queries. Brand/commercial queries still convert but top-of-funnel visibility is shrinking.`,
    });
  }

  // Win: clicks up significantly
  if (clickPct >= 15) {
    list.push({
      id: "gsc-win", severity: "win", icon: TrendingUp,
      impact: Math.min(clickPct, 80),
      title: `Organic clicks up ${clickPct}% vs previous 30 days`,
      detail: `${cur.summary.clicks.toLocaleString()} clicks this period vs ${prev.summary.clicks.toLocaleString()} previously. SEO efforts are paying off.`,
    });
  }

  // ── Intra-period trend (always available) ────────────────────────────────

  const trend = cur.trend;
  if (trend.length >= 14) {
    const half   = Math.floor(trend.length / 2);
    const first  = avg(trend.slice(0, half).map(d => d.clicks));
    const second = avg(trend.slice(half).map(d => d.clicks));
    const trendPct = pct(second, first);
    if (trendPct <= -20) {
      list.push({
        id: "gsc-trend-down", severity: "warning", icon: TrendingDown,
        impact: Math.abs(trendPct),
        title: `Click trend declining within this period (${Math.abs(trendPct)}% drop)`,
        detail: `The second half of this 30-day window is averaging ${Math.abs(trendPct)}% fewer clicks per day than the first half. Likely to show a worse comparison next month.`,
      });
    } else if (trendPct >= 20) {
      list.push({
        id: "gsc-trend-up", severity: "win", icon: TrendingUp,
        impact: trendPct,
        title: `Click trend accelerating (+${trendPct}% within period)`,
        detail: `Daily clicks are ${trendPct}% higher in the second half of this period vs the first. Momentum is building.`,
      });
    }
  }

  // ── Per-query and per-page (requires 2 snapshots with gap) ───────────────

  if (snap1 && hasGap) {
    const prevQueries = snap1.current.topQueries;
    const prevQMap    = new Map(prevQueries.map((q: GSCQuery) => [q.query, q]));

    // Position drops and gains
    for (const q of cur.topQueries as GSCQuery[]) {
      const p = prevQMap.get(q.query);
      if (!p) continue;
      const posChange = q.position - p.position; // positive = dropped

      if (posChange >= 5 && p.impressions >= 80) {
        list.push({
          id: `q-drop-${q.query}`, severity: "warning", icon: Search,
          impact: Math.round(Math.min(posChange * 5, 60) + Math.min(q.impressions / 50, 40)),
          title: `"${q.query}" dropped ${posChange.toFixed(0)} positions`,
          detail: `Now ranking #${q.position.toFixed(0)} (was #${p.position.toFixed(0)}) — ${q.impressions.toLocaleString()} impressions at risk. ${q.position > 20 ? "Content refresh + link building recommended." : "Check for competitor page improvements or algorithm changes."}`,
          action: {
            label: q.position > 15 ? "Create Backlinks task" : "Create Content task",
            onClick: () => navigate?.(`/tasks?new=1&service=${q.position > 15 ? "Backlinks" : "Content+Writing"}&client=${clientId}`),
          },
        });
      } else if (posChange <= -5 && q.impressions >= 80) {
        list.push({
          id: `q-gain-${q.query}`, severity: "win", icon: TrendingUp,
          impact: Math.round(Math.min(Math.abs(posChange) * 3, 50) + Math.min(q.impressions / 100, 50)),
          title: `"${q.query}" gained ${Math.abs(posChange).toFixed(0)} positions`,
          detail: `Moved from #${p.position.toFixed(0)} to #${q.position.toFixed(0)} with ${q.impressions.toLocaleString()} impressions. ${q.position <= 10 ? "Now on page 1." : "Keep building to reach page 1."}`,
        });
      }

      // CTR drop on well-ranked query
      const ctrDrop = p.ctr - q.ctr; // positive = dropped
      if (ctrDrop >= 2.5 && q.position <= 10 && q.impressions >= 150) {
        list.push({
          id: `q-ctr-${q.query}`, severity: "warning", icon: MousePointerClick,
          impact: Math.round(ctrDrop * 10 + Math.min(q.impressions / 50, 30)),
          title: `CTR dropped for "${q.query}" despite good ranking`,
          detail: `CTR fell from ${p.ctr.toFixed(1)}% to ${q.ctr.toFixed(1)}% at position #${q.position.toFixed(0)} (${q.impressions.toLocaleString()} impressions). Title/meta description review likely needed.`,
          action: {
            label: "Create On-Page task",
            onClick: () => navigate?.(`/tasks?new=1&service=On-Page+SEO&client=${clientId}`),
          },
        });
      }

      // Impression collapse (losing index coverage)
      const impPctQ = pct(q.impressions, p.impressions);
      if (impPctQ <= -40 && p.impressions >= 200) {
        list.push({
          id: `q-imp-${q.query}`, severity: "warning", icon: Eye,
          impact: Math.min(Math.abs(impPctQ), 70),
          title: `"${q.query}" lost ${Math.abs(impPctQ)}% of impressions`,
          detail: `Dropped from ${p.impressions.toLocaleString()} to ${q.impressions.toLocaleString()} impressions. May have lost index coverage for related long-tail variations.`,
        });
      }
    }

    // New rising queries (high impressions but not in previous top list)
    const prevQuerySet = new Set(prevQueries.map((q: GSCQuery) => q.query));
    for (const q of cur.topQueries as GSCQuery[]) {
      if (!prevQuerySet.has(q.query) && q.impressions >= 250) {
        list.push({
          id: `q-new-${q.query}`, severity: "opportunity", icon: Zap,
          impact: Math.min(q.impressions / 10, 70),
          title: `New rising query: "${q.query}"`,
          detail: `${q.impressions.toLocaleString()} impressions at position #${q.position.toFixed(0)} — not in last snapshot. Dedicated content or optimisation could unlock significant traffic.`,
          action: {
            label: "Create Content task",
            onClick: () => navigate?.(`/tasks?new=1&service=Content+Writing&client=${clientId}`),
          },
        });
        break; // one is enough for new queries
      }
    }

    // Per-page drops (need 2 snapshots)
    const prevPages = snap1.current.topPages;
    const prevPageMap = new Map(prevPages.map((p: GSCPage) => [p.page, p]));
    for (const pg of cur.topPages as GSCPage[]) {
      const pp = prevPageMap.get(pg.page);
      if (!pp) continue;
      const clickDrop = pct(pg.clicks, pp.clicks);
      if (clickDrop <= -40 && pp.clicks >= 40) {
        const posWorsened = pg.position - pp.position;
        list.push({
          id: `pg-drop-${pg.page}`, severity: posWorsened >= 4 ? "critical" : "warning",
          icon: FileText,
          impact: Math.min(Math.abs(clickDrop) + pp.clicks / 5, 90),
          title: `Page lost ${Math.abs(clickDrop)}% of organic clicks`,
          detail: `${shortPage(pg.page)} dropped from ${pp.clicks.toLocaleString()} to ${pg.clicks.toLocaleString()} clicks. ${posWorsened >= 3 ? `Position worsened by ${posWorsened.toFixed(1)}.` : "Position held but CTR dropped — consider title/meta refresh."}`,
          action: { label: "View Search Console", onClick: () => onTabChange?.("integrations") },
        });
        break; // surface top offender only
      }
    }
  }

  // ── Per-query opportunities (single snapshot) ────────────────────────────

  // Low-hanging fruit: positions 11-20 with meaningful impressions
  const lhf = cur.topQueries
    .filter((q: GSCQuery) => q.position >= 11 && q.position <= 20 && q.impressions >= 60)
    .sort((a: GSCQuery, b: GSCQuery) => b.impressions - a.impressions)
    .slice(0, 1);
  if (lhf.length > 0) {
    const q = lhf[0] as GSCQuery;
    const total = cur.topQueries.filter((qq: GSCQuery) => qq.position >= 11 && qq.position <= 20 && qq.impressions >= 60).length;
    list.push({
      id: "gsc-lhf", severity: "opportunity", icon: Zap,
      impact: Math.min(q.impressions / 5, 60),
      title: `${total} keyword${total > 1 ? "s" : ""} close to page 1`,
      detail: `"${q.query}" is at position #${q.position.toFixed(0)} with ${q.impressions.toLocaleString()} impressions — one content push or a few backlinks could break into top 10.`,
      action: {
        label: q.position >= 16 ? "Create Backlinks task" : "Create Content task",
        onClick: () => navigate?.(`/tasks?new=1&service=${q.position >= 16 ? "Backlinks" : "Content+Writing"}&client=${clientId}`),
      },
    });
  }

  // Low CTR on high-impression queries
  const lowCtr = cur.topQueries
    .filter((q: GSCQuery) => q.impressions >= 300 && q.ctr < 2.0 && q.position <= 15)
    .sort((a: GSCQuery, b: GSCQuery) => b.impressions - a.impressions)
    .slice(0, 1);
  if (lowCtr.length > 0) {
    const q = lowCtr[0] as GSCQuery;
    const total = cur.topQueries.filter((qq: GSCQuery) => qq.impressions >= 300 && qq.ctr < 2.0 && qq.position <= 15).length;
    list.push({
      id: "gsc-low-ctr", severity: "opportunity", icon: MousePointerClick,
      impact: Math.min((2 - q.ctr) * 20 + q.impressions / 50, 65),
      title: `${total} keyword${total > 1 ? "s" : ""} with untapped clicks (low CTR)`,
      detail: `"${q.query}" ranks #${q.position.toFixed(0)} with ${q.impressions.toLocaleString()} impressions but only ${q.ctr.toFixed(1)}% CTR. Rewriting the title/meta could significantly increase clicks with no ranking change.`,
      action: {
        label: "Create On-Page task",
        onClick: () => navigate?.(`/tasks?new=1&service=On-Page+SEO&client=${clientId}`),
      },
    });
  }

  // Zero-click pages with impressions
  const zeroClick = cur.topPages
    .filter((p: GSCPage) => p.impressions >= 400 && p.ctr < 0.5)
    .sort((a: GSCPage, b: GSCPage) => b.impressions - a.impressions)
    .slice(0, 1);
  if (zeroClick.length > 0) {
    const p = zeroClick[0] as GSCPage;
    list.push({
      id: "gsc-zero-click", severity: "opportunity", icon: Globe,
      impact: Math.min(p.impressions / 8, 60),
      title: `High-impression page getting almost no clicks`,
      detail: `${shortPage(p.page)} has ${p.impressions.toLocaleString()} impressions at position #${p.position.toFixed(0)} but only ${p.ctr.toFixed(1)}% CTR. Likely competing with rich snippets or SERP features — review the page's title and structured data.`,
    });
  }

  return list;
}

// ─── GA4 insight generators ───────────────────────────────────────────────────

function ga4Insights(
  snap0: GA4Data,
  snap1: GA4Data | undefined,
  hasGap: boolean,
  onTabChange?: (t: string) => void,
  navigate?: (p: string) => void,
  clientId?: string,
): Insight[] {
  const list: Insight[] = [];
  const cur  = snap0.current;
  const prev = snap0.previous;

  // ── Summary comparison (always) ──────────────────────────────────────────

  const sessionPct     = pct(cur.summary.sessions, prev.summary.sessions);
  const newUserPct     = pct(cur.summary.newUsers, prev.summary.newUsers);
  const bounceHigh     = cur.summary.bounceRate > 65;
  const bounceDelta    = cur.summary.bounceRate - prev.summary.bounceRate;

  if (sessionPct <= -15) {
    list.push({
      id: "ga4-sessions-drop", severity: sessionPct <= -25 ? "critical" : "warning",
      icon: TrendingDown,
      impact: Math.min(Math.abs(sessionPct), 90),
      title: `Website traffic down ${Math.abs(sessionPct)}%`,
      detail: `Sessions: ${cur.summary.sessions.toLocaleString()} vs ${prev.summary.sessions.toLocaleString()} previously. Check if organic, paid, or referral traffic is driving the drop.`,
      action: { label: "View analytics", onClick: () => onTabChange?.("integrations") },
    });
  } else if (sessionPct >= 15) {
    list.push({
      id: "ga4-sessions-up", severity: "win", icon: TrendingUp,
      impact: Math.min(sessionPct, 80),
      title: `Traffic up ${sessionPct}%`,
      detail: `${cur.summary.sessions.toLocaleString()} sessions vs ${prev.summary.sessions.toLocaleString()} previously. Consider optimising landing pages to capture the extra visitors.`,
    });
  }

  if (newUserPct <= -20 && prev.summary.newUsers >= 50) {
    list.push({
      id: "ga4-new-users-drop", severity: "warning", icon: Activity,
      impact: Math.min(Math.abs(newUserPct), 60),
      title: `New visitor acquisition down ${Math.abs(newUserPct)}%`,
      detail: `${cur.summary.newUsers.toLocaleString()} new users vs ${prev.summary.newUsers.toLocaleString()}. Acquisition channels may be underperforming — review SEO, paid, and social reach.`,
    });
  }

  if (bounceHigh) {
    const msg = bounceDelta >= 8
      ? `Bounce rate spiked ${bounceDelta.toFixed(0)}pp to ${cur.summary.bounceRate.toFixed(0)}% — likely a UX regression, slow page speed, or unqualified traffic source.`
      : `${cur.summary.bounceRate.toFixed(0)}% bounce rate. Visitors are leaving quickly — review landing page relevance and load speed.`;
    list.push({
      id: "ga4-bounce", severity: bounceDelta >= 8 ? "critical" : "warning",
      icon: MousePointerClick,
      impact: Math.round((cur.summary.bounceRate - 50) * 1.5),
      title: `High bounce rate (${cur.summary.bounceRate.toFixed(0)}%)`,
      detail: msg,
      action: {
        label: "Create Technical SEO task",
        onClick: () => navigate?.(`/tasks?new=1&service=Technical+SEO&client=${clientId}`),
      },
    });
  } else if (cur.summary.bounceRate < 40) {
    list.push({
      id: "ga4-bounce-win", severity: "win", icon: Activity,
      impact: Math.round((50 - cur.summary.bounceRate) * 0.8),
      title: `Strong engagement (${cur.summary.bounceRate.toFixed(0)}% bounce rate)`,
      detail: `Visitors are exploring multiple pages. Good indicator that content quality and UX are resonating with the audience.`,
    });
  }

  // ── Intra-period trend ───────────────────────────────────────────────────

  const trend = cur.trend;
  if (trend.length >= 14) {
    const half   = Math.floor(trend.length / 2);
    const first  = avg(trend.slice(0, half).map(d => d.sessions));
    const second = avg(trend.slice(half).map(d => d.sessions));
    const tPct   = pct(second, first);
    if (tPct <= -20) {
      list.push({
        id: "ga4-trend-down", severity: "warning", icon: TrendingDown,
        impact: Math.abs(tPct),
        title: `Traffic trending down within this period (${Math.abs(tPct)}%)`,
        detail: `Daily sessions in the second half of this 30-day window are ${Math.abs(tPct)}% below the first half. Momentum is negative — expect a worse comparison next period.`,
      });
    }
  }

  // ── Per-channel comparison (requires 2 snapshots with gap) ──────────────

  if (snap1 && hasGap) {
    const prevSources = snap1.current.trafficSources;
    const prevMap     = new Map(prevSources.map((s: GA4TrafficSource) => [s.channel, s]));

    for (const src of cur.trafficSources as GA4TrafficSource[]) {
      const p = prevMap.get(src.channel);
      if (!p) {
        // New channel appearing
        if (src.sessions >= 40) {
          list.push({
            id: `ch-new-${src.channel}`, severity: "opportunity", icon: Link2,
            impact: Math.min(src.sessions / 5, 50),
            title: `New traffic channel: ${src.channel}`,
            detail: `${src.sessions.toLocaleString()} sessions from ${src.channel} — this channel wasn't significant before. Investigate what's driving it and consider investing more.`,
          });
        }
        continue;
      }

      const chanPct = pct(src.sessions, p.sessions);
      if (chanPct <= -25 && p.sessions >= 40) {
        const isMajor = p.sessions >= cur.summary.sessions * 0.15; // >15% of total
        list.push({
          id: `ch-drop-${src.channel}`, severity: isMajor ? "critical" : "warning",
          icon: BarChart2,
          impact: Math.min(Math.abs(chanPct) + (isMajor ? 30 : 0), 100),
          title: `${src.channel} traffic down ${Math.abs(chanPct)}%`,
          detail: `${src.sessions.toLocaleString()} sessions vs ${p.sessions.toLocaleString()} previously. ${
            src.channel.toLowerCase().includes("organic") ? "Cross-reference with GSC to find which keywords lost rankings." :
            src.channel.toLowerCase().includes("paid")    ? "Check ad budget, bids, and quality scores." :
            src.channel.toLowerCase().includes("social")  ? "Review recent post reach and engagement." :
            "Investigate what changed in this channel."
          }`,
          action: src.channel.toLowerCase().includes("organic")
            ? { label: "View Search Console", onClick: () => onTabChange?.("integrations") }
            : undefined,
        });
      } else if (chanPct >= 30 && p.sessions >= 30) {
        list.push({
          id: `ch-up-${src.channel}`, severity: "win", icon: TrendingUp,
          impact: Math.min(chanPct / 2, 50),
          title: `${src.channel} up ${chanPct}%`,
          detail: `${src.sessions.toLocaleString()} sessions vs ${p.sessions.toLocaleString()} previously. ${
            src.channel.toLowerCase().includes("organic") ? "SEO momentum is building." :
            src.channel.toLowerCase().includes("social")  ? "Social content is performing well." :
            "Consider doubling down on this channel."
          }`,
        });
      }
    }
  }

  // ── Channel concentration risk ───────────────────────────────────────────

  const totalSessions = cur.trafficSources.reduce((s: number, c: GA4TrafficSource) => s + c.sessions, 0);
  const dominantChannel = cur.trafficSources.find(
    (c: GA4TrafficSource) => c.sessions / Math.max(totalSessions, 1) >= 0.55
  );
  if (dominantChannel) {
    const sharePct = Math.round((dominantChannel.sessions / totalSessions) * 100);
    list.push({
      id: "ch-concentration", severity: "opportunity", icon: Layers,
      impact: sharePct - 40,
      title: `${sharePct}% of traffic from one channel (${dominantChannel.channel})`,
      detail: `High dependency on a single source creates risk. One algorithm change or campaign pause could significantly hurt traffic. Diversify with ${dominantChannel.channel.toLowerCase().includes("organic") ? "social media and email" : "SEO and content marketing"}.`,
    });
  }

  return list;
}

// ─── Cross-signal insights ────────────────────────────────────────────────────

function crossSignalInsights(gsc?: GSCData, ga4?: GA4Data): Insight[] {
  if (!gsc || !ga4) return [];
  const list: Insight[] = [];

  const gscClickPct = pct(gsc.current.summary.clicks, gsc.previous.summary.clicks);
  const gscImpPct   = pct(gsc.current.summary.impressions, gsc.previous.summary.impressions);
  const ga4SessPct  = pct(ga4.current.summary.sessions, ga4.previous.summary.sessions);

  // GSC impressions up but GA4 organic flat → SERP feature stealing clicks
  if (gscImpPct >= 20 && gscClickPct < 5) {
    list.push({
      id: "cross-imp-no-click", severity: "opportunity", icon: Search,
      impact: 55,
      title: `More impressions but clicks aren't following`,
      detail: `GSC impressions grew ${gscImpPct}% but clicks barely moved. Google may be showing featured snippets, People Also Ask, or other SERP features that reduce click-throughs. Review structured data and optimise for featured snippet captures.`,
    });
  }

  // GSC clicks up + GA4 organic flat → attribution gap
  if (gscClickPct >= 15) {
    const organicSrc = ga4.current.trafficSources.find(
      (s: GA4TrafficSource) => s.channel.toLowerCase().includes("organic")
    );
    const prevOrganic = ga4.previous.summary;
    if (organicSrc && ga4SessPct < 5) {
      list.push({
        id: "cross-gsc-up-ga4-flat", severity: "opportunity", icon: BarChart2,
        impact: 45,
        title: `GSC clicks growing but GA4 organic sessions flat`,
        detail: `Search Console shows ${gscClickPct}% more clicks but Analytics organic traffic hasn't grown. Possible causes: GA4 attribution changes, cookie consent blocking, or click-to-PDF/image traffic. Verify GA4 tracking is intact.`,
      });
    }
  }

  return list;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClientInsightsPanel({ clientId, onTabChange }: Props) {
  const navigate = useNavigate();

  const { data: tasks = [] } = useQuery({
    queryKey: ["insight-tasks", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("tasks")
        .select("id, title, status, due_date, service_type, target_count, estimated_minutes, created_at")
        .eq("client_id", clientId).order("due_date", { ascending: true });
      return data || [];
    },
  });

  const { data: timeLogs = [] } = useQuery({
    queryKey: ["insight-time", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("time_logs")
        .select("task_id, duration_minutes")
        .eq("client_id", clientId).gte("started_at", startOfMonth());
      return data || [];
    },
  });

  const { data: deliverables = [] } = useQuery({
    queryKey: ["insight-deliverables", clientId],
    queryFn: async () => {
      const ids = tasks
        .filter((t: any) => COUNT_BASED.includes(t.service_type))
        .map((t: any) => t.id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("task_deliverables")
        .select("task_id, data").in("task_id", ids);
      return data || [];
    },
    enabled: tasks.length > 0,
  });

  // Fetch 2 most recent snapshots for each integration
  const { data: gscSnaps } = useQuery({
    queryKey: ["insight-gsc", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("client_integration_metrics")
        .select("data, date_ref")
        .eq("client_id", clientId).eq("integration_type", "gsc")
        .order("date_ref", { ascending: false }).limit(2);
      return (data || []) as { data: GSCData; date_ref: string }[];
    },
  });

  const { data: ga4Snaps } = useQuery({
    queryKey: ["insight-ga4", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("client_integration_metrics")
        .select("data, date_ref")
        .eq("client_id", clientId).eq("integration_type", "ga4")
        .order("date_ref", { ascending: false }).limit(2);
      return (data || []) as { data: GA4Data; date_ref: string }[];
    },
  });

  // ─── Derived ────────────────────────────────────────────────────────────────

  const deliverableMap: Record<string, number> = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of deliverables as any[]) {
      const d = r.data;
      m[r.task_id] = d?.backlinks?.length || d?.articles?.length || d?.posts?.length || 0;
    }
    return m;
  }, [deliverables]);

  const gsc0 = gscSnaps?.[0]?.data;
  const gsc1 = gscSnaps?.[1]?.data;
  const gscGap = snapshotDayGap(gscSnaps?.[0]?.date_ref, gscSnaps?.[1]?.date_ref) >= 10;

  const ga4_0 = ga4Snaps?.[0]?.data;
  const ga4_1 = ga4Snaps?.[1]?.data;
  const ga4Gap = snapshotDayGap(ga4Snaps?.[0]?.date_ref, ga4Snaps?.[1]?.date_ref) >= 10;

  // ─── Build all insights ──────────────────────────────────────────────────────

  const insights: Insight[] = useMemo(() => {
    const all: Insight[] = [
      ...taskInsights(tasks, timeLogs, deliverableMap, navigate, onTabChange),
      ...(gsc0 ? gscInsights(gsc0, gsc1, gscGap, onTabChange, navigate, clientId) : []),
      ...(ga4_0 ? ga4Insights(ga4_0, ga4_1, ga4Gap, onTabChange, navigate, clientId) : []),
      ...crossSignalInsights(gsc0, ga4_0),
    ];
    // Sort: severity first, then impact desc within tier
    return all.sort((a, b) =>
      SEV_ORDER[a.severity] !== SEV_ORDER[b.severity]
        ? SEV_ORDER[a.severity] - SEV_ORDER[b.severity]
        : b.impact - a.impact
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, timeLogs, deliverableMap, gsc0, gsc1, gscGap, ga4_0, ga4_1, ga4Gap]);

  // ─── Health score ────────────────────────────────────────────────────────────

  const score = useMemo(() => {
    const today   = todayStr();
    const overdue = tasks.filter((t: any) => ACTIVE_ST.includes(t.status) && t.due_date && t.due_date < today).length;
    const monthStart     = startOfMonth();
    const completedThis  = tasks.filter((t: any) => t.status === "completed" && t.created_at >= monthStart).length;
    const timeByTask: Record<string, number> = {};
    for (const l of timeLogs as any[]) timeByTask[l.task_id] = (timeByTask[l.task_id] || 0) + l.duration_minutes;
    const timeBudgetOk = !tasks.some((t: any) => t.estimated_minutes > 0 && (timeByTask[t.id] || 0) > t.estimated_minutes * 1.2);
    const countBased  = tasks.filter((t: any) => COUNT_BASED.includes(t.service_type) && ACTIVE_ST.includes(t.status) && t.target_count);
    const delivAvg    = countBased.length > 0
      ? avg(countBased.map((t: any) => Math.min((deliverableMap[t.id] || 0) / t.target_count, 1)))
      : -1;
    return healthScore({
      overdueTasks: overdue, completedThisMonth: completedThis, totalTasks: tasks.length,
      timeBudgetOk, deliverableAvg: delivAvg,
      gscClickPct: gsc0 ? pct(gsc0.current.summary.clicks, gsc0.previous.summary.clicks) : 0,
      hasGSC: !!gsc0,
      ga4SessionPct: ga4_0 ? pct(ga4_0.current.summary.sessions, ga4_0.previous.summary.sessions) : 0,
      hasGA4: !!ga4_0,
      highBounce: !!(ga4_0 && ga4_0.current.summary.bounceRate > 65),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, timeLogs, deliverableMap, gsc0, ga4_0]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (tasks.length === 0 && !gsc0 && !ga4_0) return null;

  const criticalCount = insights.filter(i => i.severity === "critical").length;
  const warningCount  = insights.filter(i => i.severity === "warning").length;
  const hasComparison = (gscGap && gsc1) || (ga4Gap && ga4_1);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/30">
        <div className="flex items-center gap-2 flex-wrap">
          <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="font-semibold text-sm">Client Intelligence</span>
          {criticalCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 text-[10px] font-semibold px-2 py-0.5">
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold px-2 py-0.5">
              {warningCount} warning{warningCount > 1 ? "s" : ""}
            </span>
          )}
          {insights.length === 0 && (
            <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 text-[10px] font-semibold px-2 py-0.5 gap-1">
              <CheckCircle2 className="w-3 h-3" /> All clear
            </span>
          )}
          {hasComparison && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              · per-query &amp; per-channel analysis active
            </span>
          )}
        </div>

        {insights.length > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Health</p>
              <p className={`text-sm font-bold ${scoreColor(score)}`}>
                {score}/100 · {scoreLabel(score)}
              </p>
            </div>
            <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${score}%`, backgroundColor: scoreBarBg(score) }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      {insights.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          No issues detected — this client is in good shape.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {insights.map((ins) => {
            const Icon = ins.icon;
            return (
              <div
                key={ins.id}
                className={`flex gap-3 px-4 py-3.5 border-l-[3px] ${SEV_BORDER[ins.severity]} ${SEV_BG[ins.severity]}`}
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${SEV_ICON[ins.severity]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug">{ins.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ins.detail}</p>
                  {ins.action && (
                    <Button
                      size="sm" variant="link"
                      className="h-auto p-0 mt-1 text-xs gap-0.5 text-foreground/70 hover:text-foreground"
                      onClick={ins.action.onClick}
                    >
                      {ins.action.label}
                      <ArrowUpRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
