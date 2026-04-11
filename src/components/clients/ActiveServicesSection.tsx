import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function ActiveServicesSection({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();

  // 1. Fetch available global services
  const { data: services, isLoading: loadingServices } = useQuery({
    queryKey: ['available-services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').eq('is_active', true);
      if (error) throw error;
      return data || [];
    }
  });

  // 2. Fetch actively assigned client services
  const { data: activeAssignments, isLoading: loadingAssignments } = useQuery({
    queryKey: ['client_services', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_services')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    }
  });

  const toggleServiceMutation = useMutation({
    mutationFn: async ({ serviceId, checked }: { serviceId: string, checked: boolean }) => {
      if (checked) {
        // Upsert assigning service
        const { error } = await supabase.from('client_services').upsert({
          client_id: clientId,
          service_id: serviceId,
          is_active: true
        }, { onConflict: 'client_id, service_id' });
        if (error) throw error;
      } else {
        // We can either set is_active=false or delete. We'll set is_active=false. 
        // Or actually delete to keep it clean if no goals are heavily dependent.
        const { error } = await supabase.from('client_services').delete()
          .eq('client_id', clientId)
          .eq('service_id', serviceId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_services', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client', clientId] }); // For the global client card
      toast.success("Client services updated");
    },
    onError: (err: any) => toast.error("Failed to map service: " + err.message)
  });

  if (loadingServices || loadingAssignments) {
    return (
      <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
        <h3 className="font-semibold mb-4 text-lg">Active Services Map</h3>
        <div className="flex items-center text-muted-foreground text-sm"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading services...</div>
      </div>
    );
  }

  const assignedServiceIds = activeAssignments?.map(a => a.service_id) || [];

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
      <h3 className="font-semibold mb-4 text-lg">Active Services Map</h3>
      
      {services && services.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div key={service.id} className="flex items-center space-x-3 p-3 border rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
              <Checkbox 
                id={`service-${service.id}`} 
                checked={assignedServiceIds.includes(service.id)}
                onCheckedChange={(checked) => {
                  toggleServiceMutation.mutate({ serviceId: service.id, checked: !!checked });
                }}
              />
              <Label 
                htmlFor={`service-${service.id}`}
                className="text-sm font-medium leading-none cursor-pointer flex-1 py-1"
              >
                {service.name}
              </Label>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm italic">No global services are active. Configure them in Settings.</p>
      )}
    </div>
  );
}
