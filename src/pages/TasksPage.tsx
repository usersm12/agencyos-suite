import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Task Board</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Task management features coming soon. You'll see your assigned tasks with statuses and deliverables here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
