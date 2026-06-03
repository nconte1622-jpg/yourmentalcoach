import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";

type Env = {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
  SUPABASE_URL: string;
  REQUIRE_AUTH?: string;
  SUPABASE_JWT_AUD?: string;
  ALLOWED_ORIGINS?: string;
  LOG_REQUESTS?: string;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/* ═══════════════════════════════════════════════════════════════
   THE BRAIN — System prompts that define coaching personality
   ═══════════════════════════════════════════════════════════════ */

const BASE_SYSTEM_PROMPT = `You are Your Mental Coach — this golfer's personal mental performance coach. You know their game, their tendencies, their mindset. You talk like a real person — a trusted friend who also happens to be an elite mental performance coach.

BOUNDARIES (quietly held — never lecture about them):
- You coach golf and the mind around golf. If they steer way off-topic, warmly bring it back to their game.
- You're a performance coach, not a therapist or doctor. You don't diagnose or give medical, legal, or financial advice.
- If someone signals real crisis or thoughts of self-harm, drop the coaching act. Be a human for a second: tell them plainly this is bigger than golf and you want them to talk to someone who can really help — in the US they can call or text 988, anytime. Keep it short, warm, no judgment.

HOW YOU TALK:
- Like a real human. Conversational, warm, occasionally funny. If they're vibing, vibe with them. If they're hurting, be steady.
- NEVER use labels like "Acknowledge:", "Reframe:", "Next action:", "Tip:", etc. Just talk naturally.
- NEVER use bullet points or numbered lists. Write in flowing sentences like a person texting their coach.
- Use their NAME if you have it. "Nico, that's the swing right there." feels different than generic advice.
- Short is powerful. 2-4 sentences usually. But if the moment calls for more, go for it.
- You can be a little playful. If they're -2 through the front and the putter is hot, match that energy: "Now we're cooking. Don't change a thing — same process, same trust."
- If they're frustrated, don't lecture. Be the calm in the storm. Brief, grounded, no judgment.
- Use IDENTITY language naturally: "That's who you are on the course" hits different than "try to do that more."
- Reference their cue words from memory like you just know them. Don't announce it — weave it in.
- You're also a golf coach, not just a mental coach. You understand the game. If they mention swing issues, you can briefly acknowledge it and redirect to what they can control mentally, but don't pretend golf mechanics don't exist.
- Never say "great question", "that's normal", "I understand your frustration", or any therapist-speak. Just be real.

YOUR EDGE:
You remember things. You notice patterns across rounds. You say the thing they need to hear, not what sounds nice. You build their identity as a mentally tough golfer, one conversation at a time. You're the coach they wish they had in their ear on every hole.`;

const CONTEXT_PROMPTS: Record<string, string> = {

  "pre-game": `They're about to tee off. This is the calm before the round.
Keep it to 2-3 sentences. Give them ONE thing to focus on today. If you know their cue word, drop it in naturally. End with something physical they can do on the first tee — a breath, a target, a feel. If they're nervous, don't dismiss it. Channel it. "That energy means you're locked in. Use it."`,

  "round": `They're on the course right now, between shots.
2-4 sentences. Read their energy. If they're playing well, ride that wave with them — be excited but not over the top. "That's the good stuff. Same thing, next hole." If they hit a bad shot, don't dwell. Point them forward. If they mention something going well, anchor that feeling so they can come back to it. Talk like a caddie who knows them — casual, confident, present. Give them ONE thing for the next shot, not a lesson plan.`,

  "round-frustrated": `They're pissed. Maybe swearing. Definitely tight.
2 sentences MAX. Do NOT teach, explain, or rationalize. They cannot hear a lesson right now. Give them something physical first — breathe, loosen the grip, feel the ground. Then one simple forward thought. Be the calm voice. You've seen this before and you're not worried. "Grip pressure. Breathe. Now pick a target and trust it." That's it. No paragraphs.`,

  "locker-room": `Round is over. Time to reflect — but keep it real, not clinical.
3-4 sentences. Help them land on ONE takeaway. If they played great, lock in what was working mentally — "What were you thinking about when the putter was rolling like that?" If they struggled, find the bright spot — the hole they bounced back on, the shot they committed to. Plant a seed for next time. This is coach-over-a-beer energy, not a lecture hall.`,

  "coach": `Direct coaching conversation, off the course.
3-4 sentences. Ask questions that build self-awareness: "What were you feeling over the ball on that shot?" Connect patterns you see across their rounds. Be a thoughtful mentor, not a textbook. One concrete insight they can take with them. If they're asking about something technical, acknowledge it and tie it to the mental side.`,

  "reset": `They need to snap out of it RIGHT NOW. Bad stretch, spiraling, losing focus.
2-3 sentences. Physical first — breathe, slow down, feel the club. Then shrink their world to just this one shot. If you know their cue word, now is when it's most powerful. Be calm, steady, almost meditative. Don't reference what went wrong. Only what's next.`,

  "close-strong": `Last few holes. This is where rounds are made.
3 sentences max. Quieter, more intense. Every word matters. Simplify everything down to: one target, one committed swing. If they're ahead, keep them in the process. If they're behind, free them up to just play. Their cue word works like a mantra here. This isn't the time for conversation — it's the time for precision.`,
};

/* Per-mode sampling. Lower temperature = steadier, on-brand voice; tighter
   max_tokens enforces the brevity the prompts ask for (and caps cost). The
   high-pressure modes (frustrated, reset, close-strong) are kept short and
   low-variance on purpose — that's when a calm, precise voice matters most. */
type Sampling = { temperature: number; max_tokens: number };
const SAMPLING_BY_CONTEXT: Record<string, Sampling> = {
  "pre-game": { temperature: 0.7, max_tokens: 170 },
  "round": { temperature: 0.7, max_tokens: 200 },
  "round-frustrated": { temperature: 0.4, max_tokens: 90 },
  "locker-room": { temperature: 0.7, max_tokens: 240 },
  "coach": { temperature: 0.7, max_tokens: 260 },
  "reset": { temperature: 0.45, max_tokens: 110 },
  "close-strong": { temperature: 0.5, max_tokens: 150 },
};
const DEFAULT_SAMPLING: Sampling = { temperature: 0.7, max_tokens: 200 };

/* ═══════════════════════════════════════════════════════════════
   INFRASTRUCTURE — Auth, CORS, routing (unchanged)
   ═══════════════════════════════════════════════════════════════ */

const jwksByProject = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(supabaseUrl: string) {
  const jwksUrl = new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
  const key = jwksUrl.toString();
  const existing = jwksByProject.get(key);
  if (existing) return existing;
  const created = createRemoteJWKSet(jwksUrl);
  jwksByProject.set(key, created);
  return created;
}

function asBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  return value.toLowerCase() === "true";
}

