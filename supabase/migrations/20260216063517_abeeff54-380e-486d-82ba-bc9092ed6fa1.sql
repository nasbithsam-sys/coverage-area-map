
-- Add priority column to technicians
ALTER TABLE public.technicians ADD COLUMN priority text NOT NULL DEFAULT 'normal';

-- Add delete policy for CSR
CREATE POLICY "CSR can delete technicians"
ON public.technicians
FOR DELETE
USING (has_role(auth.uid(), 'csr'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
