import { useState } from "react";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const propertySchema = z.object({
  name: z.string().min(1, "Property name required"),
  url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  property_type: z.enum(["website", "app", "subdomain", "other"]).default("website"),
  is_primary: z.boolean().default(false),
});

const addClientSchema = z.object({
  name: z.string().min(2, "Name is required"),
  website_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "onboarding"]).default("active"),
  active_services: z.array(z.string()).default([]),
  is_multisite: z.boolean().default(false),
  properties: z.array(propertySchema).default([]),
});

type AddClientFormValues = z.infer<typeof addClientSchema>;

interface AddClientModalProps {
  children?: React.ReactNode;
}

export function AddClientModal({ children }: AddClientModalProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<AddClientFormValues>({
    resolver: zodResolver(addClientSchema),
    defaultValues: {
      name: "",
      website_url: "",
      status: "active",
      active_services: [],
      is_multisite: false,
      properties: [],   // empty — items only added when is_multisite is toggled on
    },
  });

  const { fields: propertyFields, append: appendProperty, remove: removeProperty } =
    useFieldArray({ control: form.control, name: "properties" });

  const isMultisite = form.watch("is_multisite");

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  async function onSubmit(data: AddClientFormValues) {
    try {
      const propertiesPayload = data.is_multisite
        ? data.properties.map((p, i) => ({ ...p, is_primary: i === 0 }))
        : [];

      const { data: result, error } = await supabase.rpc("create_client", {
        p_name: data.name,
        p_website_url: data.website_url || null,
        p_status: data.status,
        p_service_ids: data.active_services,
        p_is_multisite: data.is_multisite,
        p_properties: propertiesPayload,
      });

      if (error) throw error;
      if ((result as any)?.error) throw new Error((result as any).error);

      toast.success("Client added successfully");
      form.reset();
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["clients-list"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to add client");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>
            Enter the details for your new client. You can edit these later from their profile.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">

            {/* ── Basic info ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="onboarding">Onboarding</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* ── Single / Multi property toggle ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Multiple Properties</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enable if this client has more than one website, app, or subdomain
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="is_multisite"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={(val) => {
                        field.onChange(val);
                        if (val) {
                          // Toggling ON — seed one blank property if none exist
                          if (propertyFields.length === 0) {
                            form.setValue("properties", [
                              { name: "", url: "", property_type: "website", is_primary: true },
                            ]);
                          }
                        } else {
                          // Toggling OFF — clear so hidden items don't block validation
                          form.setValue("properties", []);
                        }
                      }}
                    />
                  )}
                />
              </div>

              {!isMultisite ? (
                /* Single site — just the URL field */
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
              ) : (
                /* Multi-site — dynamic property list */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Properties</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                      onClick={() =>
                        appendProperty({
                          name: "",
                          url: "",
                          property_type: "website",
                          is_primary: false,
                        })
                      }
                    >
                      <Plus className="w-3 h-3" /> Add Property
                    </Button>
                  </div>

                  {propertyFields.map((pf, idx) => (
                    <div
                      key={pf.id}
                      className="rounded-lg border p-3 space-y-3 bg-muted/20 relative"
                    >
                      {idx === 0 && (
                        <Badge className="absolute top-2 right-2 text-[10px] bg-primary/10 text-primary border-primary/20">
                          Primary
                        </Badge>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-16">
                        <FormField
                          control={form.control}
                          name={`properties.${idx}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Property Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="Main Site" className="h-8 text-sm" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`properties.${idx}.url`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">URL</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="https://example.com"
                                  className="h-8 text-sm"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name={`properties.${idx}.property_type`}
                        render={({ field }) => (
                          <FormItem className="w-40">
                            <FormLabel className="text-xs">Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="website">Website</SelectItem>
                                <SelectItem value="app">App</SelectItem>
                                <SelectItem value="subdomain">Subdomain</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      {idx > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-8 h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeProperty(idx)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* ── Services ── */}
            <FormField
              control={form.control}
              name="active_services"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Active Services</FormLabel>
                    <DialogDescription>
                      Select the services this client receives.
                    </DialogDescription>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {services?.map((service) => (
                      <FormField
                        key={service.id}
                        control={form.control}
                        name="active_services"
                        render={({ field }) => (
                          <FormItem
                            key={service.id}
                            className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(service.id)}
                                onCheckedChange={(checked) =>
                                  checked
                                    ? field.onChange([...field.value, service.id])
                                    : field.onChange(field.value?.filter((v) => v !== service.id))
                                }
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              {service.name}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating…" : "Create Client"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
