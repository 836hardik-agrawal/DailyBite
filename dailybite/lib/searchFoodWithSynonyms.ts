import { searchUSDAFoods } from './usda'
import { FOOD_SYNONYMS } from './foodSynonyms'
import { FOOD_SERVING_DEFAULTS } from './foodServingCatalog'
import type { USDAFoodResult } from './usda.types'

function getAllServingDefaults(): Array<[string, (typeof FOOD_SERVING_DEFAULTS)['breakfast'][string]]> {
  return Object.values(FOOD_SERVING_DEFAULTS).flatMap((categoryFoods) =>
    Object.entries(categoryFoods),
  )
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ')
}

function getSearchQueries(query: string): string[] {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return []
  }

  const synonyms = FOOD_SYNONYMS[normalizedQuery.toLowerCase()] ?? []
  const alternativeQueries = synonyms.filter((synonym) => synonym.trim() !== normalizedQuery)

  return [...alternativeQueries, normalizedQuery]
}

function getConfiguredCustomFoods(query: string): USDAFoodResult[] {
  const normalizedQuery = normalizeName(query)

  return getAllServingDefaults()
    .filter(([key, servingDefault]) => {
      const normalizedKey = normalizeName(key)
      return servingDefault.customServing &&
        (normalizedKey === normalizedQuery ||
          normalizedKey.startsWith(normalizedQuery) ||
          normalizedQuery.startsWith(normalizedKey) ||
          normalizeName(servingDefault.name ?? '').startsWith(normalizedQuery) ||
          normalizedQuery.startsWith(normalizeName(servingDefault.name ?? '')))
    })
    .map(([key, servingDefault]) => ({
      id: `custom:${normalizeName(key)}`,
      name: servingDefault.name ?? key,
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      nutrientsPer100g: false,
      servingOptions: [],
      source: 'CUSTOM',
    }))
}

function getMatchingServingDefaults(query: string) {
  const normalizedQuery = normalizeName(query)

  return getAllServingDefaults().filter(([key, servingDefault]) => {
    const normalizedKey = normalizeName(key)
    const normalizedName = normalizeName(servingDefault.name ?? '')
    return normalizedKey === normalizedQuery ||
      normalizedKey.startsWith(normalizedQuery) ||
      normalizedQuery.startsWith(normalizedKey) ||
      normalizedName === normalizedQuery ||
      normalizedName.startsWith(normalizedQuery) ||
      normalizedQuery.startsWith(normalizedName)
  })
}

export async function searchFoodWithSynonyms(query: string): Promise<USDAFoodResult[]> {
  const seenQueries = new Set<string>()
  let usdaResults: USDAFoodResult[] = []

  for (const searchQuery of getSearchQueries(query)) {
    const normalizedQuery = searchQuery.trim()
    const key = normalizedQuery.toLowerCase()

    if (!normalizedQuery || seenQueries.has(key)) {
      continue
    }

    seenQueries.add(key)

    const results = await searchUSDAFoods(normalizedQuery)

    if (results.length > 0) {
      usdaResults = results
      break
    }
  }

  const matchingDefaults = getMatchingServingDefaults(query)
  const configuredFoods = getConfiguredCustomFoods(query)
  const configuredNames = new Set(configuredFoods.map((food) => normalizeName(food.name)))
  const preferredServingMatches = usdaResults.filter((food) =>
    matchingDefaults.some(([, servingDefault]) => {
      const preferredLabel = servingDefault.preferredServingLabel
      return preferredLabel != null &&
        food.servingOptions.some(
          (serving) => normalizeName(serving.label) === normalizeName(preferredLabel),
        )
    }),
  )
  const exactDefaults = matchingDefaults.filter(
    ([key]) => normalizeName(key) === normalizeName(query),
  )
  const missingCustomFallback = exactDefaults.find(([, servingDefault]) => {
    const preferredLabel = servingDefault.preferredServingLabel
    const preferredLabelFound = preferredLabel != null &&
      usdaResults.some((food) =>
        food.servingOptions.some(
          (serving) => normalizeName(serving.label) === normalizeName(preferredLabel),
        ),
      )

    return preferredLabel != null && !preferredLabelFound && !servingDefault.customServing
  })

  if (missingCustomFallback) {
    throw new Error(
      `No USDA serving matches "${missingCustomFallback[1].preferredServingLabel}" for "${missingCustomFallback[0]}". Add a customServing in foodServingDefaults.ts.`,
    )
  }

  const preferredServingMatchIds = new Set(preferredServingMatches.map((food) => food.id))
  const preferredServingMatchNames = new Set(
    preferredServingMatches.map((food) => normalizeName(food.name)),
  )
  const prioritizedUSDAResults = preferredServingMatches.length > 0
    ? preferredServingMatches
    : []
  const remainingUSDAResults = usdaResults.filter(
    (food) => !preferredServingMatchIds.has(food.id) &&
      !configuredNames.has(normalizeName(food.name)),
  )

  return [
    ...prioritizedUSDAResults,
    ...configuredFoods.filter((food) => !preferredServingMatchNames.has(normalizeName(food.name))),
    ...remainingUSDAResults,
  ]
}
