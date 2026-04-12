import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  email: z.string().email("Valid email required"),
  role: z.enum(["owner", "manager", "team_member"]).default("team_member"),
  manager_id: z.string().optional().or(z.literal('none'))
});

export function InviteTeamModal() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      role: "team_member",
      manager_id: "none"
    },
  });

  const { data: managers } = useQuery({
    queryKey: ['team-managers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['manager', 'owner']);
      if (error) throw error;
      return data || [];
    }
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      // Mocking invite: insert a placeholder profile
      // In a real app we'd trigger an edge function or Supabase Auth invite
      
      const { error } = await supabase.from('profiles').insert({
        id: crypto.randomUUID(), // generate a fake UUID for placeholder
        email: values.email,
        full_name: values.email.split('@')[0], // placeholder name
        role: values.role,
        manager_id: values.manager_id === 'none' ? null : values.manager_id,
        capacity: 30, // default
        active: false // pending invite basically
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-team'] });
      toast.success("Placeholder invite generated");
      form.reset();
      setOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to invite");
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 shrink-0"><Mail className="w-4 h-4" /> Invite by Email</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
             Send a magic link granting Agency access. (Mocked payload)
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="jane@agencyos.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Access</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="team_member">Team Member</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
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
                <FormItem>
                  <FormLabel>Reporting Manager</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "none"}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Unassigned / Self</SelectItem>
                      {managers?.map((mgr) => (
                         <SelectItem value={mgr.id} key={mgr.id}>{mgr.full_name} ({mgr.role.replace('_',' ')})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>Send Magic Link</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
