import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lomidefcttfpruiqmvip.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your_anon_key'
// Actually I don't have the real env details here easily unless I grep from .env
