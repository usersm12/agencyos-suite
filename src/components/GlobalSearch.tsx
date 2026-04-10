import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2 } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['global-search', query],
    queryFn: async () => {
      // In a real prod environment we'd use Edge Function full-text indexing,
      // here we simulate dynamic multi-table search using an ilike approach
      if (!query || query.length < 2) return { clients: [], tasks: [] };
      
      const searchTerm = `%${query}%`;
      
      const [clientsRes, tasksRes] = await Promise.all([
        supabase.from('clients').select('id, name').ilike('name', searchTerm).limit(5),
        supabase.from('tasks').select('id, title, status').ilike('title', searchTerm).limit(5)
      ]);
      
      return {
        clients: clientsRes.data || [],
        tasks: tasksRes.data || []
      };
    },
    enabled: query.length >= 2,
  });

  const onSelectEntity = (type: string, id: string) => {
    setOpen(false);
    navigate(`/${type}s?id=${id}`); // Quick jumping router convention
  };

  return (
    <>
      <button 
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 hover:bg-muted/80 border rounded-md transition-colors w-full max-w-[240px]"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Search AgencyOS...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Type a command or search..." 
          value={query} 
          onValueChange={setQuery} 
        />
        <CommandList>
          {!query && (
             <div className="py-6 text-center text-sm text-muted-foreground">
               Type at least 2 characters to search across clients and tasks.
             </div>
          )}
          {isLoading && query.length >= 2 && (
             <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
               <Loader2 className="w-4 h-4 animate-spin" /> Searching globally...
             </div>
          )}
          {!isLoading && query.length >= 2 && searchResults?.clients?.length === 0 && searchResults?.tasks?.length === 0 && (
            <CommandEmpty>No results found for "{query}".</CommandEmpty>
          )}

          {searchResults?.clients?.length! > 0 && (
            <CommandGroup heading="Clients">
              {searchResults?.clients?.map((client) => (
                <CommandItem key={client.id} onSelect={() => onSelectEntity('client', client.id)}>
                  {client.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {searchResults?.tasks?.length! > 0 && (
            <CommandGroup heading="Tasks">
              {searchResults?.tasks?.map((task) => (
                <CommandItem key={task.id} onSelect={() => onSelectEntity('task', task.id)}>
                  {task.title}
                  <span className="ml-auto text-xs opacity-50 uppercase tracking-widest">{task.status?.replace('_', ' ')}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
