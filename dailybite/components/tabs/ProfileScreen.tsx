import { Text, View } from 'react-native'

import { appStyles } from '../../styles/app.styles'
import type { ProfileScreenProps } from './ProfileScreen.types'

export function ProfileScreen({ onSignOut }: ProfileScreenProps) {
  return (
    <View style={appStyles.screen}>
      <Text style={appStyles.eyebrow}>DAILYBITE</Text>
      <Text style={appStyles.title}>Profile</Text>
      <Text style={appStyles.body}>Manage your account and nutrition preferences here.</Text>
      <Text accessibilityRole="button" onPress={onSignOut} style={appStyles.action}>
        Sign out
      </Text>
    </View>
  )
}