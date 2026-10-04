export type FoodLogFood = {
  name: string
  brand_name: string | null
  serving_description: string
  calories_per_serving: number | string
  protein_per_serving_g: number | string
  carbs_per_serving_g: number | string
  fat_per_serving_g: number | string
  fiber_per_serving_g: number | string
}

export type FoodLogEntry = {
  id: string
  servings: number | string
  meal_type: string
  consumed_at: string
  foods: FoodLogFood
}

export type DailyTotals = {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}