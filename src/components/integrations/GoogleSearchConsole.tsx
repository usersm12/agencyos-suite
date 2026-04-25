import { useState, useEffect, useCallback } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  AlertCircle, Link as LinkIcon, RefreshCw, Unlink, Clock, TrendingUp, TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  connectSearchConsole, disconnectSearchConsole, getGSCIntegration,
  refreshGSCData, loadCachedGSCMetrics, isTokenExpired,
  isDataStale, formatLastSynced, pctChange, type GSCData,
} from "@/integrations/searchConsole";
import { supabase } from "@/integrations/supabase/client";

interface GoogleSearchConsoleProps {
  clientId: string;
  propertyId?: string;
}

type Status = "loading" | "no_property" | "disconnected" | "expired" | "connected";

interface Credentials {
  gsc_property_url: string | null;
}

export function GoogleSearchConsole({ clientId, propertyId }: GoogleSearchConsoleProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<GSCData | null>(null);
  const [dateRef, setDateRef] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [siteUrlInput, setSiteUrlInput] = useState("");

  // ── Load initial state ──────────────────────────────────────────────────
  const loadState = useCallback(async () => {
    setStatus("loading");
    setError(null);

    const credsQuery = supabase
      .from("client_credentials")
      .select("gsc_property_url");
    const [creds, integration, cached] = await Promise.all([
      (propertyId
        ? credsQuery.eq("property_id", propertyId)
        : credsQuery.eq("client_id", clientId)
      ).maybeSingle().then(({ data }) => data as Credentials | null),
      getGSCIntegration(clientId, propertyId),
      loadCachedGSCMetrics(clientId, propertyId),
    ]);

    setCredentials(creds);
    setSiteUrlInput(creds?.gsc_property_url ?? "");

    if (cached) {
      setData(cached.data);
      setDateRef(cached.date_ref);
    }

    if (!creds?.gsc_property_url) {
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

    // Auto-refresh if data is stale (older than today)
    if (!cached || isDataStale(cached.date_ref)) {
      await doRefresh(integration.access_token, creds.gsc_property_url);
    }
  }, [clientId]);

  useEffect(() => { loadState(); }, [loadState]);

  // ── Refresh ─────────────────────────────────────────────────────────────
  const doRefresh = async (accessToken: string, siteUrl: string) => {
    setIsFetching(true);
    setError(null);
    try {
      const fresh = await refreshGSCData(clientId, accessToken, siteUrl, propertyId);
      setData(fresh);
      setDateRef(new Date().toISOString().slice(0, 10));
      toast.success("Search Console data updated");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch data";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsFetching(false);
    }
  };

  const handleRefresh = async () => {
    const integration = await getGSCIntegration(clientId, propertyId);
    if (!integration || isTokenExpired(integration.expires_at)) {
      setStatus("expired");
      toast.error("Session expired — please reconnect");
      return;
    }
    await doRefresh(integration.access_token, credentials!.gsc_property_url!);
  };

  // ── Connect ─────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setError(null);
    const siteUrl = siteUrlInput.trim();
    if (!siteUrl) {
      setError("Please enter your Search Console site URL first.");
      return;
    }

    // Save site URL to credentials table before OAuth
    const credsPayload: Record<string, string> = { client_id: clientId, gsc_property_url: siteUrl };
    if (propertyId) credsPayload.property_id = propertyId;
    await supabase.from("client_credentials").upsert(
      credsPayload,
      { onConflict: propertyId ? "property_id" : "client_id" }
    );
    setCredentials(prev => ({ ...prev, gsc_property_url: siteUrl }));

    try {
      const accessToken = await connectSearchConsole(clientId, propertyId);
      toast.success("Connected to Google Search Console");
      setStatus("connected");
      await doRefresh(accessToken, siteUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setError(msg);
      toast.error(msg);
    }
  };

  // ── Disconnect ───────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    await disconnectSearchConsole(clientId, propertyId);
    setStatus("disconnected");
    setData(null);
    setDateRef(null);
    toast.info("Search Console disconnected");
  };

  // ── Stat card helper ─────────────────────────────────────────────────────
  const StatCard = ({
    label, value, current, previous, lowerIsBetter = false,
  }: {
    label: string; value: string;
    current: number; previous: number; lowerIsBetter?: boolean;
  }) => {
    const pct = pctChange(current, previous);
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

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === "loading") {
    return <Card className="h-48 animate-pulse bg-muted/20" />;
  }

  // ── Not connected (covers both no_property + disconnected) ──────────────
  if (status === "no_property" || status === "disconnected") {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <img
              src="https://www.gstatic.com/analytics-suite/header/suite/v2/ic_search_console.svg"
              alt="GSC" className="w-6 h-6"
            />
            <CardTitle>Google Search Console</CardTitle>
          </div>
          <CardDescription>
            Connect GSC to sync organic search performance data daily — clicks,
            impressions, CTR, top queries &amp; pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="gsc-url">Search Console Site URL</Label>
            <Input
              id="gsc-url"
              placeholder="sc-domain:example.com  or  https://example.com/"
              value={siteUrlInput}
              onChange={e => setSiteUrlInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Find this in your{" "}
              <a
                href="https://search.google.com/search-console"
                target="_blank" rel="noreferrer"
                className="underline"
              >
                Search Console
              </a>{" "}
              property selector (top-left dropdown).
            </p>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleConnect} className="gap-2 w-full sm:w-auto">
            <LinkIcon className="w-4 h-4" /> Connect Search Console
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Expired token — show stale data with reconnect prompt ─────────────────
  if (status === "expired") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b mb-4">
          <div className="flex items-center gap-3">
            <img
              src="https://www.gstatic.com/analytics-suite/header/suite/v2/ic_search_console.svg"
              alt="GSC" className="w-5 h-5 grayscale opacity-60"
            />
            <CardTitle className="text-xl">Search Console</CardTitle>
            <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">
              Session Expired
            </Badge>
          </div>
          <Button onClick={handleConnect} size="sm" variant="outline" className="gap-2">
            <LinkIcon className="w-3.5 h-3.5" /> Reconnect
          </Button>
        </CardHeader>
        <CardContent>
          <Alert>
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
              src="https://www.gstatic.com/analytics-suite/header/suite/v2/ic_search_console.svg"
              alt="GSC" className="w-5 h-5 grayscale opacity-80"
            />
            <CardTitle className="text-xl">Search Console</CardTitle>
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
            Fetching data from Search Console…
          </div>
        )}
        {data && <DataView data={data} StatCard={StatCard} />}
      </CardContent>
    </Card>
  );
}

