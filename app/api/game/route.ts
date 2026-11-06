import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { roomOwners, rooms } from "../../../db/schema";
import { AVATARS, EMOJIS, advanceBot, discard, draw, newGame, start, view, type Game } from "../../../lib/game";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}
function code() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), n => alphabet[n % alphabet.length]).join("");
}
function nameOf(input: unknown) {
  const name = String(input || "").trim().replace(/\s+/g, " ").slice(0, 20);
  if (name.length < 2) throw Error("İsim en az 2 karakter olmalı.");
  return name;
}
function avatarOf(input: unknown) {
  const avatar = input === undefined || input === null || input === "" ? "avatar-3" : String(input);
  if (!AVATARS.includes(avatar as typeof AVATARS[number])) throw Error("Avatar seçimi geçersiz.");
  return avatar;
}
function ownerKeyOf(input: unknown) {
  const value = String(input || "");
  if (!/^[a-f0-9-]{72}$/i.test(value)) throw Error("Oda sahibi anahtarı geçersiz.");
  return value;
}
function roomCode(input: unknown) {
  const value = String(input || "").trim().toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(value)) throw Error("Oda kodu geçersiz.");
  return value;
}
async function getRoom(room: string) {
  const rows = await getDb().select().from(rooms).where(eq(rooms.code, room)).limit(1);
  return rows[0] || null;
}
async function isActiveRoom(game: Game) {
  if (!game.ownerKey) return true;
  const rows = await getDb().select({ activeCode: roomOwners.activeCode }).from(roomOwners)
    .where(eq(roomOwners.ownerKey, game.ownerKey)).limit(1);
  return rows.length > 0 && rows[0].activeCode === game.code;
}
function closedRoom() {
  return reply({ error: "Bu oda bağlantısı kapandı. Yeni oda bağlantısını iste.", closed: true }, 410);
}
export async function GET(request: NextRequest) {
  try {
    const room = roomCode(request.nextUrl.searchParams.get("room"));
    const row = await getRoom(room);
    if (!row) return closedRoom();
    const game = JSON.parse(row.state) as Game;
    if (!await isActiveRoom(game)) return closedRoom();
    const token = request.headers.get("x-player-token");
    return reply(view(game, token));
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "İstek başarısız." }, 400);
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    if (action === "create") {
      const name = nameOf(body.name);
      const avatar = avatarOf(body.avatar);
      const ownerKey = ownerKeyOf(body.ownerKey);
      const token = crypto.randomUUID() + crypto.randomUUID();
      const previous = await getDb().select({ activeCode: roomOwners.activeCode }).from(roomOwners)
        .where(eq(roomOwners.ownerKey, ownerKey)).limit(1);
      const oldCodes = new Set(previous.map(x => x.activeCode));
      const previousRooms = Array.isArray(body.previousRooms) ? body.previousRooms.slice(0, 100) : [];
      const known = new Map<string, string>();
      for (const entry of previousRooms) {
        if (!entry || typeof entry !== "object") continue;
        const item = entry as Record<string, unknown>;
        const knownCode = String(item.code || "").toUpperCase();
        const knownToken = String(item.token || "");
        if (/^[A-Z2-9]{8}$/.test(knownCode) && knownToken.length <= 128) known.set(knownCode, knownToken);
      }
      if (known.size) {
        const oldRows = await getDb().select().from(rooms).where(inArray(rooms.code, [...known.keys()]));
        for (const old of oldRows) {
          if ((JSON.parse(old.state) as Game).host === known.get(old.code)) oldCodes.add(old.code);
        }
      }
      let created: Game | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const room = code();
        const game = newGame(room, name, token, avatar);
        game.ownerKey = ownerKey;
        try {
          await getDb().insert(rooms).values({ code: room, state: JSON.stringify(game), revision: 0, updatedAt: Date.now() });
          created = game;
          break;
        } catch (error) {
          if (attempt === 3) throw error;
        }
      }
      if (!created) throw Error("Oda oluşturulamadı.");
      try {
        await getDb().insert(roomOwners).values({ ownerKey, activeCode: created.code, updatedAt: Date.now() })
          .onConflictDoUpdate({ target: roomOwners.ownerKey, set: { activeCode: created.code, updatedAt: Date.now() } });
      } catch (error) {
        await getDb().delete(rooms).where(eq(rooms.code, created.code));
        throw error;
      }
      for (const oldCode of oldCodes) {
        if (oldCode !== created.code) await getDb().delete(rooms).where(eq(rooms.code, oldCode));
      }
      return reply({ ...view(created, token), token });
    }
    const room = roomCode(body.room);
    const token = String(body.token || "");
    for (let attempt = 0; attempt < 4; attempt++) {
      const row = await getRoom(room);
      if (!row) return closedRoom();
      if (action === "bot-step" && Number(body.expectedRevision) !== row.revision) return reply({ error: "Masa güncellendi." }, 409);
      const game = JSON.parse(row.state) as Game;
      if (!await isActiveRoom(game)) return closedRoom();
      if (action === "join") {
        if (game.phase !== "lobby") throw Error("Oyun başladı; bu odaya yeni oyuncu katılamaz.");
        if (game.seats.length >= 4) throw Error("Oda dolu.");
        const name = nameOf(body.name);
        const avatar = avatarOf(body.avatar);
        const playerToken = crypto.randomUUID() + crypto.randomUUID();
        game.seats.push({ name, token: playerToken, bot: false, hand: [], avatar });
        game.event = `${name} odaya katıldı.`;
        game.revision = row.revision + 1;
        game.updatedAt = Date.now();
        const result = await getDb().update(rooms).set({ state: JSON.stringify(game), revision: game.revision, updatedAt: game.updatedAt })
          .where(and(eq(rooms.code, room), eq(rooms.revision, row.revision))).returning({ code: rooms.code });
        if (result.length) return reply({ ...view(game, playerToken), token: playerToken });
        continue;
      }
      const me = game.seats.findIndex(s => s.token !== null && s.token === token);
      if (me < 0) return reply({ error: "Oyuncu oturumu bulunamadı. Kendi bağlantınla yeniden gir." }, 403);
      if (action === "start" || action === "restart") {
        if (token !== game.host) throw Error("Oyunu oda sahibi başlatabilir.");
        if (action === "start" && game.phase !== "lobby") throw Error("Oyun zaten başladı.");
        if (action === "restart" && game.phase !== "finished") throw Error("El henüz bitmedi.");
        game.seats = game.seats.filter(s => !s.bot);
        start(game);
      } else if (action === "draw") {
        draw(game, me, body.source === "discard" ? "discard" : "wall");
      } else if (action === "discard") {
        const tile = Number(body.tile);
        if (!Number.isInteger(tile) || tile < 0 || tile > 105) throw Error("Taş geçersiz.");
        discard(game, me, tile);
      } else if (action === "bot-step") {
        advanceBot(game);
      } else if (action === "react") {
        if (game.phase !== "playing") throw Error("Emoji yalnızca oyun sırasında gönderilebilir.");
        const emoji = String(body.emoji || "");
        if (!EMOJIS.includes(emoji as typeof EMOJIS[number])) throw Error("Emoji geçersiz.");
        game.reactions ||= {};
        if (Date.now() - (game.reactions[me]?.at || 0) < 900) throw Error("Biraz bekleyip tekrar gönder.");
        game.reactions[me] = { emoji, at: Date.now() };
      } else {
        throw Error("Bilinmeyen işlem.");
      }
      game.revision = row.revision + 1;
      game.updatedAt = Date.now();
      const result = await getDb().update(rooms).set({ state: JSON.stringify(game), revision: game.revision, updatedAt: game.updatedAt })
        .where(and(eq(rooms.code, room), eq(rooms.revision, row.revision))).returning({ code: rooms.code });
      if (result.length) return reply(view(game, token));
    }
    return reply({ error: "Masa aynı anda değişti. Tekrar dene." }, 409);
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "İstek başarısız." }, 400);
  }
}
