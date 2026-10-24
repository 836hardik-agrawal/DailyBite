import { useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'

import { useAuth } from '../../hooks/useAuth'
import { getLocalDateString } from '../../lib/localDate'
import { supabase } from '../../lib/supabase'
import { appStyles } from '../../styles/app.styles'
import type { WeeklyDay, WeeklyFoodEntry } from './ReportsScreen.types'

function numericValue(value: number | string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getWeekDates(today: Date): Date[] {
  const monday = new Date(today)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return date
  })
}

function getWeekRangeLabel(days: WeeklyDay[]): string {
  if (days.length === 0) {
    return ''
  }

  const first = days[0].date
  const last = days[days.length - 1].date
  const firstLabel = first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const lastLabel = last.toLocaleDateString(undefined, {
    month: first.getMonth() === last.getMonth() ? undefined : 'short',
    day: 'numeric',
    year: first.getFullYear() === last.getFullYear() ? undefined : 'numeric',
  })

  return `${firstLabel} – ${lastLabel}`
}

export function ReportsScreen() {
  const { session } = useAuth()
  const [days, setDays] = useState<WeeklyDay[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const userId = session?.user.id

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        setDays([])
        setIsLoading(false)
        return
      }

      let isCurrent = true

      async function loadWeek() {
        setIsLoading(true)
        setErrorMessage(null)

        try {
          const weekDates = getWeekDates(new Date())
          const weekStart = weekDates[0]
          const weekEnd = new Date(weekDates[6])
          weekEnd.setDate(weekEnd.getDate() + 1)
          const weekStartKey = getLocalDateString(weekStart)
          const weekEndKey = getLocalDateString(weekDates[6])

          const [
            { data: entryData, error: entryError },
            { data: priorGoal, error: priorGoalError },
            { data: weekGoals, error: weekGoalsError },
          ] = await Promise.all([
            supabase
              .from('food_entries')
              .select(`
                consumed_at,
                servings,
                foods!inner (
                  calories_per_serving,
                  protein_per_serving_g,
                  carbs_per_serving_g,
                  fat_per_serving_g
                )
              `)
              .eq('user_id', userId)
              .gte('consumed_at', weekStart.toISOString())
              .lt('consumed_at', weekEnd.toISOString()),
            supabase
              .from('nutrition_targets')
              .select('effective_from, calorie_target')
              .eq('user_id', userId)
              .lt('effective_from', weekStartKey)
              .order('effective_from', { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from('nutrition_targets')
              .select('effective_from, calorie_target')
              .eq('user_id', userId)
              .gte('effective_from', weekStartKey)
              .lte('effective_from', weekEndKey)
              .order('effective_from', { ascending: true }),
          ])

          if (entryError) {
            throw entryError
          }
          if (priorGoalError) {
            throw priorGoalError
          }
          if (weekGoalsError) {
            throw weekGoalsError
          }

          const goals = [...(priorGoal ? [priorGoal] : []), ...(weekGoals ?? [])]
          const weeklyDays: WeeklyDay[] = weekDates.map((date) => {
            const dateKey = getLocalDateString(date)
            let calorieTarget: number | null = null

            for (const goal of goals) {
              if (goal.effective_from > dateKey) {
                break
              }
              calorieTarget = numericValue(goal.calorie_target)
            }

            return {
              date,
              dateKey,
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              calorieTarget,
              logged: false,
            }
          })
          const daysByKey = new Map(weeklyDays.map((day) => [day.dateKey, day]))

          for (const entry of (entryData ?? []) as unknown as WeeklyFoodEntry[]) {
            const day = daysByKey.get(getLocalDateString(new Date(entry.consumed_at)))
            if (!day) {
              continue
            }

            const servings = numericValue(entry.servings)
            day.logged = true
            day.calories += numericValue(entry.foods.calories_per_serving) * servings
            day.protein += numericValue(entry.foods.protein_per_serving_g) * servings
            day.carbs += numericValue(entry.foods.carbs_per_serving_g) * servings
            day.fat += numericValue(entry.foods.fat_per_serving_g) * servings
          }

          if (isCurrent) {
            setDays(weeklyDays)
          }
        } catch (error) {
          console.error('[Reports] Weekly summary load failed', error)
          if (isCurrent) {
            setDays([])
            setErrorMessage(error instanceof Error ? error.message : 'Could not load this week’s summary.')
          }
        } finally {
          if (isCurrent) {
            setIsLoading(false)
          }
        }
      }

      void loadWeek()

      return () => {
        isCurrent = false
      }
    }, [userId]),
  )

  const loggedDays = days.filter((day) => day.logged)
  const comparisonDays = loggedDays.filter((day) => day.calorieTarget !== null)
  const hasWeeklyGoal = days.some((day) => day.calorieTarget !== null)
  const calorieDifference = comparisonDays.reduce(
    (difference, day) => difference + day.calories - (day.calorieTarget ?? 0),
    0,
  )
  const average = (metric: 'protein' | 'carbs' | 'fat') => (
    loggedDays.length > 0
      ? loggedDays.reduce((total, day) => total + day[metric], 0) / loggedDays.length
      : 0
  )
  const maximumCalories = Math.max(1, ...days.map((day) => day.calories))
  const weekRange = getWeekRangeLabel(days)
  const differenceAmount = Math.round(Math.abs(calorieDifference)).toLocaleString()
  const differenceLabel = calorieDifference > 0 ? 'above' : 'below'
  const isCloseToTarget = comparisonDays.length > 0 && Math.abs(calorieDifference) < 100

  let weeklyMessage = hasWeeklyGoal
    ? 'Your goal is ready. Log a few meals to see how your week compares.'
    : 'Add a daily calorie goal to see how your week compares.'
  let weeklyEncouragement = 'Every meal logged is a little act of care. Keep going at your own pace.'

  if (comparisonDays.length > 0 && !isCloseToTarget) {
    weeklyMessage = `You were about ${differenceAmount} kcal ${differenceLabel} your goal across ${comparisonDays.length} logged ${comparisonDays.length === 1 ? 'day' : 'days'}.`
    weeklyEncouragement = calorieDifference > 0
      ? 'No need to make up for anything. A gentle walk, a happy little run, or a cozy rest—choose what feels good.'
      : 'Your week is just a snapshot, not a score. Keep nourishing yourself, and choose a gentle walk or rest if that feels right.'
  } else if (isCloseToTarget) {
    weeklyMessage = 'You were right around your calorie goal on the days you tracked.'
    weeklyEncouragement = 'Lovely steady tracking. Keep your rhythm, and make room for movement or rest—whatever feels kind today.'
  } else if (loggedDays.length > 0) {
    weeklyMessage = 'You logged meals this week, but there is no calorie goal to compare yet.'
  }

  return (
    <ScrollView
      contentContainerStyle={appStyles.reportsScreen}
      showsVerticalScrollIndicator={false}
    >
      <Text style={appStyles.eyebrow}>DAILYBITE · YOUR WEEK</Text>
      <Text style={appStyles.title}>A little progress, every day.</Text>
      <Text style={appStyles.reportsDate}>{weekRange}</Text>

      {isLoading ? (
        <View style={appStyles.reportsLoading}>
          <ActivityIndicator color="#277C65" />
          <Text style={appStyles.reportsMutedText}>Gathering your week...</Text>
        </View>
      ) : null}
      {errorMessage ? <Text style={appStyles.reportsError}>{errorMessage}</Text> : null}

      {!isLoading && !errorMessage ? (
        <>
          <View style={appStyles.reportsMessageCard}>
            <Text style={appStyles.reportsMessageEyebrow}>YOUR WEEKLY CHECK-IN</Text>
            <Text style={appStyles.reportsMessage}>{weeklyMessage}</Text>
            <Text style={appStyles.reportsEncouragement}>{weeklyEncouragement}</Text>
          </View>

          <View style={appStyles.reportsCard}>
            <View style={appStyles.reportsSectionHeader}>
              <Text style={appStyles.reportsSectionTitle}>Calories by day</Text>
              <Text style={appStyles.reportsSectionCaption}>
                {loggedDays.length} of 7 days logged
              </Text>
            </View>
            <View style={appStyles.reportsChart}>
              {days.map((day) => {
                const barHeight = day.logged
                  ? Math.max(6, (day.calories / maximumCalories) * 88)
                  : 3

                return (
                  <View key={day.dateKey} style={appStyles.reportsChartDay}>
                    <Text style={appStyles.reportsChartValue}>
                      {day.logged ? Math.round(day.calories).toLocaleString() : ''}
                    </Text>
                    <View style={appStyles.reportsChartBarArea}>
                      <View
                        style={[
                          day.logged ? appStyles.reportsChartBar : appStyles.reportsChartEmptyBar,
                          { height: barHeight },
                        ]}
                      />
                    </View>
                    <Text style={appStyles.reportsChartLabel}>
                      {day.date.toLocaleDateString(undefined, { weekday: 'short' })}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>

          <View style={appStyles.reportsCard}>
            <Text style={appStyles.reportsSectionTitle}>Your daily macro average</Text>
            <Text style={appStyles.reportsSectionCaption}>
              On {loggedDays.length} logged {loggedDays.length === 1 ? 'day' : 'days'}
            </Text>
            <View style={appStyles.reportsMacroRow}>
              {[
                { label: 'Protein', value: average('protein') },
                { label: 'Carbs', value: average('carbs') },
                { label: 'Fat', value: average('fat') },
              ].map((macro) => (
                <View key={macro.label} style={appStyles.reportsMacroItem}>
                  <Text style={appStyles.reportsMacroValue}>{macro.value.toFixed(1)} g</Text>
                  <Text style={appStyles.reportsMacroLabel}>{macro.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : null}
    </ScrollView>
  )
}
