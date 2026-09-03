/**
 * Match instructions nudge selection score slightly (FM soft orders).
 */

import type { Player } from "../players/player.js";
import { getPlayerRoleState } from "./player-roles.js";
import { INSTRUCTIONS } from "./player-roles.js";

export function instructionSelectionNudge(player: Player): number {
  try {
    const st = getPlayerRoleState(player);
    const ins = INSTRUCTIONS.find((i) => i.id === st.instruction);
    return ins?.selectionBonus ?? 0;
  } catch {
    return 0;
  }
}

export function describeInstructions(player: Player): string {
  try {
    const st = getPlayerRoleState(player);
    const ins = INSTRUCTIONS.find((i) => i.id === st.instruction);
    return ins ? `${ins.label}: ${ins.description}` : "Balanced";
  } catch {
    return "Balanced";
  }
}
