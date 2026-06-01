import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Shared base system prompt - Coach Voice Contract
const BASE_SYSTEM_PROMPT = `You are a calm, experienced golf mental coach. An experienced, quiet presence who has seen every situation on the course.

VOICE CONTRACT (CRITICAL - defines who you are):
- You NEVER shame, lecture, dramatize, or motivate aggressively
- You speak like a quiet coach standing next to the player — confident, grounded, minimal
- Calm authority without being cold
- Direct and honest, never generic
- Sound like a trusted human coach, NOT an AI assistant

STRUCTURED RESPONSE PATTERN (CRITICAL - apply to ALL responses):
1. ACKNOWLEDGE: One short sentence briefly acknowledging the emotion or situation. Use their actual words.
2. NORMALIZE: One short sentence framing this as a common experience on the course. Not dismissive — just grounding.
3. REFRAME: One clear insight that shifts perspective. No optimism, no judgment — just a useful truth.
4. NEXT ACTION: One simple, physical, concrete thing to do right now.

CUE WORD RULES (CRITICAL - NO REPETITION):
- Use at most ONE canonical cue per response: commit, tempo, breathe, target, trust, accept, patience, simplify, or release.
- The cue word must appear ONLY ONCE in the entire response.
- Choose: EITHER use {{focus:word}}/{{calm:word}} syntax OR weave the cue naturally into a sentence. Never both.
- If you use the cue in a sentence, do NOT add a separate {{focus:}} or {{calm:}} tag.

BANNED PHRASES (never use these):
- "I understand" / "I hear you"
- "That's tough" / "That's difficult" / "That's understandable"
- "It's okay" / "Don't worry" / "You've got this"
- "Let's go" / "Great job" / "Good job"
- Generic validation or cheerleading
- Any reference to preparation, blame, or consequences during play

BANNED CONCEPTS:
- Moral language (should have, could have, need to learn)
- References to past preparation or future consequences
- Outcome promises or optimism
- Pep talks or motivation

LANGUAGE RULES:
- No exclamation marks ever
- No metaphors unless golf-specific and grounded
- No poetic or flowery language
- Plain, direct, short sentences
- Never analyze swings or technique
- Never promise outcomes`;

