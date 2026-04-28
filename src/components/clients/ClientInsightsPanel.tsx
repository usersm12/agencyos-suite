import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, Clock, TrendingDown, TrendingUp, Target,
  Zap, CheckCircle2, Search, MousePointerClick, Activity,
  CalendarX, Layers, ArrowUpRight, Lightbulb,
} from "lucide-react";
import type { GSCData } from "@/integrations/searchConsole";
import type { GA4Data } from "@/integrations/googleAnalytics";

// ─── Types ───────────────────────────────────────────────────────────────────

type Severity = "critical" | "warning" | "opportunity" | "win";

interface Insight {
  id: string;
  severity: Severity;
  icon: React.ElementType;
  title: string;
  detail: string;
  action?: { label: string; onClick: () => void };
}

interface Props {
  clientId: string;
  onTabChange?: (tab: string) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<Severity, string> = {
  critical:    "border-l-red-500    bg-red-50    dark:bg-red-950/30",
  warning:     "border-l-amber-500  bg-amber-50  dark:bg-amber-950/30",
  opportunity: "border-l-blue-500   bg-blue-50   dark:bg-blue-950/30",
  win:         "border-l-green-500  bg-green-50  dark:bg-green-950/30",
};

const SEVERITY_ICON_STYLES: Record<Severity, string> = {
  critical:    "text-red-500",
  warning:     "text-amber-500",
  opportunity: "text-blue-500",
  win:         "text-green-500",
};

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0, warning: 1, opportunity: 2, win: 3,
};

