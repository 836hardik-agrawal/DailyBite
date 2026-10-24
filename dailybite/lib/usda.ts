import type {
  USDAFood,
  USDAFoodResult,
  USDAFoodSearchResponse,
  USDAFoodServingOption,
} from './usda.types'

export type { USDAFoodResult } from './usda.types'

function getNutrientValue(food: USDAFood, nutrientId: number): number | null {
  const value = food.foodNutrients?.find((nutrient) => nutrient.nutrientId === nutrientId)?.value

  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function toGrams(size: number | undefined, unit: string | undefined): number | undefined {
  if (size == null || size <= 0 || !unit) {
    return undefined
  }

  switch (unit.trim().toLowerCase()) {
    case 'g':
    case 'grm':
    case 'gram':
    case 'grams':
      return size
    case 'kg':
      return size * 1000
    case 'mg':
      return size / 1000
    case 'oz':
      return size * 28.3495
    default:
      return undefined
  }
}

function getServingOptions(food: USDAFood): USDAFoodServingOption[] {
  if (food.dataType === 'Survey (FNDDS)') {
    return (food.foodMeasures ?? [])
      .filter((measure) => {
        const label = measure.disseminationText?.trim().toLowerCase()
        return label !== 'quantity not specified' &&
          typeof measure.gramWeight === 'number' &&
          Number.isFinite(measure.gramWeight) &&
          measure.gramWeight > 0
      })
      .map((measure, index) => ({
        id: String(measure.id ?? `${measure.rank ?? index}-${measure.disseminationText}`),
        label: measure.disseminationText?.trim() || `${measure.gramWeight} g`,
        gramWeight: measure.gramWeight as number,
      }))
  }

  const gramWeight = toGrams(food.servingSize, food.servingSizeUnit)

  if (gramWeight == null) {
    return []
  }

  return [{
    id: String(food.fdcId ?? 'usda-serving'),
    label: food.householdServingFullText?.trim() || `${gramWeight} g`,
    gramWeight,
  }]
}

export async function searchUSDAFoods(query: string, pageSize = 50): Promise<USDAFoodResult[]> {
  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    return []
  }

  const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY

  if (!apiKey) {
    throw new Error('Add EXPO_PUBLIC_USDA_API_KEY to your .env file to search USDA foods.')
  }

  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: trimmedQuery,
      dataType: ['Survey (FNDDS)'],
      pageSize,
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`USDA search failed (${response.status}): ${details.slice(0, 200)}`)
  }

  const data: USDAFoodSearchResponse = await response.json()

  return (data.foods ?? [])
    .filter((food) => food.dataType === 'Survey (FNDDS)')
    .map((food) => {
    const nutrientsPer100g = food.dataType === 'Survey (FNDDS)'
    const servingOptions = getServingOptions(food)

    return {
      id: String(food.fdcId ?? `${food.description ?? 'food'}-${Math.random()}`),
      name: food.description ?? 'Unknown food',
      dataType: food.dataType,
      category: food.foodCategory || undefined,
      brand: food.brandOwner || food.brandName || undefined,
      barcode: food.gtinUpc || undefined,
      calories: getNutrientValue(food, 1008),
      protein: getNutrientValue(food, 1003),
      carbs: getNutrientValue(food, 1005),
      fat: getNutrientValue(food, 1004),
      fiber: getNutrientValue(food, 1079),
      nutrientsPer100g,
      servingOptions,
      source: 'USDA',
    }
    })
}
