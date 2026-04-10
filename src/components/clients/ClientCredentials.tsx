import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const credentialsSchema = z.object({
  website_cms_url: z.string().url().optional().or(z.literal('')),
  website_cms_notes: z.string().optional(),
  ga4_property_id: z.string().optional(),
  gsc_property_url: z.string().optional(),
  google_ads_account_id: z.string().optional(),
  meta_business_manager_id: z.string().optional(),
  general_notes: z.string().optional(),
});

type CredentialsFormValues = z.infer<typeof credentialsSchema>;

interface ClientCredentialsProps {
  clientId: string;
  initialData?: Partial<CredentialsFormValues>;
}

export function ClientCredentials({ clientId, initialData }: ClientCredentialsProps) {
  const form = useForm<CredentialsFormValues>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      website_cms_url: initialData?.website_cms_url || "",
      website_cms_notes: initialData?.website_cms_notes || "",
      ga4_property_id: initialData?.ga4_property_id || "",
      gsc_property_url: initialData?.gsc_property_url || "",
      google_ads_account_id: initialData?.google_ads_account_id || "",
      meta_business_manager_id: initialData?.meta_business_manager_id || "",
      general_notes: initialData?.general_notes || "",
    },
  });

  async function onSubmit(data: CredentialsFormValues) {
    try {
      const { error } = await supabase
        .from('client_credentials')
        .upsert({ 
          client_id: clientId,
          ...data 
        }, { onConflict: 'client_id' });

      if (error) throw error;
      toast.success("Credentials updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update credentials");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Platform Credentials</CardTitle>
        <CardDescription>
          Store sensitive URLs, IDs, and access notes. (Social media handles managed separately)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-4 md:col-span-2 lg:col-span-1">
                <h3 className="text-sm font-semibold tracking-tight">Website & CMS</h3>
                <FormField
                  control={form.control}
                  name="website_cms_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CMS Login URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/wp-admin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="website_cms_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CMS Access Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Shared via 1Password..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 md:col-span-2 lg:col-span-1">
                <h3 className="text-sm font-semibold tracking-tight">Analytics & Ads</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ga4_property_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GA4 Property ID</FormLabel>
                        <FormControl>
                          <Input placeholder="123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gsc_property_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Search Console URL</FormLabel>
                        <FormControl>
                          <Input placeholder="sc-domain:example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="google_ads_account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Google Ads ID</FormLabel>
                        <FormControl>
                          <Input placeholder="123-456-7890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="meta_business_manager_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meta BM ID</FormLabel>
                        <FormControl>
                          <Input placeholder="123456789012345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4 md:col-span-2">
                <h3 className="text-sm font-semibold tracking-tight">General Access Notes</h3>
                <FormField
                  control={form.control}
                  name="general_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea className="min-h-[100px]" placeholder="Any other credentials context or notes here..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

            </div>
            
            <div className="flex justify-end">
              <Button type="submit">Save Credentials</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
