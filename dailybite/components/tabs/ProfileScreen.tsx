import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import { useAuth } from '../../hooks/useAuth'
import { getLocalDateString } from '../../lib/localDate'
import { supabase } from '../../lib/supabase'
import { appStyles } from '../../styles/app.styles'
import type { ProfileScreenProps } from './ProfileScreen.types'

type GoalField = 'calorie_target' | 'protein_target_g' | 'carbs_target_g' | 'fat_target_g' | 'fiber_target_g'
type GoalForm = Record<GoalField, string>

const emptyGoal: GoalForm = {
  calorie_target: '',
  protein_target_g: '0',
  carbs_target_g: '0',
  fat_target_g: '0',
  fiber_target_g: '0',
}

export function ProfileScreen({ onSignOut }: ProfileScreenProps) {
  const { session } = useAuth()
  const [goal, setGoal] = useState<GoalForm>(emptyGoal)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) {
      return
    }

    let isCurrent = true

    async function loadGoal() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const { data, error } = await supabase
          .from('nutrition_targets')
          .select('effective_from, calorie_target, protein_target_g, carbs_target_g, fat_target_g, fiber_target_g')
          .eq('user_id', userId)
          .lte('effective_from', getLocalDateString(new Date()))
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) {
          throw error
        }

        if (isCurrent) {
          setGoal(data ? {
            calorie_target: String(data.calorie_target),
            protein_target_g: String(data.protein_target_g),
            carbs_target_g: String(data.carbs_target_g),
            fat_target_g: String(data.fat_target_g),
            fiber_target_g: String(data.fiber_target_g),
          } : emptyGoal)
        }
      } catch (error) {
        if (isCurrent) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not load nutrition goals.')
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void loadGoal()

    return () => {
      isCurrent = false
    }
  }, [userId])

  function updateGoal(field: GoalField, value: string) {
    setGoal((currentGoal) => ({ ...currentGoal, [field]: value }))
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  async function handleSaveGoal() {
    if (!userId || isSaving) {
      return
    }

    const calories = Number(goal.calorie_target)
    const grams = [goal.protein_target_g, goal.carbs_target_g, goal.fat_target_g, goal.fiber_target_g]
      .map(Number)

    if (!Number.isInteger(calories) || calories < 1 || calories > 10000) {
      setErrorMessage('Calories must be a whole number from 1 to 10,000.')
      return
    }

    if (grams.some((value) => !Number.isFinite(value) || value < 0 || value > 9999999.9)) {
      setErrorMessage('Nutrient goals must be valid non-negative numbers.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const { error } = await supabase.from('nutrition_targets').upsert({
        user_id: userId,
        effective_from: getLocalDateString(new Date()),
        calorie_target: calories,
        protein_target_g: Math.round(grams[0] * 10) / 10,
        carbs_target_g: Math.round(grams[1] * 10) / 10,
        fat_target_g: Math.round(grams[2] * 10) / 10,
        fiber_target_g: Math.round(grams[3] * 10) / 10,
      }, { onConflict: 'user_id,effective_from' })

      if (error) {
        throw error
      }

      setSuccessMessage('Daily goals saved.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save nutrition goals.')
    } finally {
      setIsSaving(false)
    }
  }

  function renderGoalInput(field: GoalField, label: string, unit: string, decimal = true) {
    return (
      <View style={appStyles.profileGoalRow} key={field}>
        <Text style={appStyles.profileGoalLabel}>{label}</Text>
        <View style={appStyles.profileGoalInputGroup}>
          <TextInput
            accessibilityLabel={`${label} daily goal in ${unit}`}
            editable={!isLoading && !isSaving}
            keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
            maxLength={decimal ? 10 : 5}
            onChangeText={(value) => updateGoal(field, value)}
            style={appStyles.profileGoalInput}
            value={goal[field]}
          />
          <Text style={appStyles.profileGoalUnit}>{unit}</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={appStyles.profileScreen} keyboardShouldPersistTaps="handled">
      <Text style={appStyles.eyebrow}>DAILYBITE</Text>
      <Text style={appStyles.title}>Profile</Text>

      <View style={appStyles.profileGoalSection}>
        <Text style={appStyles.profileGoalTitle}>Daily nutrition goals</Text>
        <Text style={appStyles.profileGoalDescription}>
          Changes apply today. Earlier dates keep their previous goals.
        </Text>

        {isLoading ? (
          <View style={appStyles.profileGoalLoading}>
            <ActivityIndicator color="#277C65" />
            <Text style={appStyles.profileGoalDescription}>Loading saved goals...</Text>
          </View>
        ) : (
          <View style={appStyles.profileGoalFields}>
            {renderGoalInput('calorie_target', 'Calories', 'kcal', false)}
            {renderGoalInput('protein_target_g', 'Protein', 'g')}
            {renderGoalInput('carbs_target_g', 'Carbohydrates', 'g')}
            {renderGoalInput('fat_target_g', 'Fat', 'g')}
            {renderGoalInput('fiber_target_g', 'Fiber', 'g')}
          </View>
        )}

        {errorMessage ? <Text style={appStyles.profileGoalError}>{errorMessage}</Text> : null}
        {successMessage ? <Text style={appStyles.profileGoalSuccess}>{successMessage}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoading || isSaving }}
          disabled={isLoading || isSaving}
          onPress={() => void handleSaveGoal()}
          style={[appStyles.profileGoalSaveButton, (isLoading || isSaving) && appStyles.profileGoalSaveButtonDisabled]}
        >
          <Text style={appStyles.profileGoalSaveButtonText}>{isSaving ? 'Saving...' : 'Save daily goals'}</Text>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={() => void onSignOut()}>
        <Text style={appStyles.action}>Sign out</Text>
      </Pressable>
    </ScrollView>
  )
}