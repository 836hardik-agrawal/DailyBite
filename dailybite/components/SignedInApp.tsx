import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View } from 'react-native'

import { appStyles } from '../styles/app.styles'

type AppTabParamList = {
  Home: undefined
  'Add Food': undefined
  Reports: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<AppTabParamList>()

type SignedInAppProps = {
  onSignOut: () => Promise<void>
}

function TabContent({ title, description }: { title: string; description: string }) {
  return (
    <View style={appStyles.screen}>
      <Text style={appStyles.eyebrow}>DAILYBITE</Text>
      <Text style={appStyles.title}>{title}</Text>
      <Text style={appStyles.body}>{description}</Text>
    </View>
  )
}

function HomeScreen() {
  return <TabContent description="Your daily calorie summary will appear here." title="Today" />
}

function AddFoodScreen() {
  return <TabContent description="Food search and entry logging are coming next." title="Add food" />
}

function ReportsScreen() {
  return <TabContent description="Your weekly nutrition trends will appear here." title="Reports" />
}

function ProfileScreen({ onSignOut }: SignedInAppProps) {
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

export function SignedInApp({ onSignOut }: SignedInAppProps) {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#277C65',
          tabBarInactiveTintColor: '#6E7B82',
          tabBarLabelStyle: appStyles.tabBarLabel,
        }}
      >
        <Tab.Screen component={HomeScreen} name="Home" />
        <Tab.Screen component={AddFoodScreen} name="Add Food" />
        <Tab.Screen component={ReportsScreen} name="Reports" />
        <Tab.Screen name="Profile">
          {() => <ProfileScreen onSignOut={onSignOut} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  )
}