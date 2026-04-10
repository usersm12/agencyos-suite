import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckSquare, Flag, BarChart3 } from "lucide-react";

function StatCard({ title, value, icon: Icon, description }: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}) {
  return (
    <Card className="animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();

  const greeting = profile?.full_name
    ? `Welcome back, ${profile.full_name.split(" ")[0]}`
    : "Welcome back";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
        <p className="text-muted-foreground">
          Here's what's happening across your agency today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Clients" value="—" icon={Users} description="Loading..." />
        <StatCard title="Open Tasks" value="—" icon={CheckSquare} description="Loading..." />
        <StatCard title="Open Flags" value="—" icon={Flag} description="Loading..." />
        <StatCard title="Completion Rate" value="—" icon={BarChart3} description="Loading..." />
      </div>

      {profile?.role === "owner" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Owner Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You have full access to all clients, team members, and settings.
              Use the sidebar to navigate between sections.
            </p>
          </CardContent>
        </Card>
      )}

      {profile?.role === "manager" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Manager Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You can see your assigned clients and their tasks.
              Check the Clients and Tasks pages for details.
            </p>
          </CardContent>
        </Card>
      )}

      {profile?.role === "team_member" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              View and manage your assigned tasks from the Tasks page.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
