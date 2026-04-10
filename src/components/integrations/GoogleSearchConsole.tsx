import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { AlertCircle, Link as LinkIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface GoogleSearchConsoleProps {
  clientId: string;
}

export function GoogleSearchConsole({ clientId }: GoogleSearchConsoleProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Mock data fetching simulation
  useEffect(() => {
    const timer = setTimeout(() => {
      // In real app, check if client_integrations has 'google_search_console' for this client
      setIsConnected(true); 
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [clientId]);

  const handleConnect = () => {
    toast.info("Redirecting to Google OAuth...");
    setTimeout(() => {
      setIsConnected(true);
      toast.success("Successfully connected to Google Search Console");
    }, 1500);
  };

  const mockChartData = [
    { name: "Jan", clicks: 4000, impressions: 24000 },
    { name: "Feb", clicks: 3000, impressions: 13980 },
    { name: "Mar", clicks: 2000, impressions: 9800 },
    { name: "Apr", clicks: 2780, impressions: 39080 },
    { name: "May", clicks: 1890, impressions: 48000 },
    { name: "Jun", clicks: 2390, impressions: 38000 },
  ];

  const mockTopQueries = [
    { query: "marketing agency near me", clicks: 342, impressions: 1205, ctr: "28.3%", position: 2.1 },
    { query: "b2b lead generation services", clicks: 210, impressions: 980, ctr: "21.4%", position: 3.4 },
    { query: "seo agency pricing", clicks: 184, impressions: 1540, ctr: "11.9%", position: 4.8 },
    { query: "white label marketing", clicks: 112, impressions: 890, ctr: "12.5%", position: 5.2 },
    { query: "agency os", clicks: 95, impressions: 310, ctr: "30.6%", position: 1.1 },
  ];

  if (isLoading) {
    return <Card className="h-64 animate-pulse bg-muted/20" />;
  }

  if (!isConnected) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <img src="https://www.gstatic.com/analytics-suite/header/suite/v2/ic_search_console.svg" alt="GSC" className="w-6 h-6" />
            <CardTitle>Google Search Console</CardTitle>
          </div>
          <CardDescription>Connect GSC to sync organic search performance data daily.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground opacity-20" />
          <Button onClick={handleConnect} className="gap-2">
            <LinkIcon className="w-4 h-4" /> Connect Search Console
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <img src="https://www.gstatic.com/analytics-suite/header/suite/v2/ic_search_console.svg" alt="GSC" className="w-5 h-5 grayscale opacity-80" />
            <CardTitle className="text-xl">Search Console</CardTitle>
            <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Connected</Badge>
          </div>
          <CardDescription className="mt-1">Showing data for the last 6 months</CardDescription>
        </div>
        <Button variant="ghost" size="icon" title="Refresh Data">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="space-y-1">
             <p className="text-sm font-medium text-muted-foreground">Total Clicks</p>
             <p className="text-2xl font-bold">16.0K</p>
             <p className="text-xs text-green-600">↑ 12% vs last mo</p>
           </div>
           <div className="space-y-1">
             <p className="text-sm font-medium text-muted-foreground">Total Impressions</p>
             <p className="text-2xl font-bold">172K</p>
             <p className="text-xs text-green-600">↑ 8% vs last mo</p>
           </div>
           <div className="space-y-1">
             <p className="text-sm font-medium text-muted-foreground">Average CTR</p>
             <p className="text-2xl font-bold">9.3%</p>
             <p className="text-xs text-green-600">↑ 1.2% vs last mo</p>
           </div>
           <div className="space-y-1">
             <p className="text-sm font-medium text-muted-foreground">Average Position</p>
             <p className="text-2xl font-bold">14.2</p>
             <p className="text-xs text-green-600">↑ 2.1 vs last mo</p>
           </div>
        </div>

        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dx={-10} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dx={10} />
              <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Line yAxisId="left" type="monotone" dataKey="clicks" name="Clicks" stroke="#8884d8" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="monotone" dataKey="impressions" name="Impressions" stroke="#82ca9d" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

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
                {mockTopQueries.map((q, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-4 py-2">{q.query}</td>
                    <td className="px-4 py-2 text-right font-medium">{q.clicks}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{q.impressions.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{q.ctr}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{q.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
