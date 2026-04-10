import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ClientCard } from "@/components/clients/ClientCard";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      // Fetch clients with their assigned manager and flags count
      const { data: clientsData, error } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          status,
          client_services (
            services (
              name
            )
          ),
          flags (count)
        `);
      
      if (error) throw error;
      
      return clientsData.map((c: any) => ({
        id: c.id,
        name: c.name,
        industry: "General",
        healthScore: Math.max(0, 100 - (c.flags[0]?.count || 0) * 15),
        managerName: "Unassigned",
        activeServices: c.client_services?.map((cs: any) => cs.services?.name).filter(Boolean) || [],
        openFlagsCount: c.flags[0]?.count || 0,
        monthlyRetainer: 0
      }));
    }
  });

  const filteredClients = clients?.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.industry.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage your agency's clients and their performance.</p>
        </div>
        <AddClientModal />
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search clients..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 bg-card rounded-xl border animate-pulse" />
          ))}
        </div>
      ) : filteredClients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredClients.map((client) => (
            <ClientCard key={client.id} {...client} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-xl bg-card/50">
          <h3 className="text-lg font-semibold mt-4">No clients found</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {searchQuery ? "Try a different search term" : "Get started by adding your first client"}
          </p>
          {!searchQuery && (
            <div className="mt-4">
              <AddClientModal>
                <Button variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Add Client
                </Button>
              </AddClientModal>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
