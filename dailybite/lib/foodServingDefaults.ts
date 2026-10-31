export type CustomFoodServing = {
  label: string
  gramWeight: number
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export type FoodServingCategory = 'breakfast' | 'lunch' | 'dinner' | 'beverages' | 'junk-foods'

export type FoodServingDefault = {
  name?: string
  category?: FoodServingCategory
  preferredServingLabel?: string
  customServing?: CustomFoodServing
}
