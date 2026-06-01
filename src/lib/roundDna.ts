import type { Round } from "@/hooks/useRounds";

export type RoundDNA = {
  strongest_quality: string;
  biggest_trigger: string;
  resilience_score: number;
  most_effective_cue: string;
  growth_insight: string;
};

export type StructuredPostRoundReflection = {
  emotional_start: string;
  emotional_finish: string;
  trigger_type: string;
  trigger_hole?: string;
  recovery_quality: string;
  effective_cue: string;
  identity_sentence: string;
  timestamp: string;
  round_id: string | null;
};

type ReflectionEnvelope = {
  version: 2;
  kind: "post_round_reflection";
  data: StructuredPostRoundReflection;
  round_dna?: RoundDNA;
};

function normalizeResilienceScore(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(10, Math.max(1, Math.round(parsed)));
}

export function serializePostRoundPayload(
  data: StructuredPostRoundReflection,
  roundDna?: RoundDNA
): string {
  const envelope: ReflectionEnvelope = {
    version: 2,
    kind: "post_round_reflection",
    data,
    ...(roundDna ? { round_dna: roundDna } : {}),
  };

  return JSON.stringify(envelope);
}

export function parseRoundDnaFromRound(round: Pick<Round, "post_round_adjustment">): RoundDNA | null {
  const raw = round.post_round_adjustment;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ReflectionEnvelope>;
    const dna = parsed.round_dna;
    if (!dna) return null;

    if (
      typeof dna.strongest_quality !== "string" ||
      typeof dna.biggest_trigger !== "string" ||
      typeof dna.most_effective_cue !== "string" ||
      typeof dna.growth_insight !== "string"
    ) {
      return null;
    }

    return {
      strongest_quality: dna.strongest_quality,
      biggest_trigger: dna.biggest_trigger,
      resilience_score: normalizeResilienceScore(dna.resilience_score),
      most_effective_cue: dna.most_effective_cue,
      growth_insight: dna.growth_insight,
    };
  } catch {
    return null;
  }
}

export function parseStructuredReflectionFromRound(
  round: Pick<Round, "post_round_adjustment">
): StructuredPostRoundReflection | null {
  const raw = round.post_round_adjustment;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ReflectionEnvelope>;
    if (parsed.kind !== "post_round_reflection" || !parsed.data) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