function parseAllowedOrigins(raw: string | undefined): string[] {
  return String(raw || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function resolveOrigin(origin: string | null, env: Env): { allowOrigin: string; blocked: boolean } {
  const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  if (allowed.includes("*")) return { allowOrigin: "*", blocked: false };
  if (origin && allowed.includes(origin)) return { allowOrigin: origin, blocked: false };
  if (origin && allowed.length > 0) return { allowOrigin: allowed[0], blocked: true };
  return { allowOrigin: allowed[0] || "*", blocked: false };
}

function buildCorsHeaders(allowOrigin: string): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", allowOrigin);
  headers.set("Access-Control-Allow-Headers", "authorization, content-type, x-request-id");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Expose-Headers", "x-request-id");
  headers.set("Vary", "Origin");
  return headers;
}

async function verifySupabaseJwt(token: string, env: Env): Promise<JWTPayload> {
  const audience = env.SUPABASE_JWT_AUD || "authenticated";
  const issuer = `${env.SUPABASE_URL}/auth/v1`;
  const jwks = getJwks(env.SUPABASE_URL);
  const result = await jwtVerify(token, jwks, { issuer, audience });
  return result.payload;
}

function unauthorized(corsHeaders: Headers) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: new Headers({
      ...Object.fromEntries(corsHeaders.entries()),
      "Content-Type": "application/json",
    }),
  });
}

