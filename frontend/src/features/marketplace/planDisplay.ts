import type { CSSProperties } from 'react'
import type { Difficulty } from '../../services/types'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
}

/** Stable hue per plan so each card gets its own cover without needing an image. */
export function coverStyle(planId: string): CSSProperties {
  let hash = 0
  for (const char of planId) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return { '--cover-hue': String(hash) } as CSSProperties
}
