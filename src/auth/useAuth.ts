import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export const AuthContext = createContext<{ session: Session | null; ready: boolean; error: string; recovery: boolean }>({
  session: null, ready: false, error: '', recovery: false,
});
export const useAuth = () => useContext(AuthContext);
