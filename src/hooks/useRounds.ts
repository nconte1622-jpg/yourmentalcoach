import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  clearActiveRoundSession,
  clearRoundMessages,
  consumePendingPreGameTalk,
  loadActiveRoundSession,
  saveActiveRoundSession,
  updateActiveRoundSession,
} from "@/lib/roundSession";
import { getDailyFocus, setDailyFocus } from "@/lib/dailyFocus";

export type RoundType = "on-course" | "simulator" | "practice";
export type RoundEnvironment = "casual" | "competitive" | "scoring";
export type RoundStatus = "active" | "completed" | "abandoned";

export interface Round {
  id: string;
  user_id: string;
  round_type: string;
  environment: string;
  course_location: string | null;
  goal: string | null;
  created_at: string;
  started_at: string;
  ended_at: string | null;
  status: RoundStatus;
  post_round_best: string | null;
  post_round_cost: string | null;
  post_round_adjustment: string | null;
}

function buildActiveRoundSnapshot(round: Round) {
  const currentFocus = getDailyFocus();
  return {
    roundId: round.id,
    status: round.status ?? "active",
    roundType: round.round_type,
    environment: round.environment,
    courseLocation: round.course_location,
    goal: round.goal,
    todayFocus: currentFocus?.round_id === round.id ? currentFocus.text : null,
    createdAt: round.created_at ?? round.started_at,
    startedAt: round.started_at ?? round.created_at,
  };
}

export interface RoundEvent {
  id: string;
  user_id: string;
  round_id: string;
  event_type: string;
  label: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateRoundInput {
  round_type: RoundType;
  environment: RoundEnvironment;
  course_location?: string;
  goal?: string;
}

export interface CreateRoundEventInput {
  round_id: string;
  event_type: "reset" | "note" | "emotion_tap" | "pre_round_talk" | "ai_message_sent" | "post_round_completed";
  label?: string;
  notes?: string;
}

export interface UpdateRoundInput {
  ended_at?: string;
  status?: RoundStatus;
  post_round_best?: string | null;
  post_round_cost?: string | null;
  post_round_adjustment?: string | null;
}

function isSchemaMismatch(error: unknown): boolean {
  const candidate = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null;

  const combined = [
    candidate?.message,
    candidate?.details,
    candidate?.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    candidate?.code === "PGRST204" ||
    candidate?.code === "42703" ||
    combined.includes("status") ||
    combined.includes("created_at") ||
    combined.includes("schema cache")
  );
}

function buildRoundCreationError(
  kind: "schema" | "unknown",
  payload: Record<string, unknown>,
  error: unknown
) {
  const wrapped = new Error(
    kind === "schema"
      ? "Round schema mismatch"
      : "Round creation failed"
  ) as Error & {
    kind: "schema" | "unknown";
    payload: Record<string, unknown>;
    cause: unknown;
  };

  wrapped.kind = kind;
  wrapped.payload = payload;
  wrapped.cause = error;
  return wrapped;
}

export function useRounds() {
  const { user } = useAuth();

  const createRound = async (input: CreateRoundInput): Promise<Round | null> => {
    if (!user?.id) {
      console.warn("Cannot create round: no authenticated user");
      return null;
    }

    const roundInsertPayload = {
      user_id: user.id,
      round_type: input.round_type,
      environment: input.environment,
      course_location: input.course_location || null,
      goal: input.goal || null,
      status: "active",
    };

    let { data, error } = await supabase
      .from("rounds")
      .insert(roundInsertPayload)
      .select()
      .single();

    if (error && isSchemaMismatch(error)) {
      console.error("[createRound] schema mismatch on primary insert", {
        error,
        payload: roundInsertPayload,
      });

      const fallbackPayload = {
        user_id: user.id,
        round_type: input.round_type,
        environment: input.environment,
        course_location: input.course_location || null,
        goal: input.goal || null,
      };

      const retryResult = await supabase
        .from("rounds")
        .insert(fallbackPayload)
        .select()
        .single();

      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.error("[createRound] failed", {
        error,
        payload: roundInsertPayload,
        code: (error as { code?: string } | null)?.code,
        message: (error as { message?: string } | null)?.message,
        details: (error as { details?: string } | null)?.details,
        hint: (error as { hint?: string } | null)?.hint,
      });
      throw buildRoundCreationError(
        isSchemaMismatch(error) ? "schema" : "unknown",
        roundInsertPayload,
        error
      );
    }

    const round = data as Round;

    saveActiveRoundSession(buildActiveRoundSnapshot(round));

    const pendingPreGameTalk = consumePendingPreGameTalk();
    if (pendingPreGameTalk) {
      const { error: preGameError } = await supabase.from("round_events").insert({
        user_id: user.id,
        round_id: round.id,
        event_type: "pre_round_talk",
        label: "Pre-Game Talk",
        notes: JSON.stringify(pendingPreGameTalk),
      });
      if (preGameError) {
        console.error("[createRound] failed to attach pre-game talk", {
          error: preGameError,
          roundId: round.id,
          pendingPreGameTalk,
        });
      }
    }

    const dailyFocus = getDailyFocus();
    if (dailyFocus?.text && typeof dailyFocus.text === "string") {
      setDailyFocus({
        ...dailyFocus,
        round_id: round.id,
      });
      updateActiveRoundSession({
        roundId: round.id,
        todayFocus: dailyFocus.text,
      });

      const { error: dailyFocusError } = await supabase.from("round_events").insert({
        user_id: user.id,
        round_id: round.id,
        event_type: "note",
        label: "daily_focus",
        notes: JSON.stringify({
          text: dailyFocus.text,
          saved_at: dailyFocus.saved_at,
        }),
      });
      if (dailyFocusError) {
        console.error("[createRound] failed to attach daily focus", {
          error: dailyFocusError,
          roundId: round.id,
          dailyFocus,
        });
      }
    }

    return round;
  };

  const updateRound = async (id: string, input: UpdateRoundInput): Promise<Round | null> => {
    if (!user?.id) {
      console.warn("Cannot update round: no authenticated user");
      return null;
    }

    const { data, error } = await supabase
      .from("rounds")
      .update(input)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update round:", error);
      const msg = (error as { message?: string }).message;
      toast.error(msg ? `Unable to update round: ${msg}` : "Unable to update round");
      return null;
    }

    const round = data as Round;

    if (round.ended_at || round.status === "completed" || round.status === "abandoned") {
      clearActiveRoundSession();
      clearRoundMessages(round.id);
    } else {
      saveActiveRoundSession(buildActiveRoundSnapshot(round));
    }

    return round;
  };