function logRequest(
  env: Env,
  details: {
    requestId: string;
    method: string;
    path: string;
    status: number;
    errorBucket: string;
    origin: string;
    authPresent: boolean;
  },
) {
  if (!asBool(env.LOG_REQUESTS, false)) return;
  console.log(
    `request_id=${details.requestId} method=${details.method} path=${details.path} status=${details.status} error_bucket=${details.errorBucket} origin="${details.origin}" auth_present=${details.authPresent}`,
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN HANDLER
   ═══════════════════════════════════════════════════════════════ */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const authPresent = Boolean(request.headers.get("Authorization"));
    const requestId = request.headers.get("X-Request-Id") || crypto.randomUUID();
    const originResolution = resolveOrigin(origin, env);
    const corsHeaders = buildCorsHeaders(originResolution.allowOrigin);
    const logBase = {
      requestId,
      method: request.method,
      path: url.pathname,
      origin: origin || "(none)",
      authPresent,
    };

    if (request.method === "OPTIONS") {
      corsHeaders.set("x-request-id", requestId);
      logRequest(env, { ...logBase, status: 204, errorBucket: "ok_preflight" });
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (originResolution.blocked) {
      const headers = new Headers(corsHeaders);
      headers.set("Content-Type", "application/json");
      headers.set("x-request-id", requestId);
      logRequest(env, { ...logBase, status: 403, errorBucket: "cors_origin_denied" });
      return new Response(JSON.stringify({ error: "Origin is not allowed" }), { status: 403, headers });
    }

    if (url.pathname !== "/v1/mental-coach") {
      corsHeaders.set("x-request-id", requestId);
      logRequest(env, { ...logBase, status: 404, errorBucket: "not_found" });
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      corsHeaders.set("x-request-id", requestId);
      logRequest(env, { ...logBase, status: 405, errorBucket: "method_not_allowed" });
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const requireAuth = asBool(env.REQUIRE_AUTH, true);
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (requireAuth) {
      if (!token) {
        const res = unauthorized(corsHeaders);
        res.headers.set("x-request-id", requestId);
        logRequest(env, { ...logBase, status: 401, errorBucket: "auth_missing" });
        return res;
      }
      try {
        await verifySupabaseJwt(token, env);
      } catch {
        const res = unauthorized(corsHeaders);
        res.headers.set("x-request-id", requestId);
        logRequest(env, { ...logBase, status: 401, errorBucket: "auth_invalid" });
        return res;
      }
    }

    if (!env.OPENAI_API_KEY) {
      logRequest(env, { ...logBase, status: 500, errorBucket: "server_config_missing_openai_key" });
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured" }), {
        status: 500,
        headers: new Headers({
          ...Object.fromEntries(corsHeaders.entries()),
          "Content-Type": "application/json",
          "x-request-id": requestId,
        }),
      });
    }

    const body = (await request.json()) as {
      messages?: ChatMessage[];
      context?: string;
      memoryContext?: string;
      roundContext?: string;
      golferContext?: string;
      insightJournalContext?: string;
      back9Context?: string;
    };

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const context = String(body.context || "round");
    const contextPrompt = CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.round;
    const golferSection = body.golferContext ? `--- WHO YOU'RE COACHING ---\n${body.golferContext}` : "";
    const journalSection = body.insightJournalContext ? `--- THINGS THEY'VE TOLD YOU (from past rounds) ---\n${body.insightJournalContext}\nWeave these naturally into your coaching. Don't announce that you "remember" — just reference it like you've been paying attention.` : "";
    const back9Section = body.back9Context ? `--- BACK NINE TENDENCY ---\n${body.back9Context}` : "";
    const sessionSection = [body.roundContext, body.memoryContext].filter(Boolean).join("\n\n");
    const extraContext = [golferSection, journalSection, back9Section, sessionSection].filter(Boolean).join("\n\n");

    const systemPrompt = extraContext
      ? `${BASE_SYSTEM_PROMPT}\n\n--- CURRENT MODE ---\n${contextPrompt}\n\n${extraContext}`
      : `${BASE_SYSTEM_PROMPT}\n\n--- CURRENT MODE ---\n${contextPrompt}`;

    const sampling = SAMPLING_BY_CONTEXT[context] || DEFAULT_SAMPLING;

    console.log(`mental-coach request_id=${requestId} context=${context} model=${env.OPENAI_MODEL || "gpt-4.1-mini"} temp=${sampling.temperature}`);

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4.1-mini",
        stream: true,
        temperature: sampling.temperature,
        max_tokens: sampling.max_tokens,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      console.error(`mental-coach upstream_error request_id=${requestId} status=${upstream.status} body=${text.slice(0, 500)}`);
      logRequest(env, { ...logBase, status: upstream.status || 500, errorBucket: "openai_upstream_error" });
      return new Response(
        JSON.stringify({ error: "Unable to connect to coach.", request_id: requestId }),
        {
          status: upstream.status || 500,
          headers: new Headers({
            ...Object.fromEntries(corsHeaders.entries()),
            "Content-Type": "application/json",
            "x-request-id": requestId,
          }),
        },
      );
    }

    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set("Content-Type", "text/event-stream");
    responseHeaders.set("Cache-Control", "no-cache");
    responseHeaders.set("Connection", "keep-alive");
    responseHeaders.set("x-request-id", requestId);
    logRequest(env, { ...logBase, status: 200, errorBucket: "ok" });

    return new Response(upstream.body, { status: 200, headers: responseHeaders });
  },
};
