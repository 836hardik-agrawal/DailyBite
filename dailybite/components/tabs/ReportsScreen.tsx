import { Text, View } from 'react-native'

import { appStyles } from '../../styles/app.styles'

export function ReportsScreen() {
  return (
    <View style={appStyles.screen}>
      <Text style={appStyles.eyebrow}>DAILYBITE</Text>
      <Text style={appStyles.title}>Reports</Text>
      <Text style={appStyles.body}>Your weekly nutrition trends will appear here.</Text>
    </View>
  )
}