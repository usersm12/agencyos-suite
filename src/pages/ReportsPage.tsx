import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Printer } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Mock data generation for graphs based loosely on time
const generateTrendData = () => {
  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  return months.map(m => ({
    name: m,
    score: Math.floor(Math.random() * 30) + 70, // 70-100
    completion: Math.floor(Math.random() * 40) + 60, // 60-100
    target: 100
  }));
};

const AGENCY_DATA = generateTrendData();

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("agency");
  const [selectedClient, setSelectedClient] = useState<string>("all");

  const { data: clients } = useQuery({
    queryKey: ['reports-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, name').order('name');
      return data || [];
    }
  });

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-8 print:bg-white print:p-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
          <p className="text-muted-foreground mt-1">Exportable insights for client performance and agency health.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExportPDF} className="gap-2">
            <Printer className="w-4 h-4" /> Export PDF
          </Button>
          <Button className="gap-2">
            <Download className="w-4 h-4" /> Download Raw Data
          </Button>
        </div>
      </div>

      <div className="print:block print:w-[800px] print:mx-auto">
        {/* Print Header */}
        <div className="hidden print:block mb-8 pb-4 border-b">
          <h1 className="text-3xl font-bold">AgencyOS End of Month Report</h1>
          <p className="text-gray-500">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex justify-between items-center print:hidden">
            <TabsList>
              <TabsTrigger value="agency">Agency Overview</TabsTrigger>
              <TabsTrigger value="client">Client Performance</TabsTrigger>
            </TabsList>
            
            {activeTab === 'client' && (
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select a client..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients (Aggregate)</SelectItem>
                  {clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <TabsContent value="agency" className="space-y-6 print:block">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="print:shadow-none print:border-gray-200">
                <CardHeader>
                  <CardTitle>Agency Health Trend (Average)</CardTitle>
                  <CardDescription>6-month trailing trajectory of global client health.</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={AGENCY_DATA}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="print:shadow-none print:border-gray-200">
                <CardHeader>
                  <CardTitle>Task Completion Velocity</CardTitle>
                  <CardDescription>Percentage of assigned tasks completed on time.</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={AGENCY_DATA}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="completion" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            
            <Card className="print:shadow-none print:border-gray-200">
              <CardHeader>
                <CardTitle>Service Distribution Breakdowns</CardTitle>
                <CardDescription>What your agency is currently executing the most.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-8 h-48 border rounded-xl bg-muted/20 justify-center text-muted-foreground font-medium">
                   Pie Chart Placeholder (Recharts Pie)
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="client" className="space-y-6 hidden print:block">
            <Card className="print:shadow-none print:border-gray-200">
              <CardHeader>
                <CardTitle>{selectedClient === 'all' ? 'Aggregate' : clients?.find(c => c.id === selectedClient)?.name} Backlink Build Velocity</CardTitle>
                <CardDescription>Target vs Actual DoFollow links placed per month.</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={AGENCY_DATA}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" name="Target" dataKey="target" stroke="#94a3b8" strokeDasharray="5 5" />
                    <Line type="monotone" name="Actual Links" dataKey="completion" stroke="#8b5cf6" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <div className="grid grid-cols-2 gap-6 pt-6">
              <div className="border rounded-lg p-6 bg-green-50 print:bg-transparent">
                 <h4 className="font-semibold text-green-900 mb-2">Key Wins</h4>
                 <ul className="list-disc pl-5 text-sm space-y-2 text-green-800">
                   <li>Achieved #1 Ranking for Primary Keyword</li>
                   <li>Exceeded Backlinking KPI by 24%</li>
                   <li>Zero SLA breaches for 90 days</li>
                 </ul>
              </div>
              <div className="border rounded-lg p-6 bg-orange-50 print:bg-transparent">
                 <h4 className="font-semibold text-orange-900 mb-2">Areas of Focus</h4>
                 <ul className="list-disc pl-5 text-sm space-y-2 text-orange-800">
                   <li>Content production velocity drops mid-month</li>
                   <li>Awaiting CMS credential fixes from client</li>
                 </ul>
              </div>
            </div>
          </TabsContent>

        </Tabs>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:block {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}
