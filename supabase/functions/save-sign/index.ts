const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const encoder = new TextEncoder();
const MAX_COINS = 1_000_000_000;
const MAX_SCORE = 100_000_000;
const MAX_TICKETS = 9_999;
const MAX_UNLOCKED_CARDS = 256;
const ITEM_MAX_LEVEL: Record<string, number> = {
  daedalus: 5,
  desolator: 5,
  moonshard: 5,
  aghanims: 5,
  octarine: 5,
  midas: 5,
  oca: 0,
};
const ALLOWED_TICKET_TYPES = ['standard', 'premium', 'elite'];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(obj[key])}`).join(',')}}`;
}

function toNonNegativeInt(value: unknown, field: string, max: number): number {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num < 0) throw new Error(`${field} must be non-negative`);
  const int = Math.floor(num);
  if (int > max) throw new Error(`${field} exceeds max`);
  return int;
}

function normalizeStringArray(value: unknown, fallback: string[], field: string, maxLength: number): string[] {
  if (value === undefined || value === null) return fallback;
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  if (value.length > maxLength) throw new Error(`${field} exceeds max length`);
  return [...new Set(value.filter((entry) => typeof entry === 'string' && entry.length <= 64))];
}

function normalizeDayArray(value: unknown): number[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('dailyQuest.claimed must be an array');
  if (value.length > 7) throw new Error('dailyQuest.claimed exceeds max length');
  return [...new Set(value
    .map((entry) => Number(entry))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
}

function validateAndNormalizeSave(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('save_data must be an object');
  const raw = input as Record<string, unknown>;
  const itemsRaw = (raw.items && typeof raw.items === 'object' && !Array.isArray(raw.items))
    ? raw.items as Record<string, unknown>
    : {};
  const items: Record<string, number> = {};
  for (const [id, levelValue] of Object.entries(itemsRaw)) {
    const maxLevel = ITEM_MAX_LEVEL[id];
    if (maxLevel === undefined) throw new Error(`unknown item: ${id}`);
    const level = toNonNegativeInt(levelValue, `items.${id}`, maxLevel);
    if (level > maxLevel) throw new Error(`items.${id} exceeds max level`);
    if (level > 0) items[id] = level;
  }

  const statsRaw = (raw.stats && typeof raw.stats === 'object' && !Array.isArray(raw.stats))
    ? raw.stats as Record<string, unknown>
    : {};
  const ticketsRaw = (raw.ocaTickets && typeof raw.ocaTickets === 'object' && !Array.isArray(raw.ocaTickets))
    ? raw.ocaTickets as Record<string, unknown>
    : {};
  const ocaTickets: Record<string, number> = {};
  for (const type of ALLOWED_TICKET_TYPES) {
    ocaTickets[type] = toNonNegativeInt(ticketsRaw[type], `ocaTickets.${type}`, MAX_TICKETS);
  }

  const dailyRaw = (raw.dailyQuest && typeof raw.dailyQuest === 'object' && !Array.isArray(raw.dailyQuest))
    ? raw.dailyQuest as Record<string, unknown>
    : {};
  const streak = toNonNegativeInt(dailyRaw.streak, 'dailyQuest.streak', 7);
  const claimed = normalizeDayArray(dailyRaw.claimed);

  return {
    coins: toNonNegativeInt(raw.coins, 'coins', MAX_COINS),
    items,
    stats: {
      totalKO: toNonNegativeInt(statsRaw.totalKO, 'stats.totalKO', MAX_SCORE),
      maxCombo: toNonNegativeInt(statsRaw.maxCombo, 'stats.maxCombo', MAX_SCORE),
      highScore: toNonNegativeInt(statsRaw.highScore, 'stats.highScore', MAX_SCORE),
    },
    ownedSkins: normalizeStringArray(raw.ownedSkins, ['default'], 'ownedSkins', 128),
    ownedArenas: normalizeStringArray(raw.ownedArenas, ['default'], 'ownedArenas', 128),
    activeSkin: typeof raw.activeSkin === 'string' ? raw.activeSkin : 'default',
    activeArena: typeof raw.activeArena === 'string' ? raw.activeArena : 'default',
    quitPenalty: false,
    savedCards: raw.savedCards === null || raw.savedCards === undefined
      ? null
      : normalizeStringArray(raw.savedCards, [], 'savedCards', 3),
    unlockedCards: normalizeStringArray(raw.unlockedCards, ['po', 'lu', 'fa', 'co', 'pp'], 'unlockedCards', MAX_UNLOCKED_CARDS),
    gamesCompleted: toNonNegativeInt(raw.gamesCompleted, 'gamesCompleted', MAX_SCORE),
    ocaTickets,
    dailyQuest: {
      weekKey: typeof dailyRaw.weekKey === 'string' ? dailyRaw.weekKey.slice(0, 16) : '',
      streak,
      lastClaimDate: typeof dailyRaw.lastClaimDate === 'string' ? dailyRaw.lastClaimDate.slice(0, 16) : '',
      claimed,
    },
    cloudPlayerId: typeof raw.cloudPlayerId === 'string' ? raw.cloudPlayerId.slice(0, 32) : null,
  };
}

function validateRewardDelta(saveData: ReturnType<typeof validateAndNormalizeSave>, previousSave: unknown, action: string) {
  if (!previousSave) return;
  const prev = validateAndNormalizeSave(previousSave);
  const coinDelta = saveData.coins - prev.coins;
  if (coinDelta < 0) return;
  const maxCoinDeltaByAction: Record<string, number> = {
    game_end: 50_000,
    oca_dupe: 25_000,
    daily_reward: 0,
    oca_drop: 0,
    autosave: 50_000,
    cloud_upload: 50_000,
    cloud_download: MAX_COINS,
  };
  const maxDelta = maxCoinDeltaByAction[action] ?? 50_000;
  if (coinDelta > maxDelta) throw new Error('reward exceeds server rule');
  for (const type of ALLOWED_TICKET_TYPES) {
    const ticketDelta = saveData.ocaTickets[type] - prev.ocaTickets[type];
    if (ticketDelta > 10) throw new Error(`ocaTickets.${type} reward exceeds server rule`);
  }
}

async function getHmacKey() {
  const secret = Deno.env.get('SAVE_HMAC_SECRET');
  if (!secret || secret.length < 32) throw new Error('SAVE_HMAC_SECRET is not configured');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function signSave(saveData: unknown) {
  const key = await getHmacKey();
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(canonicalJson(saveData)));
  return toHex(mac);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method === 'GET') return jsonResponse({ ok: true, function: 'save-sign' });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);

  try {
    const body = await req.json();
    const action = typeof body.action === 'string' ? body.action : 'autosave';
    const saveData = validateAndNormalizeSave(body.save_data);
    validateRewardDelta(saveData, body.previous_save, action);
    const signature = await signSave(saveData);

    if (body.signature !== undefined) {
      const valid = typeof body.signature === 'string' && body.signature === signature;
      if (!valid) return jsonResponse({ valid: false, error: 'invalid signature' }, 401);
      return jsonResponse({ valid: true, save_data: saveData, signature });
    }

    return jsonResponse({ save_data: saveData, signature });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return jsonResponse({ error: message }, 400);
  }
});
