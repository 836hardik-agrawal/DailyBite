import type { Session } from '@supabase/supabase-js'

export type AuthContextValue = {
  session: Session | null
  signOut: () => Promise<void>
}