import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

import { AddFoodScreen } from './tabs/AddFoodScreen'
import { DailyLogScreen } from './tabs/DailyLogScreen'
import { HomeScreen } from './tabs/HomeScreen'
import { ProfileScreen } from './tabs/ProfileScreen'
import { ReportsScreen } from './tabs/ReportsScreen'
import { appStyles } from '../styles/app.styles'
import type { AppTabParamList, SignedInAppProps } from './SignedInApp.types'

const Tab = createBottomTabNavigator<AppTabParamList>()

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
        <Tab.Screen component={DailyLogScreen} name="Daily Log" />
        <Tab.Screen component={ReportsScreen} name="Reports" />
        <Tab.Screen name="Profile">
          {() => <ProfileScreen onSignOut={onSignOut} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  )
}