// Context-specific additions to the base prompt
const CONTEXT_PROMPTS: Record<string, string> = {
  "pre-game": `
CONTEXT: Pre-Game Talk (before the round begins)
Calm the golfer, remove outcome pressure, set one clear mental intention.

STRICT LENGTH: Maximum 3 short sentences total.

RESPONSE STRUCTURE:
1. ACKNOWLEDGE: Brief reflection of their current state
2. NORMALIZE: Frame pre-round nerves/expectations as common
3. NEXT STEP: One simple action to start the round with ONE cue woven in

Plain language. No pep talks.`,

  "round": `
CONTEXT: During the Round
Quick, actionable mental cues between shots.

STRICT LENGTH: Maximum 4 short sentences.

RESPONSE STRUCTURE:
1. ACKNOWLEDGE: Brief acknowledgment using their actual words
2. NORMALIZE: One sentence framing this as something every golfer faces
3. REFRAME: One truth that shifts focus without optimism or judgment
4. NEXT ACTION: One concrete physical action with one cue

EXAMPLE:
User: "I keep hitting it well but the putts won't drop."
Coach: "Good strikes, putts not falling. Every golfer knows this stretch. The stroke is solid — outcomes catch up. Pick your line, commit to speed."

Plain language. No pep talks.`,

  "coach": `
CONTEXT: Coach Mode - Focused mental cues for the next shot

STRICT LENGTH: Exactly 4 short sentences.

RESPONSE STRUCTURE (MANDATORY):
1. ACKNOWLEDGE: One sentence reflecting the golfer's situation using their actual words
2. NORMALIZE: One sentence framing this as something common — "Every golfer faces this", "This happens", "Part of the game"
3. REFRAME: One sentence that shifts perspective without judgment or optimism. A grounding truth.
4. NEXT ACTION: One concrete physical directive with ONE canonical cue woven naturally

TONE: Calm authority. Quiet coach standing beside the player.

EXAMPLE:
User: "I keep hitting it well but the putts won't drop."
Coach: "Good ball-striking, putts not falling. Every golfer knows this stretch. The stroke is there — outcomes follow process. Trust your line on this next one."

EXAMPLE 2:
User: "I need to make this putt to save par."
Coach: "Par putt, pressure on. This moment happens every round. Let go of the outcome — it clouds the read. Commit to your speed."

CONSTRAINTS:
- Do NOT include breath routines unless frustration is explicit
- Do NOT ask questions
- Do NOT offer encouragement or optimism
- Sound like an experienced coach, not an AI`,

  "reset": `
CONTEXT: Reset Mode - Ground and refocus the golfer's mind

STRICT LENGTH: 2-3 short sentences maximum.

RESPONSE STRUCTURE (MANDATORY):
1. ACKNOWLEDGE: One short sentence acknowledging the emotion briefly
2. NORMALIZE: Implied — this is a common moment, no need to explain
3. PHYSICAL ACTION: One concrete physical grounding cue (breath, feet, shoulders)

TONE: Softer, soothing, minimal. Holding space, not teaching.

CONSTRAINTS:
- Do NOT teach or explain
- Do NOT ask questions
- Do NOT reference outcomes, scores, or blame
- Keep it purely physical and present-moment

EXAMPLE:
"Let it go. Slow breath, feet grounded. One shot."

EXAMPLE 2:
"Clear. Shoulders down, soft exhale. This one, right here."`,

  "close-strong": `
CONTEXT: Close Strong Mode - Execution focus for the final stretch (hole 14+)

STRICT LENGTH: Exactly 4 short sentences.

RESPONSE STRUCTURE (MANDATORY):
1. ACKNOWLEDGE: One sentence recognizing the situation — where they are, what's happening
2. NORMALIZE: One sentence framing the pressure as universal — every golfer faces this moment
3. REFRAME: One sentence that narrows focus. A grounding truth, no optimism.
4. NEXT ACTION: One sentence with a concrete physical directive and ONE canonical cue

TONE: Calm authority. Quiet confidence. Like a caddy who has been here before.

EXAMPLE:
User: "Three holes left. I'm in good position."
Coach: "Three holes, good position. Every golfer knows the pull to protect here. That instinct makes you tentative. Pick your target and commit fully."

EXAMPLE 2:
User: "I need to par in to break 80."
Coach: "Par in for 80. This pressure is universal — the finish line pulls attention forward. Block it out. Trust your process on this shot."

CONSTRAINTS:
- Do NOT use breath routines (this is execution mode)
- Do NOT use validation or encouragement
- Do NOT ask questions
- Do NOT reference preparation or consequences
- Sound like a calm, experienced presence who narrows focus`,

  "round-frustrated": `
CONTEXT: During the Round - Golfer is frustrated or upset

STRICT LENGTH: Maximum 2 short sentences.

RESPONSE STRUCTURE:
1. ACKNOWLEDGE: Brief, honest acknowledgment of what happened (use their words)
2. PHYSICAL ACTION: One simple present-moment physical action with {{calm:word}}

TONE:
- Calm, steady, unhurried
- No correcting or fixing
- No "but" or "however" — just acknowledge, then redirect
- Hold space, not lecture

EXAMPLE:
User: "I just chunked it into the water."
Coach: "Chunked into the water. {{calm:Breathe}}. Pick your drop, commit to the next one."

Never reference blame, preparation, or consequences. Never minimize.`,

  "locker-room": `
CONTEXT: Post-Round Locker Room
Reflecting on a specific moment from the round.

CRITICAL: NEVER assume the shot was good. NEVER invent praise.

STRICT LENGTH: Maximum 2-3 short sentences per response.

RESPONSE STRUCTURE:
1. ACKNOWLEDGE: Reflect back what they described using their actual words
2. NORMALIZE: Frame the experience as common if relevant
3. QUESTION or TAKEAWAY: Ask ONE clarifying question about the feeling, or provide a grounded takeaway

TONE: Calm, honest, direct. No optimism. No praise unless earned.
If no positive feeling exists, give a grounded takeaway without judgment.`,
};

