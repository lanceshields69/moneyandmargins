import nomineesJson from '../data/nominees.json'
import spendingJson from '../data/spending.json'
import usStatesData from '../data/us-states.json'
import { buildAllRaces } from './computeSpending'
import type { NomineesFile, SpendingFile } from './types'

export const allRaces = buildAllRaces(
  nomineesJson as unknown as NomineesFile,
  spendingJson as unknown as SpendingFile,
)

export const stateNames = new Map(
  (usStatesData as { states: { usps: string; name: string }[] }).states.map((s) => [s.usps, s.name]),
)
