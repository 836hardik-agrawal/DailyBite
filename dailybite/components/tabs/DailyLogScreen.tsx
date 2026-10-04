import { useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'

import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { appStyles } from '../../styles/app.styles'
import type { DailyTotals, FoodLogEntry } from './DailyLogScreen.types'

const emptyTotals: DailyTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
}

function numericValue(value: number | string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatGrams(value: number): string {
  return `${Number(value.toFixed(1))} g`
}

function formatServings(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

function shiftDate(date: Date, days: number): Date {
  const shiftedDate = new Date(date)
  shiftedDate.setDate(shiftedDate.getDate() + days)
  return shiftedDate
}

export function DailyLogScreen() {
  const { session } = useAuth()
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [entries, setEntries] = useState<FoodLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const userId = session?.user.id

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        setEntries([])
        return
      }

      let isCurrent = true
      const startOfDay = new Date(selectedDate)
      startOfDay.setHours(0, 0, 0, 0)
      const startOfNextDay = new Date(startOfDay)
      startOfNextDay.setDate(startOfNextDay.getDate() + 1)

      async function loadEntries() {
        setIsLoading(true)
        setErrorMessage(null)

        try {
          const { data, error } = await supabase
            .from('food_entries')
            .select(`
              id,
              servings,
              meal_type,
              consumed_at,
              foods!inner (
                name,
                brand_name,
                serving_description,
                calories_per_serving,
                protein_per_serving_g,
                carbs_per_serving_g,
                fat_per_serving_g,
                fiber_per_serving_g
              )
            `)
            .eq('user_id', userId)
            .gte('consumed_at', startOfDay.toISOString())
            .lt('consumed_at', startOfNextDay.toISOString())
            .order('consumed_at', { ascending: true })

          if (error) {
            throw error
          }

          if (isCurrent) {
            setEntries((data ?? []) as unknown as FoodLogEntry[])
          }
        } catch (error) {
          console.error('[DailyLog] Load failed', error)
          if (isCurrent) {
            setEntries([])
            setErrorMessage(
              error instanceof Error ? error.message : 'Could not load this day’s food log.',
            )
          }
        } finally {
          if (isCurrent) {
            setIsLoading(false)
          }
        }
      }

      void loadEntries()

      return () => {
        isCurrent = false
      }
    }, [selectedDate, userId]),
  )

  const totals = entries.reduce<DailyTotals>((dayTotals, entry) => {
    const servings = numericValue(entry.servings)
    dayTotals.calories += numericValue(entry.foods.calories_per_serving) * servings
    dayTotals.protein += numericValue(entry.foods.protein_per_serving_g) * servings
    dayTotals.carbs += numericValue(entry.foods.carbs_per_serving_g) * servings
    dayTotals.fat += numericValue(entry.foods.fat_per_serving_g) * servings
    dayTotals.fiber += numericValue(entry.foods.fiber_per_serving_g) * servings
    return dayTotals
  }, { ...emptyTotals })

  async function handleDeleteEntry(entryId: string) {
    if (!userId || deletingEntryId) {
      return
    }

    setDeletingEntryId(entryId)
    setErrorMessage(null)

    try {
      const { error } = await supabase
        .from('food_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', userId)

      if (error) {
        throw error
      }

      setEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== entryId))
    } catch (error) {
      console.error('[DailyLog] Delete failed', error)
      setErrorMessage(error instanceof Error ? error.message : 'Could not delete this food entry.')
    } finally {
      setDeletingEntryId(null)
    }
  }

  const isToday = selectedDate.toDateString() === new Date().toDateString()
  const dateLabel = selectedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <View style={appStyles.dailyLogScreen}>
      <Text style={appStyles.eyebrow}>DAILYBITE</Text>
      <Text style={appStyles.dailyLogTitle}>Daily log</Text>

      <View style={appStyles.dailyLogDateNavigation}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectedDate((date) => shiftDate(date, -1))}
          style={appStyles.dailyLogDateButton}
        >
          <Text style={appStyles.dailyLogDateButtonText}>Previous</Text>
        </Pressable>
        <Text style={appStyles.dailyLogDateText}>{isToday ? 'Today' : dateLabel}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isToday }}
          disabled={isToday}
          onPress={() => setSelectedDate((date) => shiftDate(date, 1))}
          style={[appStyles.dailyLogDateButton, isToday && appStyles.dailyLogDateButtonDisabled]}
        >
          <Text style={appStyles.dailyLogDateButtonText}>Next</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={appStyles.addFoodStatusRow}>
          <ActivityIndicator color="#277C65" />
          <Text style={appStyles.addFoodStatusText}>Loading food log...</Text>
        </View>
      ) : null}
      {errorMessage ? <Text style={appStyles.addFoodErrorText}>{errorMessage}</Text> : null}

      <FlatList
        contentContainerStyle={appStyles.dailyLogListContent}
        data={entries}
        keyExtractor={(entry) => entry.id}
        ListEmptyComponent={
          !isLoading && !errorMessage ? (
            <Text style={appStyles.addFoodEmptyText}>No food logged for this day.</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const servings = numericValue(item.servings)
          const calories = Math.round(numericValue(item.foods.calories_per_serving) * servings)
          const mealName = item.meal_type.charAt(0).toUpperCase() + item.meal_type.slice(1)
          const time = new Date(item.consumed_at).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })

          return (
            <View style={appStyles.dailyLogFoodRow}>
              <View style={appStyles.dailyLogFoodTopRow}>
                <View style={appStyles.dailyLogFoodDetails}>
                  <Text style={appStyles.addFoodFoodName}>{item.foods.name}</Text>
                  {item.foods.brand_name ? (
                    <Text style={appStyles.addFoodFoodMeta}>{item.foods.brand_name}</Text>
                  ) : null}
                  <Text style={appStyles.addFoodFoodMeta}>
                    {formatServings(servings)} × {item.foods.serving_description}
                  </Text>
                  <Text style={appStyles.dailyLogFoodTime}>{mealName} · {time}</Text>
                </View>
                <Text style={appStyles.dailyLogFoodCalories}>{calories} kcal</Text>
              </View>
              <Text style={appStyles.dailyLogFoodNutrition}>
                Protein {formatGrams(numericValue(item.foods.protein_per_serving_g) * servings)} · Carbs{' '}
                {formatGrams(numericValue(item.foods.carbs_per_serving_g) * servings)} · Fat{' '}
                {formatGrams(numericValue(item.foods.fat_per_serving_g) * servings)} · Fiber{' '}
                {formatGrams(numericValue(item.foods.fiber_per_serving_g) * servings)}
              </Text>
              <View style={appStyles.dailyLogFoodActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: deletingEntryId !== null }}
                  disabled={deletingEntryId !== null}
                  onPress={() => void handleDeleteEntry(item.id)}
                  style={appStyles.dailyLogDeleteButton}
                >
                  <Text style={appStyles.dailyLogDeleteButtonText}>
                    {deletingEntryId === item.id ? 'Deleting...' : 'Delete'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )
        }}
      />

      <View style={appStyles.dailyLogSummary}>
        <Text style={appStyles.dailyLogSummaryTitle}>Daily intake</Text>
        <View style={appStyles.dailyLogSummaryGrid}>
          <View style={appStyles.dailyLogSummaryItem}>
            <Text style={appStyles.dailyLogSummaryValue}>{Math.round(totals.calories)}</Text>
            <Text style={appStyles.dailyLogSummaryLabel}>kcal</Text>
          </View>
          <View style={appStyles.dailyLogSummaryItem}>
            <Text style={appStyles.dailyLogSummaryValue}>{Number(totals.protein.toFixed(1))} g</Text>
            <Text style={appStyles.dailyLogSummaryLabel}>Protein</Text>
          </View>
          <View style={appStyles.dailyLogSummaryItem}>
            <Text style={appStyles.dailyLogSummaryValue}>{Number(totals.carbs.toFixed(1))} g</Text>
            <Text style={appStyles.dailyLogSummaryLabel}>Carbs</Text>
          </View>
          <View style={appStyles.dailyLogSummaryItem}>
            <Text style={appStyles.dailyLogSummaryValue}>{Number(totals.fat.toFixed(1))} g</Text>
            <Text style={appStyles.dailyLogSummaryLabel}>Fat</Text>
          </View>
          <View style={appStyles.dailyLogSummaryItem}>
            <Text style={appStyles.dailyLogSummaryValue}>{Number(totals.fiber.toFixed(1))} g</Text>
            <Text style={appStyles.dailyLogSummaryLabel}>Fiber</Text>
          </View>
        </View>
      </View>
    </View>
  )
}