
const { createClient } = window.supabase;

const SUPABASE_URL = "https://xbsmfqmlmiqyjvxubjjk.supabase.co";
const SUPABASE_KEY = "sb_publishable_UcFBDtW4-w_Oyk25kjVCWA_erfSKBTC";

const yatraSupabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

console.log("YatraGen connected to Supabase!");
