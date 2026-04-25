import { useState, useEffect, useCallback } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import {
  AlertCircle, Link as LinkIcon, RefreshCw, Unlink, Clock,
  TrendingUp, TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  connectGA4, disconnectGA4, getGA4Integration,
  refreshGA4Data, loadCachedGA4Metrics, isTokenExpired,
  isDataStale, formatLastSynced, pctChange, fmtDuration,
  type GA4Data,
} from "@/integrations/googleAnalytics";
import { supabase } from "@/integrations/supabase/client";

interface GoogleAnalyticsProps {
  clientId: string;
  propertyId?: string;
}

type Status = "loading" | "no_property" | "disconnected" | "expired" | "connected";

const PIE_COLORS = ["#4285F4", "#34A853", "#FBBC05", "#EA4335", "#8884d8"];

export function GoogleAnalytics({ clientId, propertyId }: GoogleAnalyticsProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<GA4Data | null>(null);
  const [dateRef, setDateRef] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ga4PropertyId, setGa4PropertyId] = useState<string | null>(null);
  const [propertyIdInput, setPropertyIdInput] = useState("");

  // ── Load initial state ──────────────────────────────────────────────────
  const loadState = useCallback(async () => {
    setStatus("loading");
    setError(null);

    const credsQuery = supabase.from("client_credentials").select("ga4_property_id");
    const [creds, integration, cached] = await Promise.all([
      (propertyId
        ? credsQuery.eq("property_id", propertyId)
        : credsQuery.eq("client_id", clientId)
      ).maybeSingle().then(({ data }) => data as { ga4_property_id: string | null } | null),
      getGA4Integration(clientId, propertyId),
      loadCachedGA4Metrics(clientId, propertyId),
    ]);

    const propId = creds?.ga4_property_id ?? null;
    setGa4PropertyId(propId);
    setPropertyIdInput(propId ?? "");

    if (cached) {
      setData(cached.data);
      setDateRef(cached.date_ref);
    }

    if (!propId) {
      setStatus("no_property");
      return;
    }

    if (!integration) {
      setStatus("disconnected");
      return;
    }

    if (isTokenExpired(integration.expires_at)) {
      setStatus("expired");
      return;
    }

    setStatus("connected");

    if (!cached || isDataStale(cached.date_ref)) {
      await doRefresh(integration.access_token, propId);
    }
  }, [clientId]);

  useEffect(() => { loadState(); }, [loadState]);

  // ── Refresh ─────────────────────────────────────────────────────────────
  const doRefresh = async (accessToken: string, ga4PropId: string) => {
    setIsFetching(true);
    setError(null);
    try {
      const fresh = await refreshGA4Data(clientId, accessToken, ga4PropId, propertyId);
      setData(fresh);
      setDateRef(new Date().toISOString().slice(0, 10));
      toast.success("GA4 data updated");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch GA4 data";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsFetching(false);
    }
  };

  const handleRefresh = async () => {
    const integration = await getGA4Integration(clientId, propertyId);
    if (!integration || isTokenExpired(integration.expires_at)) {
      setStatus("expired");
      toast.error("Session expired — please reconnect");
      return;
    }
    await doRefresh(integration.access_token, ga4PropertyId!);
  };

  // ── Connect ─────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setError(null);
    const propId = propertyIdInput.trim();
    if (!propId) {
      setError("Please enter your GA4 Property ID first.");
      return;
    }

    // Save property ID to credentials table before OAuth
    const credsPayload: Record<string, string> = { client_id: clientId, ga4_property_id: propId };
    if (propertyId) credsPayload.property_id = propertyId;
    await supabase.from("client_credentials").upsert(
      credsPayload,
      { onConflict: propertyId ? "property_id" : "client_id" }
    );
    setGa4PropertyId(propId);

    try {
      const accessToken = await connectGA4(clientId, propertyId);
      toast.success("Connected to Google Analytics 4");
      setStatus("connected");
      await doRefresh(accessToken, propId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setError(msg);
      toast.error(msg);
    }
  };

  // ── Disconnect ───────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    await disconnectGA4(clientId, propertyId);
    setStatus("disconnected");
    setData(null);
    setDateRef(null);
    toast.info("Google Analytics disconnected");
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === "loading") {
    return <Card className="h-48 animate-pulse bg-muted/20" />;
  }

  // ── Not connected (covers both no_property + disconnected) ───────────────
  if (status === "no_property" || status === "disconnected") {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <img
              src="https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg"
              alt="GA4" className="w-6 h-6"
            />
            <CardTitle>Google Analytics 4</CardTitle>
          </div>
          <CardDescription>
            Connect GA4 to track sessions, users, traffic sources &amp; top pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="ga4-id">GA4 Property ID</Label>
            <Input
              id="ga4-id"
              placeholder="123456789"
              value={propertyIdInput}
              onChange={e => setPropertyIdInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Find this in{" "}
              <a
                href="https://analytics.google.com"
                target="_blank" rel="noreferrer"
                className="underline"
              >
                Google Analytics
              </a>{" "}
              → Admin → Property Settings → Property ID (numbers only).
            </p>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleConnect} className="gap-2 w-full sm:w-auto">
            <LinkIcon className="w-4 h-4" /> Connect GA4
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Expired token ─────────────────────────────────────────────────────────
  if (status === "expired") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b mb-4">
          <div className="flex items-center gap-3">
            <img
              src="https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg"
              alt="GA4" className="w-5 h-5 grayscale opacity-60"
            />
            <CardTitle className="text-xl">Google Analytics 4</CardTitle>
            <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">
              Session Expired
            </Badge>
          </div>
          <Button onClick={handleConnect} size="sm" variant="outline" className="gap-2">
            <LinkIcon className="w-3.5 h-3.5" /> Reconnect
          </Button>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Google session expired. Showing cached data
              {dateRef ? ` from ${dateRef}` : ""}. Reconnect to refresh.
            </AlertDescription>
          </Alert>
          {data && <DataView data={data} />}
        </CardContent>
      </Card>
    );
  }

  // ── Connected ─────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b mb-4">
        <div>
          <div className="flex items-center gap-2">
            <img
              src="https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg"
              alt="GA4" className="w-5 h-5 grayscale opacity-80"
            />
            <CardTitle className="text-xl">Google Analytics 4</CardTitle>
            <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
              Connected
            </Badge>
          </div>
          {data && (
            <CardDescription className="mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last synced {formatLastSynced(data.fetchedAt)} · Last 30 days
            </CardDescription>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="icon" title="Refresh data"
            onClick={handleRefresh} disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost" size="icon" title="Disconnect"
            onClick={handleDisconnect}
          >
            <Unlink className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {isFetching && !data && (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            Fetching data from GA4…
          </div>
        )}
        {data && <DataView data={data} />}
      </CardContent>
    </Card>
  );
}