// ── Data display sub-component ─────────────────────────────────────────────
function DataView({
  data,
  StatCard,
}: {
  data: GSCData;
  StatCard?: React.ComponentType<{
    label: string; value: string;
    current: number; previous: number; lowerIsBetter?: boolean;
  }>;
}) {
  const { current, previous } = data;
  const { summary, trend, topQueries, topPages } = current;
  const prev = previous.summary;

  const fmtNum = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString();

  // Chart: sample every N points if >60 to keep it readable
  const chartData = trend.length > 60
    ? trend.filter((_, i) => i % Math.ceil(trend.length / 30) === 0)
    : trend;

  const SimpleStatCard = ({ label, value, current: c, previous: p, lowerIsBetter }: {
    label: string; value: string; current: number; previous: number; lowerIsBetter?: boolean;
  }) => {
    const pct = pctChange(c, p);
    const isPositive = lowerIsBetter ? pct < 0 : pct > 0;
    const color = pct === 0 ? "text-muted-foreground" : isPositive ? "text-green-600" : "text-red-500";
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {pct !== 0 && (
          <p className={`text-xs ${color}`}>
            {pct > 0 ? "↑" : "↓"} {Math.abs(pct)}% vs prev 30d
          </p>
        )}
      </div>
    );
  };

  const Card_ = StatCard ?? SimpleStatCard;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card_ label="Total Clicks" value={fmtNum(summary.clicks)}
          current={summary.clicks} previous={prev.clicks} />
        <Card_ label="Total Impressions" value={fmtNum(summary.impressions)}
          current={summary.impressions} previous={prev.impressions} />
        <Card_ label="Average CTR" value={`${summary.ctr.toFixed(1)}%`}
          current={summary.ctr} previous={prev.ctr} />
        <Card_ label="Avg Position" value={summary.avgPosition.toFixed(1)}
          current={summary.avgPosition} previous={prev.avgPosition} lowerIsBetter />
      </div>

      {/* Trend chart */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Clicks &amp; Impressions Trend</h4>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false}
                tick={{ fontSize: 11 }} dy={8}
                tickFormatter={d => d.slice(5)} // show MM-DD
              />
              <YAxis yAxisId="left" axisLine={false} tickLine={false}
                tick={{ fontSize: 11 }} dx={-8} />
              <YAxis yAxisId="right" orientation="right" axisLine={false}
                tickLine={false} tick={{ fontSize: 11 }} dx={8} />
              <RechartsTooltip
                contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Line yAxisId="left" type="monotone" dataKey="clicks" name="Clicks"
                stroke="#8884d8" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              <Line yAxisId="right" type="monotone" dataKey="impressions" name="Impressions"
                stroke="#82ca9d" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top queries */}
      {topQueries.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3">Top Queries by Clicks</h4>
          <div className="rounded-md border overflow-hidden">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Query</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Clicks</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Impressions</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">CTR</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topQueries.map((q, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-4 py-2 max-w-[220px] truncate">{q.query}</td>
                    <td className="px-4 py-2 text-right font-medium">{q.clicks.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{q.impressions.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{q.ctr.toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{q.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top pages */}
      {topPages.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3">Top Pages by Clicks</h4>
          <div className="rounded-md border overflow-hidden">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Page</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Clicks</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">CTR</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topPages.map((p, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-4 py-2 max-w-[260px] truncate text-xs font-mono">{p.page}</td>
                    <td className="px-4 py-2 text-right font-medium">{p.clicks.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{p.ctr.toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{p.position.toFixed(1)}</td>
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
