import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FlagsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Flags</h1>
      <Card>
        <CardHeader><CardTitle>Client Flags</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Flag management coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
