import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Globe, Smartphone, Code2, LayoutGrid,
  Star, ExternalLink,
} from "lucide-react";
import { GoogleSearchConsole } from "@/components/integrations/GoogleSearchConsole";
import { GoogleAnalytics } from "@/components/integrations/GoogleAnalytics";
import { ClientCredentials } from "@/components/clients/ClientCredentials";
import { BacklinkManager } from "@/components/clients/BacklinkManager";
import { SocialPostLog } from "@/components/clients/SocialPostLog";
import { GoalsPerformance } from "@/components/clients/GoalsPerformance";
import { ActiveServicesSection } from "@/components/clients/ActiveServicesSection";
import { ClientTimeReport } from "@/components/clients/ClientTimeReport";
import { ClientDocuments } from "@/components/clients/ClientDocuments";

const TYPE_ICON: Record<string, React.ElementType> = {
  website: Globe,
  app: Smartphone,
  subdomain: Code2,
  other: LayoutGrid,
};

const TYPE_LABEL: Record<string, string> = {
  website: "Website",
  app: "App",
  subdomain: "Subdomain",
  other: "Other",
};

export default function PropertyPage() {
  const { id: clientId, propertyId } = useParams<{ id: string; propertyId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isTeamMember = profile?.role === "team_member";

  const { data: property, isLoading: propLoading } = useQuery({
    queryKey: ["property", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId,
  });

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("name, monthly_retainer_value, currency")
        .eq("id", clientId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  if (propLoading) {
    return (
      <div className="p-8">
        <div className="h-40 bg-card rounded-xl border animate-pulse" />
      </div>
    );
  }

  if (!property) {
    return <div className="p-8">Property not found</div>;
  }

  const Icon = TYPE_ICON[property.property_type] || Globe;

  return (
    <div className="flex-col md:flex">
      <div className="flex-1 space-y-4 p-8 pt-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/clients/${clientId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">{property.name}</h2>
                {property.is_primary && (
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-muted-foreground">{client?.name}</span>
                <span className="text-muted-foreground">·</span>
                <Badge variant="outline" className="text-xs">
                  {TYPE_LABEL[property.property_type] || property.property_type}
                </Badge>
                {property.url && (
                  <a
                    href={property.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {property.url}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="backlinks">Backlinks</TabsTrigger>
            <TabsTrigger value="social">Social Posts</TabsTrigger>
            <TabsTrigger value="time">Time</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <ActiveServicesSection clientId={clientId!} propertyId={propertyId} />
          </TabsContent>

          <TabsContent value="goals" className="space-y-4">
            <GoalsPerformance clientId={clientId!} propertyId={propertyId} />
          </TabsContent>

          <TabsContent value="backlinks" className="space-y-4">
            <BacklinkManager clientId={clientId!} propertyId={propertyId} />
          </TabsContent>

          <TabsContent value="social" className="space-y-4">
            <SocialPostLog clientId={clientId!} propertyId={propertyId} />
          </TabsContent>

          <TabsContent value="time" className="space-y-4">
            <ClientTimeReport
              clientId={clientId!}
              monthlyRetainer={client?.monthly_retainer_value || 0}
              currency={client?.currency || "USD"}
              propertyId={propertyId}
            />
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <ClientDocuments clientId={clientId!} />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            {!isTeamMember && (
              <ClientCredentials clientId={clientId!} propertyId={propertyId} />
            )}
            <GoogleSearchConsole clientId={clientId!} propertyId={propertyId} />
            <GoogleAnalytics clientId={clientId!} propertyId={propertyId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
