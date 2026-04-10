import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ServicesMaster from "@/components/settings/ServicesMaster";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <Tabs defaultValue="services" className="w-full">
        <TabsList>
          <TabsTrigger value="services">Services Master</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>
        <TabsContent value="services" className="mt-4">
          <ServicesMaster />
        </TabsContent>
        <TabsContent value="general" className="mt-4">
          <p className="text-muted-foreground">General settings coming soon.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
