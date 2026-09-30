import { createContext, useContext, useEffect, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'

type AuthContextValue = {
  session: Session | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function useAuthState(): AuthContextValue {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => setSession(nextSession),
    )

    return () => subscription.subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { session, signOut }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const auth = useAuthState()

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext)

  if (!auth) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return auth
}