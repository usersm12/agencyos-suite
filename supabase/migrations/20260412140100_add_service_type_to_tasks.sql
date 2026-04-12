-- Migration: Add service_type to tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS service_type TEXT;
