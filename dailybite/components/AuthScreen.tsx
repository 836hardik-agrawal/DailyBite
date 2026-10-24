import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'

import { supabase } from '../lib/supabase'
import { authStyles } from '../styles/auth.styles'
import type { AuthScreenMode } from './AuthScreen.types'

export function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<AuthScreenMode>('signUp')
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSignUp = mode === 'signUp'

  async function submit() {
    setMessage(null)

    if (!email.trim() || !password) {
      setMessage('Enter your email address and password.')
      return
    }

    setIsSubmitting(true)
    const normalizedEmail = email.trim().toLowerCase()
    const result = isSignUp
      ? await supabase.auth.signUp({ email: normalizedEmail, password })
      : await supabase.auth.signInWithPassword({ email: normalizedEmail, password })

    setIsSubmitting(false)

    if (result.error) {
      if (
        result.error.code === 'email_exists' ||
        result.error.code === 'user_already_exists' ||
        result.error.message.toLowerCase().includes('already registered')
      ) {
        setMessage('An account already exists for this email. Please sign in.')
        setMode('signIn')
        return
      }

      setMessage(result.error.message)
      return
    }

    if (isSignUp && result.data.user?.identities?.length === 0) {
      setMessage('An account already exists for this email. Please sign in.')
      setMode('signIn')
      return
    }

    if (isSignUp && !result.data.session) {
      setMessage('Account created. Check your email to confirm it, then sign in.')
      setMode('signIn')
    }
  }

  function switchMode() {
    setMessage(null)
    setMode(isSignUp ? 'signIn' : 'signUp')
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={authStyles.keyboardAvoidingView}
    >
      <ScrollView
        contentContainerStyle={authStyles.content}
        keyboardShouldPersistTaps="handled"
        style={authStyles.scrollView}
      >
        <Text style={authStyles.eyebrow}>DAILYBITE</Text>
        <Text style={authStyles.title}>{isSignUp ? 'Start tracking simply.' : 'Welcome back.'}</Text>
        <Text style={authStyles.body}>
          {isSignUp ? 'Create an account to save your daily food log.' : 'Sign in to continue your food log.'}
        </Text>

        <View style={authStyles.form}>
          <Text style={authStyles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#6E7B82"
            style={authStyles.input}
            value={email}
          />

          <Text style={authStyles.label}>Password</Text>
          <TextInput
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor="#6E7B82"
            secureTextEntry
            style={authStyles.input}
            value={password}
          />

          {message ? <Text style={authStyles.message}>{message}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={submit}
            style={[authStyles.primaryButton, isSubmitting && authStyles.disabledButton]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={authStyles.primaryButtonText}>{isSignUp ? 'Create account' : 'Sign in'}</Text>
            )}
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" onPress={switchMode} style={authStyles.modeButton}>
          <Text style={authStyles.modeButtonText}>
            {isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
