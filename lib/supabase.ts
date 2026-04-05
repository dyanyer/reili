import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://lhrnxanpakrlaxbjpdip.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxocm54YW5wYWtybGF4YmpwZGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NzczMDgsImV4cCI6MjA5MDM1MzMwOH0.M9Syp4aIanAuk2Qb5L_Lw6WDumamzP_ThzHSd68gWQ0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
