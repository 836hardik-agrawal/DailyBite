import { searchUSDAFoods } from './usda'
import { FOOD_SYNONYMS } from './foodSynonyms'
import type { USDAFoodResult } from './usda.types'

function getSearchQueries(query: string): string[] {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return []
  }

  const synonyms = FOOD_SYNONYMS[normalizedQuery.toLowerCase()] ?? []
  const alternativeQueries = synonyms.filter((synonym) => synonym.trim() !== normalizedQuery)

  return [...alternativeQueries, normalizedQuery]
}

export async function searchFoodWithSynonyms(query: string): Promise<USDAFoodResult[]> {
  const seenQueries = new Set<string>()

  for (const searchQuery of getSearchQueries(query)) {
    const normalizedQuery = searchQuery.trim()
    const key = normalizedQuery.toLowerCase()

    if (!normalizedQuery || seenQueries.has(key)) {
      continue
    }

    seenQueries.add(key)

    const results = await searchUSDAFoods(normalizedQuery)

    if (results.length > 0) {
      return results
    }
  }

  return []
}
