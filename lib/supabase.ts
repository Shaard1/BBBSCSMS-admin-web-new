import { createClient } from "@supabase/supabase-js";

const fallbackSupabaseUrl = "https://placeholder.supabase.co";
const fallbackSupabaseAnonKey = "placeholder-anon-key";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fallbackSupabaseUrl;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fallbackSupabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
