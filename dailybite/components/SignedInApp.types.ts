export type AppTabParamList = {
  Home: undefined
  'Add Food': undefined
  'Daily Log': undefined
  Reports: undefined
  Profile: undefined
}

export type SignedInAppProps = {
  onSignOut: () => Promise<void>
}