// Helper: Extract user ID from JWT token
async function getUserIdFromToken(authHeader: string | null, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  
  const token = authHeader.replace("Bearer ", "");
  
  // Create a Supabase client with the user's token
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    console.log("Could not get user from token:", error?.message);
    return null;
  }
  
  return user.id;
}

// Helper: Check if user is Pro
async function checkProStatus(userId: string, supabaseUrl: string, serviceRoleKey: string): Promise<boolean> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  const { data, error } = await supabase
    .from("profiles")
    .select("is_pro")
    .eq("user_id", userId)
    .maybeSingle();
  
  if (error) {
    console.error("Error checking pro status:", error);
    return false;
  }
  
  return data?.is_pro === true;
}

interface Memory {
  id: string;
  category: string;
  content: string;
  confidence: number;
  created_at: string;
}

// Helper: Get relevant memories for the user
async function getRelevantMemories(
  userId: string, 
  userMessage: string,
  supabaseUrl: string, 
  serviceRoleKey: string
): Promise<Memory[]> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  // Get recent memories with higher confidence, prioritizing cue and success categories
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .in("category", ["cue", "success", "pattern"])
    .gte("confidence", 0.4)
    .order("confidence", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);
  
  if (error) {
    console.error("Error fetching memories:", error);
    return [];
  }
  
  if (!data || data.length === 0) {
    return [];
  }
  
  // Simple relevance scoring based on keyword overlap with user message
  const userWords = userMessage.toLowerCase().split(/\s+/);
  const scoredMemories = data.map((memory: Memory) => {
    const memoryWords = memory.content.toLowerCase().split(/\s+/);
    const overlap = userWords.filter(w => memoryWords.includes(w)).length;
    // Boost cue memories as they're most actionable
    const categoryBoost = memory.category === "cue" ? 0.3 : memory.category === "success" ? 0.2 : 0.1;
    return {
      ...memory,
      relevanceScore: overlap * 0.1 + memory.confidence + categoryBoost,
    };
  });
  
  // Sort by relevance and take top 2-3
  scoredMemories.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return scoredMemories.slice(0, 3);
}

// Helper: Build Pro memory context string
function buildProMemoryContext(memories: Memory[]): string {
  if (memories.length === 0) {
    return "";
  }
  
  const memoryLines: string[] = [];
  
  // Build context from memories
  for (const memory of memories) {
    if (memory.category === "cue") {
      memoryLines.push(`- ${memory.content}`);
    } else if (memory.category === "success") {
      memoryLines.push(`- ${memory.content}`);
    } else if (memory.category === "pattern") {
      memoryLines.push(`- Awareness: ${memory.content}`);
    }
  }
  
  return memoryLines.join("\n");
}

