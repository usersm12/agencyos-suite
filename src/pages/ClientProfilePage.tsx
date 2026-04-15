import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Settings, Building2, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { GoalsPerformance } from "@/components/clients/GoalsPerformance";
import { formatCurrency } from "@/lib/currencies";
import { ClientCredentials } from "@/components/clients/ClientCredentials";
import { GoogleSearchConsole } from "@/components/integrations/GoogleSearchConsole";
import { GoogleAnalytics } from "@/components/integrations/GoogleAnalytics";
import { ClientEditModal } from "@/components/clients/ClientEditModal";
import { TeamAssignmentsSection } from "@/components/clients/TeamAssignmentsSection";
import { ActiveServicesSection } from "@/components/clients/ActiveServicesSection";
import { BacklinkManager } from "@/components/clients/BacklinkManager";
import { SocialPostLog } from "@/components/clients/SocialPostLog";

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          profiles!clients_manager_id_fkey (full_name),
          client_services (
            services (name)
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  if (isLoading) {
    return <div className="p-8"><div className="h-40 bg-card rounded-xl border animate-pulse" /></div>;
  }

  if (!client) {
    return <div className="p-8">Client not found</div>;
  }

  const activeServices = client.client_services?.map((cs: any) => cs.services?.name).filter(Boolean) || [];

  return (
    <div className="flex-col md:flex">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/clients')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-3xl font-bold tracking-tight">Client Profile</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <ClientEditModal clientId={id!} clientData={client} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
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
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  client.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
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

          <div className="col-span-4 lg:col-span-3">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="goals">Performance vs Goals</TabsTrigger>
                <TabsTrigger value="backlinks">Backlinks</TabsTrigger>
                <TabsTrigger value="social">Social Posts</TabsTrigger>
                <TabsTrigger value="integrations">Integrations & Credentials</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <TeamAssignmentsSection clientId={id!} />
                
                <ActiveServicesSection clientId={id!} />
                
                {client.notes && (
                  <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <h3 className="font-semibold mb-4 text-lg">Client Notes</h3>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{client.notes}</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="goals" className="space-y-4">
                <GoalsPerformance clientId={id!} />
              </TabsContent>

              <TabsContent value="backlinks" className="space-y-4">
                <BacklinkManager clientId={id!} />
              </TabsContent>

              <TabsContent value="social" className="space-y-4">
                <SocialPostLog clientId={id!} />
              </TabsContent>

              <TabsContent value="integrations" className="space-y-6">
                 <ClientCredentials clientId={id!} />
                 <GoogleSearchConsole clientId={id!} />
                 <GoogleAnalytics clientId={id!} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
