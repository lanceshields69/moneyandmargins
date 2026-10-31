import nomineesJson from '../data/nominees.json'
import spendingJson from '../data/spending.json'
import { buildAllRaces } from './computeSpending'
import type { NomineesFile, SpendingFile } from './types'

export const allRaces = buildAllRaces(
  nomineesJson as unknown as NomineesFile,
  spendingJson as unknown as SpendingFile,
)