const COUNT_BASED_SERVICES = ["Backlinks", "Content Writing", "Social Media"];
const ACTIVE_STATUSES = ["not_started", "in_progress", "blocked", "pending_approval"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysLeft(): number {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return end.getDate() - now.getDate();
}

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Score computation ────────────────────────────────────────────────────────

function computeHealthScore(params: {
  totalTasks: number;
  completedThisMonth: number;
  overdueTasks: number;
  trackedMinutes: number;
  estimatedMinutes: number;
  deliverableCompletion: number; // 0–1 average
  gscClickChange: number;        // pct, e.g. -15 or +20
  hasGSC: boolean;
}): number {
  const {
    totalTasks, completedThisMonth, overdueTasks,
    trackedMinutes, estimatedMinutes,
    deliverableCompletion, gscClickChange, hasGSC,
  } = params;

  let score = 50; // base

  // Task completion (max ±25)
  if (totalTasks > 0) {
    const rate = completedThisMonth / totalTasks;
    score += Math.round(rate * 25);
  }

  // Overdue penalty (max -20)
  score -= Math.min(overdueTasks * 7, 20);

  // Time budget health (max ±10)
  if (estimatedMinutes > 0) {
    const ratio = trackedMinutes / estimatedMinutes;
    if (ratio <= 1.0)        score += 10;
    else if (ratio <= 1.2)   score += 3;
    else                      score -= 5;
  }

  // Deliverable progress (max +15)
  score += Math.round(deliverableCompletion * 15);

  // GSC signals (max ±10)
  if (hasGSC) {
    if (gscClickChange >= 10)       score += 10;
    else if (gscClickChange >= 0)   score += 5;
    else if (gscClickChange >= -10) score -= 3;
    else                             score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Healthy";
  if (score >= 60) return "On track";
  if (score >= 40) return "Needs attention";
  return "At risk";
}

function scoreBarColor(score: number): string {
  if (score >= 75) return "[&>div]:bg-green-500";
  if (score >= 50) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-500";
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClientInsightsPanel({ clientId, onTabChange }: Props) {
  const navigate = useNavigate();

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const { data: tasks = [] } = useQuery({
    queryKey: ["insight-tasks", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, service_type, target_count, estimated_minutes, created_at")
        .eq("client_id", clientId)
        .order("due_date", { ascending: true });
      return data || [];
    },
  });

  // ── Time logs this month ───────────────────────────────────────────────────
  const { data: timeLogs = [] } = useQuery({
    queryKey: ["insight-time", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_logs")
        .select("task_id, duration_minutes")
        .eq("client_id", clientId)
        .gte("started_at", startOfMonth());
      return data || [];
    },
  });

  // ── Deliverables (count-based tasks) ──────────────────────────────────────
  const { data: deliverables = [] } = useQuery({
    queryKey: ["insight-deliverables", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("task_deliverables")
        .select("task_id, data")
        .in(
          "task_id",
          tasks
            .filter((t: any) => COUNT_BASED_SERVICES.includes(t.service_type))
            .map((t: any) => t.id)
        );
      return data || [];
    },
    enabled: tasks.length > 0,
  });

  // ── GSC cached metrics ─────────────────────────────────────────────────────
  const { data: gscRaw } = useQuery({
    queryKey: ["insight-gsc", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_integration_metrics")
        .select("data")
        .eq("client_id", clientId)
        .eq("integration_type", "gsc")
        .order("date_ref", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.data as GSCData | null;
    },
  });

  // ── GA4 cached metrics ─────────────────────────────────────────────────────
  const { data: ga4Raw } = useQuery({
    queryKey: ["insight-ga4", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_integration_metrics")
        .select("data")
        .eq("client_id", clientId)
        .eq("integration_type", "ga4")
        .order("date_ref", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.data as GA4Data | null;
    },
  });

  // ─── Derived data ──────────────────────────────────────────────────────────

  const today = todayStr();
  const in3days = addDays(3);
  const monthStart = startOfMonth();

  const overdueTasks = tasks.filter(
    (t: any) => ACTIVE_STATUSES.includes(t.status) && t.due_date && t.due_date < today
  );
  const atRiskTasks = tasks.filter(
    (t: any) => ACTIVE_STATUSES.includes(t.status) && t.due_date && t.due_date >= today && t.due_date <= in3days
  );
  const completedThisMonth = tasks.filter(
    (t: any) => t.status === "completed" && t.created_at >= monthStart
  ).length;

  // Time budget per task
  const timeByTask: Record<string, number> = {};
  for (const log of timeLogs as any[]) {
    timeByTask[log.task_id] = (timeByTask[log.task_id] || 0) + log.duration_minutes;
  }
  const overBudgetTasks = tasks.filter(
    (t: any) => t.estimated_minutes > 0 && (timeByTask[t.id] || 0) > t.estimated_minutes
  );
  const totalTracked = Object.values(timeByTask).reduce((a: any, b: any) => a + b, 0) as number;
  const totalEstimated = tasks.reduce((sum: number, t: any) => sum + (t.estimated_minutes || 0), 0);

  // Deliverable progress for count-based tasks
  const deliverableMap: Record<string, number> = {};
  for (const row of deliverables as any[]) {
    const d = row.data;
    const count = (d?.backlinks?.length || d?.articles?.length || d?.posts?.length || 0);
    deliverableMap[row.task_id] = count;
  }
  const countBasedTasks = tasks.filter(
    (t: any) => COUNT_BASED_SERVICES.includes(t.service_type) && ACTIVE_STATUSES.includes(t.status)
  );
  const behindTargetTasks = countBasedTasks.filter((t: any) => {
    if (!t.target_count) return false;
    const done = deliverableMap[t.id] || 0;
    const pct = done / t.target_count;
    const dl = daysLeft();
    // behind if <50% done with <10 days left, or <25% done with <20 days left
    return (pct < 0.5 && dl < 10) || (pct < 0.25 && dl < 20);
  });
  const avgDeliverableCompletion =
    countBasedTasks.length > 0
      ? countBasedTasks.reduce((sum: number, t: any) => {
          const done = deliverableMap[t.id] || 0;
          const target = t.target_count || 1;
          return sum + Math.min(done / target, 1);
        }, 0) / countBasedTasks.length
      : 0.5; // neutral if no count-based tasks

  // GSC signals
  const gsc = gscRaw;
  const gscClickChange = gsc
    ? gsc.current.summary.clicks - gsc.previous.summary.clicks > 0
      ? Math.round(((gsc.current.summary.clicks - gsc.previous.summary.clicks) / Math.max(gsc.previous.summary.clicks, 1)) * 100)
      : -Math.round(((gsc.previous.summary.clicks - gsc.current.summary.clicks) / Math.max(gsc.previous.summary.clicks, 1)) * 100)
    : 0;

  const lowHangingQueries = gsc
    ? gsc.current.topQueries.filter(
        (q: any) => q.position >= 11 && q.position <= 20 && q.impressions >= 50
      ).slice(0, 3)
    : [];

  const lowCtrQueries = gsc
    ? gsc.current.topQueries.filter(
        (q: any) => q.impressions >= 300 && q.ctr < 2.0
      ).slice(0, 3)
    : [];

  // GA4 signals
  const ga4 = ga4Raw;
  const ga4SessionChange = ga4
    ? Math.round(
        ((ga4.current.summary.sessions - ga4.previous.summary.sessions) /
          Math.max(ga4.previous.summary.sessions, 1)) * 100
      )
    : 0;
  const highBounce = ga4 && ga4.current.summary.bounceRate > 65;
  const organicSource = ga4?.current.trafficSources.find(
    (s: any) => s.channel.toLowerCase().includes("organic")
  );

  // ─── Health score ──────────────────────────────────────────────────────────

  const healthScore = useMemo(
    () =>
      computeHealthScore({
        totalTasks: tasks.length,
        completedThisMonth,
        overdueTasks: overdueTasks.length,
        trackedMinutes: totalTracked,
        estimatedMinutes: totalEstimated,
        deliverableCompletion: avgDeliverableCompletion,
        gscClickChange,
        hasGSC: !!gsc,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, completedThisMonth, overdueTasks.length, totalTracked, totalEstimated, avgDeliverableCompletion, gscClickChange, gsc]
  );

  // ─── Build insights ────────────────────────────────────────────────────────

  const insights: Insight[] = useMemo(() => {
    const list: Insight[] = [];

    // ── CRITICAL ────────────────────────────────────────────────────────────

    if (overdueTasks.length > 0) {
      list.push({
        id: "overdue",
        severity: "critical",
        icon: CalendarX,
        title: `${overdueTasks.length} task${overdueTasks.length > 1 ? "s" : ""} overdue`,
        detail: overdueTasks.slice(0, 2).map((t: any) => t.title).join(", ") +
          (overdueTasks.length > 2 ? ` +${overdueTasks.length - 2} more` : ""),
        action: {
          label: "Review tasks",
          onClick: () => onTabChange?.("tasks"),
        },
      });
    }

    if (behindTargetTasks.length > 0) {
      const t = behindTargetTasks[0] as any;
      const done = deliverableMap[t.id] || 0;
      const pct = Math.round((done / t.target_count) * 100);
      list.push({
        id: "behind-target",
        severity: "critical",
        icon: Target,
        title: `Deliverable target at risk`,
        detail: `"${t.title}" is ${pct}% complete (${done}/${t.target_count}) with ${daysLeft()} days left this month.`,
        action: {
          label: "Open task",
          onClick: () => onTabChange?.("tasks"),
        },
      });
    }

    if (gsc && gscClickChange <= -15) {
      list.push({
        id: "gsc-drop",
        severity: "critical",
        icon: TrendingDown,
        title: `Organic clicks dropped ${Math.abs(gscClickChange)}%`,
        detail: `Search clicks fell from ${gsc.previous.summary.clicks.toLocaleString()} to ${gsc.current.summary.clicks.toLocaleString()} vs the previous 30 days.`,
        action: {
          label: "View Search Console",
          onClick: () => onTabChange?.("integrations"),
        },
      });
    }

    // ── WARNING ──────────────────────────────────────────────────────────────

    if (atRiskTasks.length > 0) {
      list.push({
        id: "at-risk",
        severity: "warning",
        icon: Clock,
        title: `${atRiskTasks.length} task${atRiskTasks.length > 1 ? "s" : ""} due within 3 days`,
        detail: atRiskTasks.map((t: any) => t.title).slice(0, 2).join(", "),
        action: {
          label: "View tasks",
          onClick: () => onTabChange?.("tasks"),
        },
      });
    }

    if (overBudgetTasks.length > 0) {
      const t = overBudgetTasks[0] as any;
      const tracked = timeByTask[t.id] || 0;
      const over = Math.round(((tracked - t.estimated_minutes) / t.estimated_minutes) * 100);
      list.push({
        id: "over-budget",
        severity: "warning",
        icon: Activity,
        title: `Time over budget on ${overBudgetTasks.length} task${overBudgetTasks.length > 1 ? "s" : ""}`,
        detail: `"${t.title}" is ${over}% over its estimated time. Review scope or update estimate.`,
        action: {
          label: "View time log",
          onClick: () => onTabChange?.("time"),
        },
      });
    }

    if (ga4 && ga4SessionChange <= -10) {
      list.push({
        id: "ga4-drop",
        severity: "warning",
        icon: TrendingDown,
        title: `Website traffic down ${Math.abs(ga4SessionChange)}%`,
        detail: `Sessions dropped from ${ga4.previous.summary.sessions.toLocaleString()} to ${ga4.current.summary.sessions.toLocaleString()}. Organic may need attention.`,
        action: {
          label: "View analytics",
          onClick: () => onTabChange?.("integrations"),
        },
      });
    }

    if (highBounce && ga4) {
      list.push({
        id: "bounce",
        severity: "warning",
        icon: MousePointerClick,
        title: `High bounce rate (${ga4.current.summary.bounceRate.toFixed(0)}%)`,
        detail: `Visitors are leaving quickly. Consider a CRO audit, landing page review, or page speed check.`,
        action: {
          label: "Create CRO task",
          onClick: () => navigate(`/tasks?new=1&service=Technical+SEO&client=${clientId}`),
        },
      });
    }

    if (gsc && gscClickChange > -15 && gscClickChange < -5) {
      list.push({
        id: "gsc-soft-drop",
        severity: "warning",
        icon: Search,
        title: `Organic clicks dipped ${Math.abs(gscClickChange)}%`,
        detail: `Avg position: ${gsc.current.summary.avgPosition.toFixed(1)} (prev: ${gsc.previous.summary.avgPosition.toFixed(1)}). Monitor for continued decline.`,
      });
    }

    // ── OPPORTUNITY ──────────────────────────────────────────────────────────

    if (lowHangingQueries.length > 0) {
      const q = lowHangingQueries[0];
      list.push({
        id: "low-hanging",
        severity: "opportunity",
        icon: Zap,
        title: `${lowHangingQueries.length} keyword${lowHangingQueries.length > 1 ? "s" : ""} close to page 1`,
        detail: `"${q.query}" is at position ${q.position.toFixed(0)} with ${q.impressions.toLocaleString()} impressions. A targeted content push could move it to page 1.`,
        action: {
          label: "Plan content task",
          onClick: () => navigate(`/tasks?new=1&service=Content+Writing&client=${clientId}`),
        },
      });
    }

    if (lowCtrQueries.length > 0) {
      const q = lowCtrQueries[0];
      list.push({
        id: "ctr-opportunity",
        severity: "opportunity",
        icon: MousePointerClick,
        title: `${lowCtrQueries.length} keyword${lowCtrQueries.length > 1 ? "s" : ""} with low CTR`,
        detail: `"${q.query}" has ${q.impressions.toLocaleString()} impressions but only ${q.ctr.toFixed(1)}% CTR. Improving title/meta could unlock more clicks without ranking changes.`,
        action: {
          label: "Create On-Page task",
          onClick: () => navigate(`/tasks?new=1&service=On-Page+SEO&client=${clientId}`),
        },
      });
    }

    if (ga4 && ga4SessionChange >= 10) {
      list.push({
        id: "traffic-up",
        severity: "opportunity",
        icon: TrendingUp,
        title: `Traffic growing — capture it`,
        detail: `Sessions up ${ga4SessionChange}% vs previous period. Consider a landing page optimisation or lead capture to convert the extra visitors.`,
      });
    }

    if (organicSource && organicSource.sessions > 0 && gsc) {
      const organicPct = Math.round(
        (organicSource.sessions / ga4!.current.summary.sessions) * 100
      );
      if (organicPct >= 40) {
        list.push({
          id: "organic-dominant",
          severity: "opportunity",
          icon: Layers,
          title: `${organicPct}% of traffic is organic`,
          detail: `Strong SEO dependency. Recommend diversifying via social or email campaigns to reduce reliance on a single channel.`,
        });
      }
    }

    // ── WINS ─────────────────────────────────────────────────────────────────

    if (completedThisMonth > 0) {
      list.push({
        id: "completed",
        severity: "win",
        icon: CheckCircle2,
        title: `${completedThisMonth} task${completedThisMonth > 1 ? "s" : ""} completed this month`,
        detail: `Great progress. Keep the momentum going for the remaining ${tasks.filter((t: any) => ACTIVE_STATUSES.includes(t.status)).length} active task${tasks.filter((t: any) => ACTIVE_STATUSES.includes(t.status)).length !== 1 ? "s" : ""}.`,
      });
    }

    if (gsc && gscClickChange >= 15) {
      list.push({
        id: "gsc-win",
        severity: "win",
        icon: TrendingUp,
        title: `Organic clicks up ${gscClickChange}%`,
        detail: `${gsc.current.summary.clicks.toLocaleString()} clicks this period vs ${gsc.previous.summary.clicks.toLocaleString()} previously. SEO efforts are paying off.`,
      });
    }

    if (ga4 && !highBounce && ga4.current.summary.bounceRate < 45) {
      list.push({
        id: "bounce-good",
        severity: "win",
        icon: Activity,
        title: `Strong engagement (${ga4.current.summary.bounceRate.toFixed(0)}% bounce rate)`,
        detail: `Visitors are exploring the site. Good indicator that content and UX are resonating.`,
      });
    }

    // Sort by severity
    return list.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, overdueTasks, atRiskTasks, overBudgetTasks, behindTargetTasks, gsc, ga4, deliverableMap, completedThisMonth]);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (tasks.length === 0 && !gsc && !ga4) return null;

  const criticalCount = insights.filter(i => i.severity === "critical").length;
  const warningCount  = insights.filter(i => i.severity === "warning").length;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
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
        </div>

        {/* Health score */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Health</p>
            <p className={`text-sm font-bold ${scoreColor(healthScore)}`}>
              {healthScore}/100 · {scoreLabel(healthScore)}
            </p>
          </div>
          <div className="w-24">
            <Progress
              value={healthScore}
              className={`h-2 ${scoreBarColor(healthScore)}`}
            />
          </div>
        </div>
      </div>

      {/* Insights grid */}
      {insights.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          Everything looks good — no issues detected.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
          {insights.map((insight, idx) => {
            const Icon = insight.icon;
            return (
              <div
                key={insight.id}
                className={`
                  flex gap-3 px-4 py-3.5 border-l-[3px] relative
                  ${SEVERITY_STYLES[insight.severity]}
                  ${idx % 2 === 0 && idx === insights.length - 1 ? "md:col-span-2" : ""}
                `}
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${SEVERITY_ICON_STYLES[insight.severity]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{insight.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                    {insight.detail}
                  </p>
                  {insight.action && (
                    <Button
                      size="sm"
                      variant="link"
                      className="h-auto p-0 mt-1 text-xs gap-0.5 text-foreground/70 hover:text-foreground"
                      onClick={insight.action.onClick}
                    >
                      {insight.action.label}
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