// ── Data display sub-component ─────────────────────────────────────────────
function DataView({ data }: { data: GA4Data }) {
  const { current, previous } = data;
  const { summary, trend, trafficSources, topPages } = current;
  const prev = previous.summary;

  const fmtNum = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString();

  const StatCard = ({
    label, value, current: c, previous: p, lowerIsBetter = false,
  }: {
    label: string; value: string;
    current: number; previous: number; lowerIsBetter?: boolean;
  }) => {
    const pct = pctChange(c, p);
    const isPositive = lowerIsBetter ? pct < 0 : pct > 0;
    const color = pct === 0 ? "text-muted-foreground" : isPositive ? "text-green-600" : "text-red-500";
    const Icon = pct > 0 ? TrendingUp : TrendingDown;
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {pct !== 0 && (
          <p className={`text-xs flex items-center gap-1 ${color}`}>
            <Icon className="w-3 h-3" />
            {Math.abs(pct)}% vs prev 30d
          </p>
        )}
      </div>
    );
  };

  // Downsample chart if >60 points
  const chartData = trend.length > 60
    ? trend.filter((_, i) => i % Math.ceil(trend.length / 30) === 0)
    : trend;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Sessions" value={fmtNum(summary.sessions)}
          current={summary.sessions} previous={prev.sessions} />
        <StatCard label="Users" value={fmtNum(summary.users)}
          current={summary.users} previous={prev.users} />
        <StatCard label="New Users" value={fmtNum(summary.newUsers)}
          current={summary.newUsers} previous={prev.newUsers} />
        <StatCard label="Bounce Rate" value={`${summary.bounceRate.toFixed(1)}%`}
          current={summary.bounceRate} previous={prev.bounceRate} lowerIsBetter />
        <StatCard label="Avg Session" value={fmtDuration(summary.avgSessionDuration)}
          current={summary.avgSessionDuration} previous={prev.avgSessionDuration} />
      </div>

      {/* Sessions trend + traffic sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        <div className="lg:col-span-2">
          <h4 className="text-sm font-semibold mb-3">Sessions Trend</h4>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false}
                  tick={{ fontSize: 11 }} dy={8}
                  tickFormatter={d => d.slice(5)}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} dx={-8} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Line type="monotone" dataKey="sessions" name="Sessions"
                  stroke="#F4B400" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="newUsers" name="New Users"
                  stroke="#4285F4" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-3 text-center">Traffic Sources</h4>
          <div className="h-[260px] w-full flex flex-col items-center">
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={trafficSources}
                  dataKey="sessions"
                  nameKey="channel"
                  cx="50%" cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {trafficSources.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  formatter={(v: number, name: string) => [v.toLocaleString(), name]}
                />
                <Legend
                  layout="vertical" verticalAlign="middle" align="right"
                  iconType="circle" iconSize={8}
                  formatter={(value) => (
                    <span style={{ fontSize: 11 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top landing pages */}
      {topPages.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3">Top Landing Pages</h4>
          <div className="rounded-md border overflow-hidden">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Page</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Sessions</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Users</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topPages.map((p, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-4 py-2 max-w-[280px] truncate text-xs font-mono">{p.page}</td>
                    <td className="px-4 py-2 text-right font-medium">{p.sessions.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{p.users.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