  const getRound = async (id: string): Promise<Round | null> => {
    if (!user?.id) return null;

    const { data, error } = await supabase
      .from("rounds")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Failed to fetch round:", error);
      return null;
    }

    return data as Round;
  };

  const getActiveRound = async (): Promise<Round | null> => {
    if (!user?.id) return null;

    const persisted = loadActiveRoundSession();
    if (persisted?.roundId) {
      const persistedRound = await getRound(persisted.roundId);
      if (persistedRound && !persistedRound.ended_at && persistedRound.status !== "completed") {
        return persistedRound;
      }
      clearActiveRoundSession();
    }

    const { data, error } = await supabase
      .from("rounds")
      .select("*")
      .eq("user_id", user.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch active round:", error);
      return null;
    }

    const round = data as Round | null;
    if (round) {
      saveActiveRoundSession(buildActiveRoundSnapshot(round));
    }

    return round;
  };

  const getRecentRounds = async (limit = 10): Promise<Round[]> => {
    if (!user?.id) return [];

    const { data, error } = await supabase
      .from("rounds")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to fetch recent rounds:", error);
      return [];
    }

    return (data as Round[]) ?? [];
  };

  const createRoundEvent = async (input: CreateRoundEventInput): Promise<RoundEvent | null> => {
    if (!user?.id) {
      console.warn("Cannot create round event: no authenticated user");
      return null;
    }

    const { data, error } = await supabase
      .from("round_events")
      .insert({
        user_id: user.id,
        round_id: input.round_id,
        event_type: input.event_type,
        label: input.label || null,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create round event:", error);
      return null;
    }

    return data as RoundEvent;
  };

  const getRoundEvents = async (roundId: string): Promise<RoundEvent[]> => {
    if (!user?.id) return [];

    const { data, error } = await supabase
      .from("round_events")
      .select("*")
      .eq("round_id", roundId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch round events:", error);
      return [];
    }

    return (data as RoundEvent[]) ?? [];
  };

  const discardRound = async (id: string): Promise<Round | null> => {
    const round = await updateRound(id, {
      ended_at: new Date().toISOString(),
      status: "abandoned",
    });

    if (round) {
      clearRoundMessages(round.id);
      const currentFocus = getDailyFocus();
      if (currentFocus?.round_id === round.id) {
        setDailyFocus({
          ...currentFocus,
          round_id: undefined,
        });
      }
    }

    return round;
  };

  const hydrateActiveRoundSession = async () => {
    const round = await getActiveRound();
    if (!round) return null;
    const snapshot = buildActiveRoundSnapshot(round);
    saveActiveRoundSession(snapshot);
    return snapshot;
  };

  const attachDailyFocusToActiveRound = async (focusText: string) => {
    const persisted = loadActiveRoundSession();
    const round = persisted?.roundId ? await getRound(persisted.roundId) : await getActiveRound();
    if (!round) return null;
    updateActiveRoundSession({
      roundId: round.id,
      todayFocus: focusText,
    });
    return round;
  };

  return {
    createRound,
    updateRound,
    getRound,
    getActiveRound,
    getRecentRounds,
    createRoundEvent,
    getRoundEvents,
    discardRound,
    hydrateActiveRoundSession,
    attachDailyFocusToActiveRound,
  };
}
