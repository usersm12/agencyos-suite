import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Client Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Client management features coming soon. You'll be able to add, edit, and assign services to clients here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