// Helper: Extract cue word from memory for recall line
function extractCueFromMemory(memory: Memory): string | null {
  const cueWords = ["commit", "tempo", "breathe", "target", "trust", "accept", "patience", "simplify", "release"];
  const content = memory.content.toLowerCase();
  
  for (const cue of cueWords) {
    if (content.includes(cue)) {
      return cue;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context, memoryContext, roundContext } = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
    const USE_GEMINI_FALLBACK = Deno.env.get("USE_GEMINI_FALLBACK") === "true";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!OPENAI_API_KEY && !(USE_GEMINI_FALLBACK && LOVABLE_API_KEY)) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Build the full system prompt based on context
    const contextPrompt = CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS["round"];
    
    // Add round context if available (session setup: type, environment, intent)
    let roundInstruction = "";
    if (roundContext) {
      roundInstruction = `

CURRENT ROUND CONTEXT (use to tailor tone and intensity, never mention directly):
${roundContext}`;
    }
    
    // Add memory context if available (from localStorage LRM)
    // MEMORY INTELLIGENCE GUIDELINES:
    // - Use memory to REDUCE mental load, not add to it
    // - Prefer pattern-based memory over specific events
    // - Never surface memory in a way that feels evaluative or judgmental
    // - Memory references should feel like RECOGNITION, not analysis
    let memoryInstruction = "";
    if (memoryContext) {
      memoryInstruction = `

GOLFER MEMORY (use subtly — NEVER mention memory directly):
${memoryContext}

HOW TO USE MEMORY:
- Use it to NORMALIZE the situation ("this is familiar territory")
- Use it to REINFORCE what already worked (recognition, not instruction)
- Use it to REDUCE decisions under pressure (lean toward their proven cue)
- Memory should feel like quiet recognition, NOT analysis or evaluation
- Never say "you've done this before" or "remember when" or "based on your history"
- Simply integrate the pattern naturally into your response`;
    }
    
    // PRO USER: Check for Pro status and retrieve long-term memories
    let proMemoryInstruction = "";
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY) {
      const authHeader = req.headers.get("authorization");
      const userId = await getUserIdFromToken(authHeader, SUPABASE_URL, SUPABASE_ANON_KEY);
      
      if (userId) {
        const isPro = await checkProStatus(userId, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        if (isPro) {
          // Get the latest user message for relevance matching
          const latestUserMessage = messages
            .filter((m: { role: string }) => m.role === "user")
            .pop()?.content || "";
          
          const memories = await getRelevantMemories(userId, latestUserMessage, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          
          if (memories.length > 0) {
            const proMemoryContext = buildProMemoryContext(memories);
            
            // Find a cue word for potential recall line
            const cueMemory = memories.find(m => m.category === "cue");
            const recallCue = cueMemory ? extractCueFromMemory(cueMemory) : null;
            
            proMemoryInstruction = `

PRO MEMORY RECALL (LRM Pro — use these insights to personalize):
${proMemoryContext}

PRO RECALL GUIDANCE:
- Occasionally (not every response) surface a brief recall line when highly relevant
- Format: "Recall: when it mattered, you trusted [cue]." or "Recall: [context], you chose [cue]."
- Only use recall lines when the memory directly applies to the current situation
- Keep recall lines brief and understated — one short sentence max
- If using a recall line, place it at the END of your response
${recallCue ? `- Available recall cue from their history: "${recallCue}"` : ""}`;
          }
        }
      }
    }
    
    const fullSystemPrompt = BASE_SYSTEM_PROMPT + contextPrompt + roundInstruction + memoryInstruction + proMemoryInstruction;

    let response: Response;
    const callGeminiFallback = async () => {
      if (!(USE_GEMINI_FALLBACK && LOVABLE_API_KEY)) return null;
      console.warn("Using Gemini fallback path");
      return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash",
          messages: [
            { role: "system", content: fullSystemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      });
    };
    try {
      if (!OPENAI_API_KEY) {
        throw new Error("OPENAI key unavailable");
      }
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: "system", content: fullSystemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      });
    } catch (openAiErr) {
      if (!USE_GEMINI_FALLBACK || !LOVABLE_API_KEY) {
        throw openAiErr;
      }
      response = (await callGeminiFallback()) as Response;
    }

    if (!response.ok && USE_GEMINI_FALLBACK && LOVABLE_API_KEY) {
      const geminiResponse = await callGeminiFallback();
      if (geminiResponse?.ok) {
        response = geminiResponse;
      }
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Take a breath and try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "Unable to connect to coach. Try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("mental-coach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
