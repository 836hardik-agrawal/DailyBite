import { Text, View } from 'react-native'

import { appStyles } from '../../styles/app.styles'

export function HomeScreen() {
  return (
    <View style={appStyles.screen}>
      <Text style={appStyles.eyebrow}>DAILYBITE</Text>
      <Text style={appStyles.title}>Today</Text>
      <Text style={appStyles.body}>Your daily calorie summary will appear here.</Text>
    </View>
  )
}