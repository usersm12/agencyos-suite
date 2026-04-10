import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface GoalsPerformanceProps {
  clientId: string;
}

export function GoalsPerformance({ clientId }: GoalsPerformanceProps) {
  // In a real app, this would be a complex join fetching client_goals and actual metrics from client_integration_metrics
  // We'll mock the resulting joined data for the UI demonstration based on the spec
  const { data, isLoading } = useQuery({
    queryKey: ['client-goals', clientId],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(r => setTimeout(r, 600));
      return {
        seoTraffic: { current: 15200, target: 20000 },
        gscClicks: { current: 8400, target: 10000 },
        metaCPL: { current: 45, target: 40, inverse: true }, // lower is better
        backlinks: { current: 12, target: 15 }
      };
    }
  });

  const getProgressColor = (percent: number, inverse = false) => {
    if (inverse) {
      if (percent <= 100) return "bg-green-500";
      if (percent <= 125) return "bg-amber-500";
      return "bg-red-500";
    }
    if (percent >= 100) return "bg-green-500";
    if (percent >= 75) return "bg-amber-500";
    return "bg-red-500";
  };

  if (isLoading || !data) return <div className="p-4">Loading goals...</div>;

  const renderGoal = (title: string, current: number, target: number, format: 'number' | 'currency' = 'number', inverse = false) => {
    let percent = (current / target) * 100;
    const boundedPercent = Math.min(Math.max(percent, 0), 100);
    const colorClass = getProgressColor(percent, inverse);
    
    // For inverse like CPL, higher % might mean progress is over 100, which is bad. 
    // We visually clamp it to 100% full, but keep the color logic.
    
    const displayCurrent = format === 'currency' ? `$${current}` : current.toLocaleString();
    const displayTarget = format === 'currency' ? `$${target}` : target.toLocaleString();

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <p className="text-sm font-medium leading-none">{title}</p>
            <p className="text-sm text-muted-foreground">
              {displayCurrent} / {displayTarget} target
            </p>
          </div>
          <p className="text-sm font-medium">{Math.round(percent)}% to goal</p>
        </div>
        <Progress value={boundedPercent} indicatorClassName={colorClass} className="h-2" />
      </div>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">SEO & Traffic Goals</CardTitle>
          <CardDescription>Monthly targets from Google Analytics & GSC</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderGoal("Monthly Organic Sessions", data.seoTraffic.current, data.seoTraffic.target)}
          {renderGoal("Search Console Clicks", data.gscClicks.current, data.gscClicks.target)}
          {renderGoal("High Quality Backlinks", data.backlinks.current, data.backlinks.target)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Paid Media Goals</CardTitle>
          <CardDescription>Target performance metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderGoal("Meta Ads CPL", data.metaCPL.current, data.metaCPL.target, 'currency', true)}
        </CardContent>
      </Card>

      {/* Placeholder for Rankings */}
      <Card className="col-span-1 md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Keyword Ranking Targets (SEO)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Keyword</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Target Position</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Current Position</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-3 text-sm">agency management software</td>
                  <td className="px-4 py-3 text-sm">3</td>
                  <td className="px-4 py-3 text-sm">2 <span className="text-green-500 text-xs ml-1">↑ 1</span></td>
                  <td className="px-4 py-3 text-sm"><span className="text-green-600 font-medium bg-green-100 px-2 py-1 rounded">Achieved</span></td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm">white label reporting</td>
                  <td className="px-4 py-3 text-sm">1</td>
                  <td className="px-4 py-3 text-sm">5 <span className="text-muted-foreground text-xs ml-1">-</span></td>
                  <td className="px-4 py-3 text-sm"><span className="text-amber-600 font-medium bg-amber-100 px-2 py-1 rounded">In Progress</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
