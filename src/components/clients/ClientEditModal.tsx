import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const editClientSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Must be a valid email").optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  company: z.string().optional().or(z.literal('')),
  website_url: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  industry: z.string().optional().or(z.literal('')),
  contract_type: z.string().optional().or(z.literal('')),
  contract_start_date: z.string().optional().or(z.literal('')),
  monthly_retainer_value: z.coerce.number().optional().or(z.literal(0)),
  manager_id: z.string().optional().or(z.literal('')),
  status: z.enum(["active", "inactive", "onboarding"]).default("active"),
  notes: z.string().optional().or(z.literal('')),
});

type EditClientFormValues = z.infer<typeof editClientSchema>;

interface ClientEditModalProps {
  clientId: string;
  clientData: any;
  children?: React.ReactNode;
}

export function ClientEditModal({ clientId, clientData, children }: ClientEditModalProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<EditClientFormValues>({
    resolver: zodResolver(editClientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      website_url: "",
      industry: "",
      contract_type: "retainer",
      contract_start_date: "",
      monthly_retainer_value: 0,
      manager_id: "",
      status: "active",
      notes: "",
    },
  });

  // Re-hydrate dynamically
  useEffect(() => {
    if (clientData && open) {
      form.reset({
        name: clientData.name || "",
        email: clientData.email || "",
        phone: clientData.phone || "",
        company: clientData.company || "",
        website_url: clientData.website_url || "",
        industry: clientData.industry || "",
        contract_type: clientData.contract_type || "retainer",
        contract_start_date: clientData.contract_start_date ? String(clientData.contract_start_date).split('T')[0] : "",
        monthly_retainer_value: clientData.monthly_retainer_value ? Number(clientData.monthly_retainer_value) : 0,
        manager_id: clientData.manager_id || "",
        status: clientData.status || "active",
        notes: clientData.notes || "",
      });
    }
  }, [clientData, open, form]);

  const { data: managers } = useQuery({
    queryKey: ['available-managers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['manager', 'owner']);
      if (error) throw error;
      return data;
    }
  });

  async function onSubmit(data: EditClientFormValues) {
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          company: data.company || null,
          website_url: data.website_url || null,
          industry: data.industry || null,
          contract_type: data.contract_type || null,
          contract_start_date: data.contract_start_date || null,
          monthly_retainer_value: data.monthly_retainer_value ? Number(data.monthly_retainer_value) : null,
          manager_id: data.manager_id || null,
          status: data.status,
          notes: data.notes || null,
        })
        .eq('id', clientId);

      if (error) throw error;

      toast.success("Client updated successfully");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients-list'] });
    } catch (error: any) {
      toast.error(error.message || "Failed to update client");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="gap-2">
            <Pencil className="h-4 w-4" /> Edit Profile
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Client Profile</DialogTitle>
          <DialogDescription>
            Update comprehensive CRM mappings for this client.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+1 (555) 000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Healthcare, eCommerce" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="monthly_retainer_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Retainer Value ($)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="5000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contract_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="retainer">Retainer</SelectItem>
                        <SelectItem value="one-time">One-Time / Project</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contract_start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="onboarding">Onboarding</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="churned">Churned</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="manager_id"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Assigned Manager</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {managers?.map((mgr) => (
                           <SelectItem value={mgr.id} key={mgr.id}>{mgr.full_name} ({mgr.role.replace('_',' ')})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Client Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Context or internal notes about this client..." className="min-h-[100px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
