import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Building2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { GoalsPerformance } from "@/components/clients/GoalsPerformance";
import { formatCurrency } from "@/lib/currencies";
import { ClientCredentials } from "@/components/clients/ClientCredentials";
import { GoogleSearchConsole } from "@/components/integrations/GoogleSearchConsole";
import { GoogleAnalytics } from "@/components/integrations/GoogleAnalytics";
import { ClientEditModal } from "@/components/clients/ClientEditModal";
import { TeamAssignmentsSection } from "@/components/clients/TeamAssignmentsSection";
import { ActiveServicesSection } from "@/components/clients/ActiveServicesSection";
import { ClientDocuments } from "@/components/clients/ClientDocuments";
import { ClientTimeReport } from "@/components/clients/ClientTimeReport";
import { WebProjectMiniCard } from "@/components/webproject/WebProjectMiniCard";
import { PropertiesSection } from "@/components/clients/PropertiesSection";
import { ClientTasksSection } from "@/components/clients/ClientTasksSection";
import { ClientDeliverablesSummary } from "@/components/clients/ClientDeliverablesSummary";
import { ClientInsightsPanel } from "@/components/clients/ClientInsightsPanel";

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isTeamMember = profile?.role === "team_member";
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`*, profiles!clients_manager_id_fkey (full_name), client_services (services (name))`)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc("delete_client", { p_client_id: id });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Client deleted");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      navigate("/clients");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete client");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (isLoading) {
    return <div className="p-8"><div className="h-40 bg-card rounded-xl border animate-pulse" /></div>;
  }

  if (!client) {
    return <div className="p-8">Client not found</div>;
  }

  return (
    <div className="flex-col md:flex">
      <div className="flex-1 space-y-4 p-8 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/clients')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-3xl font-bold tracking-tight">Client Profile</h2>
          </div>

          {/* Settings dropdown — Edit + Delete (owners + managers only) */}
          {!isTeamMember && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <MoreVertical className="h-4 w-4" />
                  Settings
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <ClientEditModal clientId={id!} clientData={client}>
                  <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={(e) => e.preventDefault()}>
                    <Pencil className="h-4 w-4" />
                    Edit Client
                  </DropdownMenuItem>
                </ClientEditModal>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2 cursor-pointer"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Client
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {/* Sidebar */}
          <div className="rounded-xl border bg-card text-card-foreground shadow col-span-4 lg:col-span-1 p-6 flex flex-col items-center text-center space-y-4 h-fit">
            <Avatar className="h-24 w-24">
              <AvatarImage src="" alt="Client" />
              <AvatarFallback className="text-2xl">{client.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-xl">{client.name}</h3>
              <p className="text-sm text-muted-foreground flex items-center justify-center mt-1">
                <Building2 className="mr-1 h-3 w-3" /> {client.industry || "General Industry"}
              </p>
              {client.website_url && (
                <a href={client.website_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-1 block">
                  {client.website_url}
                </a>
              )}
            </div>
            <div className="w-full pt-4 border-t space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${client.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {client.status ? client.status.charAt(0).toUpperCase() + client.status.slice(1) : 'Active'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Contract</span>
                <span className="font-medium">{client.contract_type || 'Retainer'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">MRR / Value</span>
                <span className="font-medium">{formatCurrency(client.monthly_retainer_value || 0, client.currency || 'USD')}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Manager</span>
                <span className="font-medium">{client.profiles?.full_name || 'Unassigned'}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="col-span-4 lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                {/* Properties tab — only for multisite clients */}
                {client.is_multisite && (
                  <TabsTrigger value="properties">Properties</TabsTrigger>
                )}
                <TabsTrigger value="goals">Performance vs Goals</TabsTrigger>
                <TabsTrigger value="backlinks">Backlinks</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="social">Social Posts</TabsTrigger>
                <TabsTrigger value="time">Time</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                {/* Single-site clients show Integrations tab here;
                    multisite clients manage integrations per-property */}
                {!client.is_multisite && (
                  <TabsTrigger value="integrations">Integrations</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <ClientInsightsPanel clientId={id!} onTabChange={setActiveTab} />
                <WebProjectMiniCard clientId={id!} />
                <TeamAssignmentsSection clientId={id!} />
                {/* For multisite: prompt user to pick a property for services */}
                {!client.is_multisite && <ActiveServicesSection clientId={id!} />}
                {client.notes && (
                  <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <h3 className="font-semibold mb-4 text-lg">Client Notes</h3>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{client.notes}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="tasks" className="space-y-4">
                <ClientTasksSection clientId={id!} />
              </TabsContent>

              {/* Properties tab — multisite only */}
              {client.is_multisite && (
                <TabsContent value="properties" className="space-y-4">
                  <PropertiesSection clientId={id!} />
                </TabsContent>
              )}

              <TabsContent value="goals" className="space-y-4">
                <GoalsPerformance clientId={id!} />
              </TabsContent>

              <TabsContent value="backlinks" className="space-y-4">
                <ClientDeliverablesSummary clientId={id!} serviceType="Backlinks" />
              </TabsContent>

              <TabsContent value="content" className="space-y-4">
                <ClientDeliverablesSummary clientId={id!} serviceType="Content Writing" />
              </TabsContent>

              <TabsContent value="social" className="space-y-4">
                <ClientDeliverablesSummary clientId={id!} serviceType="Social Media" />
              </TabsContent>

              <TabsContent value="time" className="space-y-4">
                <ClientTimeReport clientId={id!} monthlyRetainer={client.monthly_retainer_value || 0} currency={client.currency || 'USD'} />
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                <ClientDocuments clientId={id!} />
              </TabsContent>

              {/* Integrations tab — single-site clients only */}
              {!client.is_multisite && (
                <TabsContent value="integrations" className="space-y-6">
                  {!isTeamMember && <ClientCredentials clientId={id!} />}
                  <GoogleSearchConsole clientId={id!} />
                  <GoogleAnalytics clientId={id!} />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {client.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the client and all associated tasks, team assignments, backlinks, and documents. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete Client"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
