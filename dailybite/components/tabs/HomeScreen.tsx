import { useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { ActivityIndicator, Text, View } from 'react-native'

import { useAuth } from '../../hooks/useAuth'
import { getLocalDateString } from '../../lib/localDate'
import { supabase } from '../../lib/supabase'
import { appStyles } from '../../styles/app.styles'
import type { HomeFoodEntry } from './HomeScreen.types'

function numericValue(value: number | string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getGreeting(hour: number): string {
  if (hour < 12 && hour >= 5) {
    return 'Good morning'
  }
  if (hour < 17 && hour >= 12) {
    return 'Good afternoon'
  }
  return 'Good evening'
}

export function HomeScreen() {
  const { session } = useAuth()
  const [calories, setCalories] = useState(0)
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const userId = session?.user.id
  const now = new Date()
  const greeting = getGreeting(now.getHours())
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        setCalories(0)
        setCalorieGoal(null)
        setIsLoading(false)
        return
      }

      let isCurrent = true

      async function loadDailySummary() {
        setIsLoading(true)
        setErrorMessage(null)

        try {
          const startOfDay = new Date()
          startOfDay.setHours(0, 0, 0, 0)
          const startOfNextDay = new Date(startOfDay)
          startOfNextDay.setDate(startOfNextDay.getDate() + 1)

          const [
            { data: entryData, error: entryError },
            { data: goalData, error: goalError },
          ] = await Promise.all([
            supabase
              .from('food_entries')
              .select(`
                servings,
                foods!inner (
                  calories_per_serving
                )
              `)
              .eq('user_id', userId)
              .gte('consumed_at', startOfDay.toISOString())
              .lt('consumed_at', startOfNextDay.toISOString()),
            supabase
              .from('nutrition_targets')
              .select('calorie_target')
              .eq('user_id', userId)
              .lte('effective_from', getLocalDateString(startOfDay))
              .order('effective_from', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ])

          if (entryError) {
            throw entryError
          }
          if (goalError) {
            throw goalError
          }

          const totalCalories = ((entryData ?? []) as unknown as HomeFoodEntry[])
            .reduce((total, entry) => (
              total + numericValue(entry.foods.calories_per_serving) * numericValue(entry.servings)
            ), 0)

          if (isCurrent) {
            setCalories(totalCalories)
            setCalorieGoal(goalData ? numericValue(goalData.calorie_target) : null)
          }
        } catch (error) {
          console.error('[Home] Daily summary load failed', error)
          if (isCurrent) {
            setCalories(0)
            setCalorieGoal(null)
            setErrorMessage(
              error instanceof Error ? error.message : 'Could not load today’s calorie summary.',
            )
          }
        } finally {
          if (isCurrent) {
            setIsLoading(false)
          }
        }
      }

      void loadDailySummary()

      return () => {
        isCurrent = false
      }
    }, [userId]),
  )

  const progress = calorieGoal ? Math.min(calories / calorieGoal, 1) : 0
  const caloriesRemaining = calorieGoal ? Math.round(calorieGoal - calories) : null

  return (
    <View style={appStyles.homeScreen}>
      <Text style={appStyles.eyebrow}>DAILYBITE</Text>
      <Text style={appStyles.title}>{greeting}!</Text>
      <Text style={appStyles.homeDate}>{dateLabel}</Text>

      <View style={appStyles.homeCalorieCard}>
        <Text style={appStyles.homeCardEyebrow}>TODAY’S CALORIES</Text>
        {isLoading ? (
          <View style={appStyles.homeLoading}>
            <ActivityIndicator color="#277C65" />
            <Text style={appStyles.homeSupportingText}>Updating your day...</Text>
          </View>
        ) : errorMessage ? (
          <Text style={appStyles.homeError}>{errorMessage}</Text>
        ) : (
          <>
            <View style={appStyles.homeCalorieNumbers}>
              <Text style={appStyles.homeCalories}>{Math.round(calories).toLocaleString()}</Text>
              <Text style={appStyles.homeGoal}>
                {calorieGoal ? ` / ${calorieGoal.toLocaleString()} kcal` : ' kcal logged'}
              </Text>
            </View>

            {calorieGoal ? (
              <>
                <View
                  accessibilityLabel={`${Math.round(calories)} of ${calorieGoal} calories`}
                  accessibilityRole="progressbar"
                  accessibilityValue={{
                    min: 0,
                    max: calorieGoal,
                    now: Math.min(calories, calorieGoal),
                  }}
                  style={appStyles.homeProgressTrack}
                >
                  <View style={[appStyles.homeProgressFill, { width: `${progress * 100}%` }]} />
                </View>
                <Text style={appStyles.homeSupportingText}>
                  {caloriesRemaining !== null && caloriesRemaining >= 0
                    ? `${caloriesRemaining.toLocaleString()} kcal to your daily goal`
                    : `${Math.abs(caloriesRemaining ?? 0).toLocaleString()} kcal above today’s goal`}
                </Text>
              </>
            ) : (
              <Text style={appStyles.homeSupportingText}>
                Set a daily calorie goal in Profile to see your progress here.
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  )
}
