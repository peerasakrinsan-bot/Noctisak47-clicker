declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

type SaveData = ReturnType<typeof validateAndNormalizeSave>;

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

function validateRewardDelta(saveData: SaveData, previousSave: unknown, action: string) {
  const prev = validateAndNormalizeSave(previousSave);
  const coinDelta = saveData.coins - prev.coins;
  if (coinDelta < 0) return;
  const maxCoinDeltaByAction: Record<string, number> = {
    game_end: 50_000,
    oca_dupe: 25_000,
    daily_reward: 0,
    oca_drop: 0,
    autosave: 50_000,
    cloud_bind: 0,
    cloud_upload: 50_000,
  };
  const maxDelta = maxCoinDeltaByAction[action] ?? 50_000;
  if (coinDelta > maxDelta) throw new Error('reward exceeds server rule');
  for (const type of ALLOWED_TICKET_TYPES) {
    const ticketDelta = saveData.ocaTickets[type] - prev.ocaTickets[type];
    if (ticketDelta > 10) throw new Error(`ocaTickets.${type} reward exceeds server rule`);
  }
}

function isBootstrapSave(saveData: SaveData) {
  return saveData.coins === 0
    && Object.keys(saveData.items).length === 0
    && saveData.stats.totalKO === 0
    && saveData.stats.maxCombo === 0
    && saveData.stats.highScore === 0
    && saveData.gamesCompleted === 0
    && ALLOWED_TICKET_TYPES.every((type) => saveData.ocaTickets[type] === 0);
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

async function verifySaveSignature(saveData: unknown, signature: unknown) {
  return typeof signature === 'string' && signature === await signSave(saveData);
}

async function authorizeSigning(saveData: SaveData, body: Record<string, unknown>, action: string) {
  if (action === 'bootstrap') {
    if (!isBootstrapSave(saveData)) throw new Error('bootstrap can only sign a new empty save');
    return;
  }
  if (!body.previous_save || !await verifySaveSignature(validateAndNormalizeSave(body.previous_save), body.previous_signature)) {
    throw new Error('trusted previous signature required');
  }
  validateRewardDelta(saveData, body.previous_save, action);
}

function requireServiceConfig() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY is not configured');
  return { url, serviceKey };
}

function validatePlayerId(value: unknown) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9_]{3,32}$/.test(id)) throw new Error('invalid player_id');
  return id;
}

function validateCloudSecret(value: unknown) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(key)) throw new Error('invalid secret_key');
  return key;
}

async function supabaseRest(path: string, init: RequestInit = {}) {
  const { url, serviceKey } = requireServiceConfig();
  const headers = new Headers(init.headers || {});
  headers.set('apikey', serviceKey);
  headers.set('Authorization', `Bearer ${serviceKey}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers });
  const text = await res.text().catch(() => '');
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch (_error) { data = text; }
  if (!res.ok) throw new Error(`cloud_saves ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

async function handleCloudUpload(body: Record<string, unknown>) {
  const playerId = validatePlayerId(body.player_id);
  const secretKey = validateCloudSecret(body.secret_key);
  const saveData = validateAndNormalizeSave({ ...(body.save_data as Record<string, unknown> || {}), cloudPlayerId: playerId });
  await authorizeSigning(saveData, body, 'cloud_upload');
  const signature = await signSave(saveData);
  const uploadedAt = new Date().toISOString();

  const existing = await supabaseRest(`cloud_saves?player_id=eq.${encodeURIComponent(playerId)}&select=secret_key&limit=1`, {
    headers: { Accept: 'application/json' },
  }) as Array<{ secret_key?: string }>;
  const row = existing && existing[0];
  if (row && row.secret_key !== secretKey) return jsonResponse({ error: 'player_id already exists' }, 409);

  const payload = JSON.stringify({
    player_id: playerId,
    secret_key: secretKey,
    save_data: saveData,
    signature,
    uploaded_at: uploadedAt,
  });

  if (row) {
    await supabaseRest(`cloud_saves?player_id=eq.${encodeURIComponent(playerId)}&secret_key=eq.${encodeURIComponent(secretKey)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: payload,
    });
  } else {
    await supabaseRest('cloud_saves', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: payload,
    });
  }

  return jsonResponse({ save_data: saveData, signature, uploaded_at: uploadedAt });
}

async function handleCloudDownload(body: Record<string, unknown>) {
  const playerId = validatePlayerId(body.player_id);
  const secretKey = validateCloudSecret(body.secret_key);
  const rows = await supabaseRest(`cloud_saves?player_id=eq.${encodeURIComponent(playerId)}&secret_key=eq.${encodeURIComponent(secretKey)}&select=save_data,signature,uploaded_at&limit=1`, {
    headers: { Accept: 'application/json' },
  }) as Array<{ save_data?: unknown; signature?: string; uploaded_at?: string }>;
  if (!rows || rows.length === 0) return jsonResponse({ error: 'save not found' }, 404);

  const saveData = validateAndNormalizeSave({ ...((rows[0].save_data as Record<string, unknown>) || {}), cloudPlayerId: playerId });
  const existingSignature = rows[0].signature;
  if (existingSignature && !await verifySaveSignature(saveData, existingSignature)) {
    return jsonResponse({ error: 'cloud save signature is invalid' }, 409);
  }

  const signature = existingSignature || await signSave(saveData);
  if (!existingSignature) {
    await supabaseRest(`cloud_saves?player_id=eq.${encodeURIComponent(playerId)}&secret_key=eq.${encodeURIComponent(secretKey)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ save_data: saveData, signature, uploaded_at: rows[0].uploaded_at || new Date().toISOString() }),
    });
  }

  return jsonResponse({ save_data: saveData, signature, uploaded_at: rows[0].uploaded_at || null });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method === 'GET') return jsonResponse({ ok: true, function: 'save-sign' });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);

  try {
    const body = await req.json() as Record<string, unknown>;
    if (body.cloud_action === 'upload') return await handleCloudUpload(body);
    if (body.cloud_action === 'download') return await handleCloudDownload(body);

    const action = typeof body.action === 'string' ? body.action : 'autosave';
    const saveData = validateAndNormalizeSave(body.save_data);
    const signature = await signSave(saveData);

    if (body.signature !== undefined) {
      const valid = typeof body.signature === 'string' && body.signature === signature;
      if (!valid) return jsonResponse({ valid: false, error: 'invalid signature' }, 401);
      return jsonResponse({ valid: true, save_data: saveData, signature });
    }

    await authorizeSigning(saveData, body, action);
    return jsonResponse({ save_data: saveData, signature });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = /required|not configured/i.test(message) ? 500 : 400;
    return jsonResponse({ error: message }, status);
  }
});
