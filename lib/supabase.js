import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Agregamos estos dos logs para ver qué está pasando
console.log("URL leída:", supabaseUrl);
console.log("Key leída:", supabaseKey ? "Key encontrada" : "Key vacía");

export const supabase = createClient(supabaseUrl, supabaseKey)