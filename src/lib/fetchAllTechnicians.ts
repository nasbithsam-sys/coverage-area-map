import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Fetches ALL technicians by paginating through Supabase's 1000-row limit.
 * Uses range-based pagination to bypass PostgREST max-rows.
 */
export async function fetchAllTechnicians(): Promise<Tables<"technicians">[]> {
  const PAGE = 1000;
  let all: Tables<"technicians">[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("technicians")
      .select("*")
      .order("name")
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("Error fetching technicians:", error.message);
      break;
    }

    if (!data || data.length === 0) break;

    all = all.concat(data);

    if (data.length < PAGE) break; // last page
    from += PAGE;
  }

  return all;
}
