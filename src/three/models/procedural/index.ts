import type { Archetype } from './types';
import { vehicleArchetypes } from './vehicles';
import { machineArchetypes } from './machines';
import { electronicsArchetypes } from './electronics';
import { householdArchetypes } from './household';
import { biologyArchetypes } from './biology';

export type { Archetype } from './types';

/** Every procedural archetype. Add new ones here – nothing else needs to change. */
export const ARCHETYPES: Archetype[] = [
  ...vehicleArchetypes,
  ...machineArchetypes,
  ...electronicsArchetypes,
  ...householdArchetypes,
  ...biologyArchetypes,
];

export const getArchetype = (id: string | null | undefined) => ARCHETYPES.find((a) => a.id === id);
