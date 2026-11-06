export type Tile = number;
export type Seat = { name: string; token: string | null; bot: boolean; hand: Tile[]; avatar?: string };
export type Reaction = { emoji: string; at: number };
export type Discard = { tile: Tile; by: number; taken?: boolean };
export type LastMove = { id: number; seat: number; tile: Tile; source: "wall" | "discard" | null; at: number };
export type Game = {
  code: string; host: string; ownerKey?: string; phase: "lobby" | "playing" | "finished";
  seats: Seat[]; wall: Tile[]; indicator: Tile | null; jokerColor: number; jokerNumber: number;
  turn: number; stage: "draw" | "discard"; lastDiscard: { tile: Tile; by: number } | null;
  discards: Discard[]; winner: number | null; result: string; lastMove?: LastMove | null;
  reactions?: Record<number, Reaction>;
  event: string; revision: number; updatedAt: number;
};

export const COLORS = ["Kırmızı", "Mavi", "Sarı", "Siyah"];
export const AVATARS = ["avatar-1", "avatar-2", "avatar-3", "avatar-4", "avatar-5", "avatar-6", "avatar-7", "avatar-8"] as const;
export const EMOJIS = ["😀", "😎", "😂", "🤔", "👏", "🔥", "😅", "👀"] as const;
export function info(tile: Tile, game: Pick<Game, "jokerColor" | "jokerNumber">) {
  if (tile >= 104) return { color: game.jokerColor, number: game.jokerNumber, falseJoker: true, joker: false };
  const color = Math.floor((tile % 52) / 13);
  const number = (tile % 13) + 1;
  return { color, number, falseJoker: false, joker: color === game.jokerColor && number === game.jokerNumber };
}
export function shuffle(a: Tile[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function newGame(code: string, name: string, token: string, avatar: string = "avatar-3"): Game {
  return {
    code, host: token, phase: "lobby", seats: [{ name, token, bot: false, hand: [], avatar }],
    wall: [], indicator: null, jokerColor: 0, jokerNumber: 1, turn: 0, stage: "discard",
    lastDiscard: null, discards: [], winner: null, result: "", lastMove: null, reactions: {}, event: "Oda hazır. Davet bağlantısını paylaş.",
    revision: 0, updatedAt: Date.now()
  };
}
export function start(game: Game) {
  while (game.seats.length < 4) game.seats.push({ name: `Bot ${game.seats.length + 1}`, token: null, bot: true, hand: [], avatar: `avatar-${game.seats.length + 3}` });
  const wall = shuffle(Array.from({ length: 106 }, (_, i) => i));
  const indicatorIndex = wall.findIndex(t => t < 104);
  game.indicator = wall.splice(indicatorIndex, 1)[0];
  const indicator = info(game.indicator, game);
  game.jokerColor = indicator.color;
  game.jokerNumber = indicator.number === 13 ? 1 : indicator.number + 1;
  game.seats.forEach((s, i) => { s.hand = wall.splice(0, i === 0 ? 15 : 14); });
  game.wall = wall;
  game.discards = [];
  game.lastDiscard = null;
  game.winner = null;
  game.result = "";
  game.lastMove = null;
  game.reactions = {};
  game.turn = 0;
  game.stage = "discard";
  game.phase = "playing";
  game.event = "Oyun başladı. İlk oyuncu bir taş atar.";
  game.updatedAt = Date.now();
}
function meld(tiles: Tile[], game: Game) {
  const n = tiles.length;
  if (n < 3 || n > 13) return false;
  const bits = tiles.map(t => info(t, game));
  const fixed = bits.filter(x => !x.joker);
  if (fixed.length === 0) return true;
  if (n <= 4 && fixed.every(x => x.number === fixed[0].number) &&
      new Set(fixed.map(x => x.color)).size === fixed.length) return true;
  if (fixed.some(x => x.color !== fixed[0].color)) return false;
  const nums = fixed.map(x => x.number);
  if (new Set(nums).size !== nums.length) return false;
  for (let first = 1; first <= 14 - n; first++) {
    const seq = Array.from({ length: n }, (_, i) => first + i);
    if (nums.every(x => seq.includes(x))) return true;
  }
  // A run may end with 1 after 13, but it cannot continue with 2.
  const wrapStart = 15 - n;
  const wrap = Array.from({ length: n }, (_, i) => i === n - 1 ? 1 : wrapStart + i);
  if (nums.every(x => wrap.includes(x))) return true;
  return false;
}
function pairs(hand: Tile[], game: Game) {
  const count = new Map<string, number>();
  let wild = 0;
  for (const tile of hand) {
    const x = info(tile, game);
    if (x.joker) { wild++; continue; }
    const key = `${x.color}-${x.number}`;
    count.set(key, (count.get(key) || 0) + 1);
  }
  let singles = 0;
  for (const n of count.values()) singles += n % 2;
  return wild >= singles;
}
export function isWinning(hand: Tile[], game: Game) {
  if (hand.length !== 14) return false;
  if (pairs(hand, game)) return true;
  const cache = new Map<string, boolean>();
  function search(rest: Tile[]): boolean {
    if (!rest.length) return true;
    const key = rest.slice().sort((a, b) => a - b).join(",");
    if (cache.has(key)) return cache.get(key)!;
    const first = rest[0];
    for (let size = 3; size <= Math.min(rest.length, 13); size++) {
      if (rest.length - size === 1 || rest.length - size === 2) continue;
      function choose(start: number, chosen: number[]) {
        if (chosen.length === size - 1) {
          const picked = [first, ...chosen.map(i => rest[i])];
          if (!meld(picked, game)) return false;
          const remove = new Set([0, ...chosen]);
          return search(rest.filter((_, i) => !remove.has(i)));
        }
        for (let i = start; i <= rest.length - (size - 1 - chosen.length); i++) {
          if (choose(i + 1, [...chosen, i])) return true;
        }
        return false;
      }
      if (choose(1, [])) { cache.set(key, true); return true; }
    }
    cache.set(key, false);
    return false;
  }
  return search(hand);
}
function value(tile: Tile, hand: Tile[], game: Game) {
  const x = info(tile, game);
  if (x.joker) return 100;
  let score = 0;
  for (const other of hand) {
    if (other === tile) continue;
    const y = info(other, game);
    if (y.joker) { score += 1; continue; }
    if (x.color === y.color && x.number === y.number) score += 5;
    else if (x.number === y.number && x.color !== y.color) score += 3;
    else if (x.color === y.color && Math.abs(x.number - y.number) === 1) score += 4;
    else if (x.color === y.color && Math.abs(x.number - y.number) === 2) score += 1;
  }
  return score;
}
function botDiscard(game: Game, seatIndex: number) {
  const hand = game.seats[seatIndex].hand;
  for (const tile of hand) {
    if (isWinning(hand.filter(t => t !== tile), game)) return tile;
  }
  let best = 0;
  for (let i = 1; i < hand.length; i++) {
    if (value(hand[i], hand, game) < value(hand[best], hand, game)) best = i;
  }
  return hand[best];
}
export function discard(game: Game, seatIndex: number, tile: Tile) {
  if (game.phase !== "playing" || game.turn !== seatIndex || game.stage !== "discard") throw Error("Şimdi taş atamazsın.");
  const hand = game.seats[seatIndex].hand;
  const at = hand.indexOf(tile);
  if (at < 0) throw Error("Bu taş elinde yok.");
  hand.splice(at, 1);
  game.discards.push({ tile, by: seatIndex });
  game.lastDiscard = { tile, by: seatIndex };
  game.lastMove = { id: game.revision + 1, seat: seatIndex, tile, source: null, at: Date.now() };
  if (isWinning(hand, game)) {
    game.phase = "finished"; game.winner = seatIndex;
    const winner = game.seats[seatIndex].name;
    const jokes = [
      `${winner} eli bitirdi! Masadakiler hâlâ eksik taşı arıyor.`,
      `${winner} kazandı! Istakalar kısa bir sessizliğe büründü.`,
      `${winner} bitirdi! Son taşı görenler bir daha sayıyor.`,
      `${winner} masayı topladı! Diğerleri 'bir el daha' diyor.`
    ];
    game.result = jokes[Math.floor(Math.random() * jokes.length)];
    game.event = game.result;
  } else {
    game.turn = (seatIndex + 1) % 4;
    game.stage = "draw";
    game.event = `${game.seats[seatIndex].name} taş attı.`;
  }
  game.updatedAt = Date.now();
}
export function draw(game: Game, seatIndex: number, source: "wall" | "discard") {
  if (game.phase !== "playing" || game.turn !== seatIndex || game.stage !== "draw") throw Error("Şimdi taş çekemezsin.");
  let tile: Tile | undefined;
  if (source === "discard") {
    if (!game.lastDiscard || game.lastDiscard.by !== (seatIndex + 3) % 4) throw Error("Alınabilecek taş yok.");
    tile = game.lastDiscard.tile;
    const last = game.discards[game.discards.length - 1];
    if (last && last.tile === tile && last.by === game.lastDiscard.by) last.taken = true;
    game.lastDiscard = null;
  } else {
    tile = game.wall.pop();
    if (tile === undefined) {
      game.phase = "finished"; game.result = "Taşlar bitti. El berabere.";
      game.event = game.result; game.updatedAt = Date.now(); return;
    }
  }
  game.seats[seatIndex].hand.push(tile);
  game.stage = "discard";
  game.event = `${game.seats[seatIndex].name} taş çekti.`;
  game.updatedAt = Date.now();
}
export function advanceBot(game: Game) {
  if (game.phase !== "playing" || !game.seats[game.turn]?.bot) throw Error("Sıra botta değil.");
  const seat = game.turn;
  let source: "wall" | "discard" | null = null;
  if (game.stage === "draw") {
    const offered = game.lastDiscard?.tile;
    const hand = game.seats[seat].hand;
    const take = offered !== undefined && game.lastDiscard?.by === (seat + 3) % 4 &&
      value(offered, [...hand, offered], game) >= 5;
    source = take ? "discard" : "wall";
    draw(game, seat, source);
    if (game.phase !== "playing") return;
  }
  discard(game, seat, botDiscard(game, seat));
  if (game.lastMove) game.lastMove.source = source;
}
export function view(game: Game, token: string | null) {
  const me = game.seats.findIndex(s => s.token !== null && s.token === token);
  return {
    code: game.code, phase: game.phase, seats: game.seats.map((s, i) => ({
      name: s.name, bot: s.bot, avatar: s.avatar || `avatar-${(i % 6) + 3}`, count: s.hand.length, hand: i === me ? s.hand : undefined
    })),
    me, host: token !== null && token === game.host, indicator: game.indicator,
    jokerColor: game.jokerColor, jokerNumber: game.jokerNumber, turn: game.turn,
    stage: game.stage, lastDiscard: game.lastDiscard,
    discardPiles: game.seats.map((_, seat) => game.discards.filter(d => d.by === seat && !d.taken).slice(-3).map(d => d.tile)),
    lastMove: game.lastMove || null,
    wallCount: game.wall.length, winner: game.winner, result: game.result,
    reactions: game.reactions || {}, event: game.event, revision: game.revision
  };
}
