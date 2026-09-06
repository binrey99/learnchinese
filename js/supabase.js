import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// These values mirror the public VITE_* values in .env for the static HTML app.
const SUPABASE_URL = 'https://zrqeokfgspkcxhseemqi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BsZFpACz7bXTOEvv-4-nLQ_bmd9waEN';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
