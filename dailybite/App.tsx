import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

import { AuthScreen } from './components/AuthScreen'
import { SignedInApp } from './components/SignedInApp'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { authStyles } from './styles/auth.styles'

function AppContent() {
  const { session, signOut } = useAuth()

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'bottom']} style={authStyles.safeArea}>
        <StatusBar style="dark" />
        {session ? <SignedInApp onSignOut={signOut} /> : <AuthScreen />}
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
