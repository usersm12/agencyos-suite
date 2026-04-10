import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { AlertCircle, Link as LinkIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface GoogleAnalyticsProps {
  clientId: string;
}

export function GoogleAnalytics({ clientId }: GoogleAnalyticsProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsConnected(true); 
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [clientId]);

  const handleConnect = () => {
    toast.info("Redirecting to Google OAuth...");
    setTimeout(() => {
      setIsConnected(true);
      toast.success("Successfully connected to Google Analytics 4");
    }, 1500);
  };

  const mockSessionsData = [
    { name: "Jan", sessions: 4000, newUsers: 2400 },
    { name: "Feb", sessions: 4500, newUsers: 2600 },
    { name: "Mar", sessions: 4300, newUsers: 2500 },
    { name: "Apr", sessions: 5200, newUsers: 3100 },
    { name: "May", sessions: 5800, newUsers: 3400 },
    { name: "Jun", sessions: 6400, newUsers: 3800 },
  ];

  const mockTrafficSources = [
    { name: "Organic Search", value: 45 },
    { name: "Direct", value: 25 },
    { name: "Paid Search", value: 15 },
    { name: "Social", value: 10 },
    { name: "Referral", value: 5 },
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  if (isLoading) {
    return <Card className="h-64 animate-pulse bg-muted/20" />;
  }

  if (!isConnected) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <img src="https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg" alt="GA4" className="w-6 h-6" />
            <CardTitle>Google Analytics 4</CardTitle>
          </div>
          <CardDescription>Connect GA4 to track website traffic and user behavior.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground opacity-20" />
          <Button onClick={handleConnect} className="gap-2">
            <LinkIcon className="w-4 h-4" /> Connect GA4
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
            <img src="https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg" alt="GA4" className="w-5 h-5 grayscale opacity-80" />
            <CardTitle className="text-xl">Google Analytics 4</CardTitle>
            <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Connected</Badge>
          </div>
          <CardDescription className="mt-1">Showing data for the last 6 months</CardDescription>
        </div>
        <Button variant="ghost" size="icon" title="Refresh Data">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
           <div className="space-y-1">
             <p className="text-sm font-medium text-muted-foreground">Sessions</p>
             <p className="text-2xl font-bold">30.2K</p>
             <p className="text-xs text-green-600">↑ 10% vs last mo</p>
           </div>
           <div className="space-y-1">
             <p className="text-sm font-medium text-muted-foreground">Users</p>
             <p className="text-2xl font-bold">24.5K</p>
             <p className="text-xs text-green-600">↑ 8% vs last mo</p>
           </div>
           <div className="space-y-1">
             <p className="text-sm font-medium text-muted-foreground">New Users</p>
             <p className="text-2xl font-bold">17.8K</p>
             <p className="text-xs text-green-600">↑ 12% vs last mo</p>
           </div>
           <div className="space-y-1">
             <p className="text-sm font-medium text-muted-foreground">Bounce Rate</p>
             <p className="text-2xl font-bold">42.1%</p>
             <p className="text-xs text-red-600">↑ 2.4% vs last mo</p>
           </div>
           <div className="space-y-1">
             <p className="text-sm font-medium text-muted-foreground">Avg. Session</p>
             <p className="text-2xl font-bold">2m 14s</p>
             <p className="text-xs text-green-600">↑ 12s vs last mo</p>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          <div className="lg:col-span-2 h-[300px] w-full">
            <h4 className="text-sm font-semibold mb-3">Sessions Trend</h4>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={mockSessionsData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dx={-10} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#F4B400" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="newUsers" name="New Users" stroke="#4285F4" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="h-[300px] w-full flex flex-col items-center">
            <h4 className="text-sm font-semibold w-full text-center mb-3">Traffic Sources</h4>
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={mockTrafficSources}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {mockTrafficSources.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
