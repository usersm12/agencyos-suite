import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
      <Card>
        <CardHeader><CardTitle>Analytics & Reports</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Reporting features coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
