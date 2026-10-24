export type WeeklyFoodEntry = {
  consumed_at: string
  servings: number | string
  foods: {
    calories_per_serving: number | string
    protein_per_serving_g: number | string
    carbs_per_serving_g: number | string
    fat_per_serving_g: number | string
  }
}

export type WeeklyDay = {
  date: Date
  dateKey: string
  calories: number
  protein: number
  carbs: number
  fat: number
  calorieTarget: number | null
  logged: boolean
}
