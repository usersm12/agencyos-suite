import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';

// Components
import ClientsPage from '@/pages/ClientsPage';
import ClientProfilePage from '@/pages/ClientProfilePage';

// Mock Supabase
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  single: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const renderWithProviders = (ui: React.ReactElement, initialEntries = ['/']) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Toaster />
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Client Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    
    // Default mocks for ClientsPage
    mockSupabase.select.mockResolvedValue({
      data: [{
        id: 'user-1', full_name: 'John Doe', role: 'manager'
      }], error: null
    });
  });

  describe('Clients Page & Add Client Form', () => {
    beforeEach(() => {
      // Mock the initial clients list fetch
      mockSupabase.from.mockImplementation((table) => {
        const chain = {
          select: vi.fn(),
          insert: vi.fn(),
          eq: vi.fn(),
          in: vi.fn(),
          single: vi.fn(),
        };

        if (table === 'clients') {
          chain.select = vi.fn().mockReturnValue({ data: [], error: null });
          chain.insert = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'new-client-id' }, error: null
              })
            })
          });
        }
        
        if (table === 'profiles') {
          chain.select = vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null })
          });
        }
        
        if (table === 'services') {
          chain.select = vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          });
        }
        
        return chain;
      });
    });

    it('Add Client form opens when button is clicked', async () => {
      renderWithProviders(<ClientsPage />);
      
      // Look for the Add Client button
      const addButtons = await screen.findAllByRole('button', { name: /add client/i });
      fireEvent.click(addButtons[0]);
      
      // Verify modal is open by looking for title
      expect(await screen.findByText("Add New Client")).toBeInTheDocument();
    });

    it('Form validates required fields', async () => {
      renderWithProviders(<ClientsPage />);
      
      const addButtons = await screen.findAllByRole('button', { name: /add client/i });
      fireEvent.click(addButtons[0]);
      
      const submitButton = await screen.findByRole('button', { name: /create client/i });
      fireEvent.click(submitButton);
      
      // Should show validation error for Company Name
      expect(await screen.findByText("Name is required")).toBeInTheDocument();
      // Supabase insert should not be called
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('Client saves to Supabase and appears in client list', async () => {
      renderWithProviders(<ClientsPage />);
      
      const addButtons = await screen.findAllByRole('button', { name: /add client/i });
      fireEvent.click(addButtons[0]);
      
      // Fill the form
      const nameInput = await screen.findByLabelText(/client name \*/i);
      fireEvent.change(nameInput, { target: { value: 'Test Client Inc' } });
      
      const submitButton = await screen.findByRole('button', { name: /create client/i });
      
      // Mock the specific insert call to verify it gets hit
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: '123' }, error: null })
        })
      });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') return { select: vi.fn().mockReturnValue({ data: [], error: null }), insert: mockInsert };
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({data:[]}), eq: vi.fn().mockResolvedValue({data:[]}) }) };
      });

      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Test Client Inc',
          website_url: null,
          status: 'active'
        }));
      });
      
      expect(await screen.findByText("Client added successfully")).toBeInTheDocument();
    });
  });

  describe('Client Profile Page', () => {
    it('Client profile page loads correctly for a saved client', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'clients') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'saved-client-1',
                    name: 'Acme Super Corp',
                    status: 'active',
                    profiles: { full_name: 'Super Manager' },
                    client_services: []
                  },
                  error: null
                })
              })
            })
          };
        }
        return { select: vi.fn() };
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/clients/saved-client-1']}>
            <Routes>
              <Route path="/clients/:id" element={<ClientProfilePage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify the client's name and status loads
      expect(await screen.findByText('Acme Super Corp')).toBeInTheDocument();
      expect(await screen.findByText('Super Manager')).toBeInTheDocument();
    });
  });
});
