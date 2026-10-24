export type USDAFoodResult = {
  id: string
  name: string
  dataType?: string
  category?: string
  brand?: string
  barcode?: string
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  nutrientsPer100g: boolean
  servingOptions: USDAFoodServingOption[]
  source: 'USDA'
}

export type USDAFoodServingOption = {
  id: string
  label: string
  gramWeight: number
}

export type USDAFoodNutrient = {
  nutrientId?: number
  nutrientName?: string
  value?: number
  unitName?: string
}

export type USDAFoodMeasure = {
  id?: number
  rank?: number
  disseminationText?: string
  gramWeight?: number
  measureUnitAbbreviation?: string
  measureUnit?: {
    abbreviation?: string
  }
  portionDescription?: string
}

export type USDAFood = {
  fdcId?: number
  description?: string
  dataType?: string
  brandOwner?: string
  brandName?: string
  foodCategory?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  gtinUpc?: string
  foodMeasures?: USDAFoodMeasure[]
  foodNutrients?: USDAFoodNutrient[]
}

export type USDAFoodSearchResponse = {
  foods?: USDAFood[]
}