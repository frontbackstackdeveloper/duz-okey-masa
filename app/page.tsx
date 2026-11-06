"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { arrangeRack, emptyRack, moveRackTile, reconcileRack, RACK_COLUMNS, type RackLayout } from "../lib/rack";
import "./okey.css";

type SeatView = { name: string; bot: boolean; avatar: string; count: number; hand?: number[] };
type Reaction = { emoji: string; at: number };
type LastMove = { id: number; seat: number; tile: number; source: "wall" | "discard" | null; at: number };
type GameView = {
  code: string; phase: "lobby" | "playing" | "finished"; seats: SeatView[];
  me: number; host: boolean; indicator: number | null; jokerColor: number; jokerNumber: number;
  turn: number; stage: "draw" | "discard"; lastDiscard: { tile: number; by: number } | null;
  discardPiles: number[][]; lastMove: LastMove | null; wallCount: number; winner: number | null;
  result: string; event: string; revision: number; reactions: Record<number, Reaction>; token?: string;
};
type DragSource = { kind: "rack"; tile: number; slot: number } | { kind: "wall" | "discard" };
type DragState = DragSource & { x: number; y: number };
type Flight = { tile: number; x: number; y: number; dx: number; dy: number; hidden?: boolean };
const COLOR_NAMES = ["kırmızı", "mavi", "sarı", "siyah"];
const EMOJIS = ["😀", "😎", "😂", "🤔", "👏", "🔥", "😅", "👀"];
const AVATARS = [
  { id: "avatar-1", label: "Çizim 1", src: "/avatars/avatar-1.svg" },
  { id: "avatar-2", label: "Çizim 2", src: "/avatars/avatar-2.svg" },
  ...Array.from({ length: 6 }, (_, i) => ({ id: `avatar-${i + 3}`, label: `Çizim ${i + 1}`, src: `/avatars/avatar-${i + 3}.svg` }))
];
function avatarSrc(id: string) {
  const currentId = id === "photo-1" ? "avatar-1" : id === "photo-2" ? "avatar-2" : id;
  return AVATARS.find(a => a.id === currentId)?.src || "/avatars/avatar-3.svg";
}
function Avatar({ id, name, className = "" }: { id: string; name: string; className?: string }) {
  return <img className={`avatar-image ${className}`} src={avatarSrc(id)} alt={name} />;
}
function tileInfo(tile: number, game: GameView) {
  if (tile >= 104) return { color: game.jokerColor, number: game.jokerNumber, falseJoker: true, joker: false };
  const color = Math.floor((tile % 52) / 13);
  const number = tile % 13 + 1;
  return { color, number, falseJoker: false, joker: color === game.jokerColor && number === game.jokerNumber };
}
function Tile({ tile, game, selected, small = false, hidden = false, indicator = false, fresh = false, dragging = false, onClick, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, tileData }: {
  tile?: number; game: GameView; selected?: boolean; small?: boolean; hidden?: boolean; indicator?: boolean; fresh?: boolean; dragging?: boolean;
  onClick?: () => void; onPointerDown?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove?: (e: ReactPointerEvent<HTMLButtonElement>) => void; onPointerUp?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (e: ReactPointerEvent<HTMLButtonElement>) => void; tileData?: number;
}) {
  const x = tile === undefined ? null : tileInfo(tile, game);
  return <button type="button" draggable={false} onDragStart={e => e.preventDefault()} onClick={onClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
    onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} data-rack-tile-id={tileData}
    disabled={!onClick && !onPointerDown}
    className={`stone ${small ? "stone-small" : ""} ${hidden ? "stone-back" : ""} ${indicator ? "stone-indicator" : ""} ${selected ? "stone-selected" : ""} ${fresh ? "stone-fresh" : ""} ${dragging ? "stone-drag-origin" : ""} ${x ? COLOR_NAMES[x.color] : ""} ${x?.joker ? "stone-joker" : ""} ${x?.falseJoker ? "stone-false" : ""}`}
    title={x?.falseJoker ? `Sahte okey: normal ${COLOR_NAMES[x.color]} ${x.number} sayılır` : x?.joker ? `Gerçek okey: ${COLOR_NAMES[x.color]} ${x.number}, her taşın yerine geçer` : undefined}
    aria-label={hidden ? "Kapalı taş" : x ? (indicator ? `Gösterge, ${COLOR_NAMES[x.color]} ${x.number}` : x.falseJoker ? `Sahte okey, normal ${COLOR_NAMES[x.color]} ${x.number} sayılır` : x.joker ? `Gerçek okey, ${COLOR_NAMES[x.color]} ${x.number}` : `${COLOR_NAMES[x.color]} ${x.number}`) : "Taş"}>
    {hidden ? <span className="back-mark">✦</span> : x?.falseJoker
      ? <><span className="false-symbol">★</span><span className="false-label">SAHTE</span></>
      : x ? <><span className="stone-number">{x.number}</span><span className={x.joker ? "okey-label" : indicator ? "indicator-star" : "stone-mark"}>{x.joker ? "OKEY" : indicator ? "★" : "◆"}</span></> : null}
  </button>;
}
function sound(kind: "tap" | "draw" | "win" | "emoji" | "turn") {
  try {
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const notes = kind === "win" ? [523, 659, 784] : kind === "turn" ? [587, 784, 988] : kind === "draw" ? [360, 480] : kind === "emoji" ? [670, 830] : [330];
    notes.forEach((frequency, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = kind === "win" ? "sine" : "triangle";
      osc.frequency.setValueAtTime(frequency, now + i * 0.09);
      gain.gain.setValueAtTime(0.0001, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.055, now + i * 0.09 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.09); osc.stop(now + i * 0.09 + 0.17);
    });
    window.setTimeout(() => void ctx.close(), 700);
  } catch {}
}
function readRack(key: string): RackLayout | null {
  try { return JSON.parse(localStorage.getItem(key) || "null") as RackLayout | null; } catch { return null; }
}
function browserOwnerKey() {
  const saved = localStorage.getItem("okey-owner-key");
  if (saved && /^[a-f0-9-]{72}$/i.test(saved)) return saved;
  const created = crypto.randomUUID() + crypto.randomUUID();
  localStorage.setItem("okey-owner-key", created);
  return created;
}
function knownRoomTokens() {
  const entries: { code: string; token: string }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i) || "";
    const code = key.slice("okey-token-".length);
    if (key.startsWith("okey-token-") && /^[A-Z2-9]{8}$/.test(code)) {
      const token = localStorage.getItem(key);
      if (token) entries.push({ code, token });
    }
  }
  return entries.slice(-100);
}

export default function Home() {
  const [game, setGame] = useState<GameView | null>(null);
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("avatar-3");
  const [rack, setRack] = useState<RackLayout>(emptyRack);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [closedRoom, setClosedRoom] = useState("");
  const [muted, setMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  const [dropThrow, setDropThrow] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [turnAlert, setTurnAlert] = useState("");
  const [botMessage, setBotMessage] = useState("");
  const [freshTile, setFreshTile] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const tokenRef = useRef("");
  const revisionRef = useRef(-1);
  const lastMoveRef = useRef<number | null>(null);
  const turnRef = useRef<{ code: string; me: number; turn: number; phase: string } | null>(null);
  const mutedRef = useRef(false);
  const rackRef = useRef<RackLayout>(emptyRack());
  const rackKeyRef = useRef("");
  const preferredSlotRef = useRef<number | null>(null);
  const pointerRef = useRef<{ source: DragSource; x: number; y: number; active: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 800); return () => window.clearInterval(timer); }, []);

  const persistRack = useCallback((next: RackLayout) => {
    rackRef.current = next; setRack(next);
    if (rackKeyRef.current) localStorage.setItem(rackKeyRef.current, JSON.stringify(next));
  }, []);
  const animateMove = useCallback((data: GameView) => {
    const move = data.lastMove;
    if (!move || move.seat === data.me) return;
    const relative = (move.seat - Math.max(data.me, 0) + 4) % 4;
    const player = document.querySelector(`[data-player-relative="${relative}"]`)?.getBoundingClientRect();
    const dock = document.querySelector(`[data-dock-relative="${relative}"]`)?.getBoundingClientRect();
    if (!player || !dock) return;
    const center = (rect: DOMRect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    const fromPlayer = center(player), toDock = center(dock);
    const name = data.seats[move.seat]?.name || "Oyuncu";
    if (data.seats[move.seat]?.bot && move.source) {
      const previous = (move.seat + 3 - Math.max(data.me, 0) + 4) % 4;
      const sourceEl = move.source === "discard"
        ? document.querySelector(`[data-dock-relative="${previous}"]`)?.getBoundingClientRect()
        : document.querySelector("[data-wall-stack]")?.getBoundingClientRect();
      if (sourceEl) {
        const from = center(sourceEl);
        setBotMessage(`${name} taş çekiyor…`);
        setFlight({ tile: move.tile, hidden: true, x: from.x, y: from.y, dx: fromPlayer.x - from.x, dy: fromPlayer.y - from.y });
      }
      window.setTimeout(() => {
        setBotMessage(`${name} taş attı!`);
        setFlight({ tile: move.tile, x: fromPlayer.x, y: fromPlayer.y, dx: toDock.x - fromPlayer.x, dy: toDock.y - fromPlayer.y });
      }, 380);
      window.setTimeout(() => { setFlight(null); setBotMessage(""); }, 1050);
    } else {
      setBotMessage(`${name} taş attı!`);
      setFlight({ tile: move.tile, x: fromPlayer.x, y: fromPlayer.y, dx: toDock.x - fromPlayer.x, dy: toDock.y - fromPlayer.y });
      window.setTimeout(() => { setFlight(null); setBotMessage(""); }, 600);
    }
  }, []);
  const accept = useCallback((data: GameView) => {
    if (data.token) {
      tokenRef.current = data.token;
      localStorage.setItem(`okey-token-${data.code}`, data.token);
    }
    setClosedRoom("");
    const previousTurn = turnRef.current;
    const myTurnNow = data.phase === "playing" && data.me >= 0 && data.turn === data.me;
    const wasMyTurn = previousTurn?.code === data.code && previousTurn.phase === "playing" && previousTurn.turn === previousTurn.me;
    if (myTurnNow && !wasMyTurn) {
      setTurnAlert(data.stage === "draw" ? "Sıra sende! Taş çek." : "Sıra sende! Taş at.");
      window.setTimeout(() => setTurnAlert(""), 4500);
      if (!mutedRef.current) sound("turn");
    } else if (data.revision > revisionRef.current && revisionRef.current >= 0 && !mutedRef.current) {
      sound(data.phase === "finished" ? "win" : "tap");
    }
    document.title = myTurnNow ? "🔔 Sıra sende | Masa" : "Masa | Düz Okey";
    if (previousTurn?.code !== data.code) lastMoveRef.current = data.lastMove?.id ?? null;
    else if (data.lastMove && data.lastMove.id !== lastMoveRef.current) {
      lastMoveRef.current = data.lastMove.id;
      animateMove(data);
    }
    turnRef.current = { code: data.code, me: data.me, turn: data.turn, phase: data.phase };
    revisionRef.current = data.revision;
    const hand = data.me >= 0 ? data.seats[data.me]?.hand || [] : [];
    const key = `okey-rack-${data.code}-${tokenRef.current.slice(0, 8)}`;
    const previous = rackKeyRef.current === key ? rackRef.current : readRack(key);
    const had = new Set((previous || []).filter((x): x is number => typeof x === "number"));
    const added = hand.find(tile => !had.has(tile));
    const next = reconcileRack(previous, hand, preferredSlotRef.current);
    preferredSlotRef.current = null;
    rackKeyRef.current = key;
    persistRack(next);
    if (data.phase === "playing" && added !== undefined && previous?.some(x => x !== null)) {
      setFreshTile(added);
      window.setTimeout(() => setFreshTile(null), 480);
    }
    setGame(data); setRoom(data.code); setSelected(prev => prev !== null && hand.includes(prev) ? prev : null);
  }, [persistRack, animateMove]);
  const refresh = useCallback(async (roomCode: string) => {
    try {
      const response = await fetch(`/api/game?room=${encodeURIComponent(roomCode)}`, {
        headers: { "x-player-token": tokenRef.current }, cache: "no-store"
      });
      const data = await response.json() as GameView & { error?: string };
      if (response.status === 410) {
        setClosedRoom(roomCode); setGame(null); setRoom("");
        return;
      }
      if (!response.ok) throw Error(data.error || "Oda yüklenemedi.");
      if (data.revision !== revisionRef.current) accept(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Bağlantı hatası."); }
  }, [accept]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("oda")?.toUpperCase() || "";
    setName(localStorage.getItem("okey-name") || "");
    const savedAvatar = localStorage.getItem("okey-avatar") || "avatar-3";
    setAvatar(savedAvatar === "photo-1" ? "avatar-1" : savedAvatar === "photo-2" ? "avatar-2" : savedAvatar);
    if (fromUrl) {
      setRoom(fromUrl);
      tokenRef.current = localStorage.getItem(`okey-token-${fromUrl}`) || "";
      void refresh(fromUrl);
    }
  }, [refresh]);
  useEffect(() => {
    if (!room) return;
    const timer = window.setInterval(() => void refresh(room), 1500);
    return () => window.clearInterval(timer);
  }, [room, refresh]);

  async function send(action: string, extra: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const createContext = action === "create" ? {
        ownerKey: browserOwnerKey(), previousRooms: knownRoomTokens()
      } : {};
      const response = await fetch("/api/game", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, room, token: tokenRef.current, ...extra, ...createContext })
      });
      const data = await response.json() as GameView & { error?: string };
      if (response.status === 410) {
        setClosedRoom(room); setGame(null); setRoom("");
        return;
      }
      if (!response.ok) {
        if (action === "bot-step" && response.status === 409) { void refresh(room); return; }
        throw Error(data.error || "İşlem başarısız.");
      }
      if (action === "create" || action === "join") {
        localStorage.setItem("okey-name", name.trim());
        localStorage.setItem("okey-avatar", avatar);
        window.history.replaceState({}, "", `/?oda=${data.code}`);
      }
      accept(data);
      if (!muted && action === "react") sound("emoji");
    } catch (e) {
      if (action === "draw") preferredSlotRef.current = null;
      setError(e instanceof Error ? e.message : "Bağlantı hatası.");
    }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!game || game.phase !== "playing" || !game.seats[game.turn]?.bot || busy) return;
    const timer = window.setTimeout(() => void send("bot-step", { expectedRevision: game.revision }), 1150);
    return () => window.clearTimeout(timer);
  }, [game?.code, game?.revision, game?.turn, game?.phase, busy]);
  function arrange(by: "color" | "number") {
    if (!game) return;
    const hand = game.me >= 0 ? game.seats[game.me]?.hand || [] : [];
    const compare = (a: number, b: number) => {
      const x = tileInfo(a, game), y = tileInfo(b, game);
      return by === "color" ? x.color - y.color || x.number - y.number : x.number - y.number || x.color - y.color;
    };
    persistRack(arrangeRack(hand, compare));
    if (!muted) sound("tap");
  }
  function moveTile(from: number, to: number) {
    if (from === to) return;
    persistRack(moveRackTile(rackRef.current, from, to));
    if (!muted) sound("tap");
  }
  function throwTile(tile: number, x?: number, y?: number) {
    if (!game || game.phase !== "playing" || game.me !== game.turn || game.stage !== "discard" || busy) return;
    const source = document.querySelector(`[data-rack-tile-id="${tile}"]`)?.getBoundingClientRect();
    const target = document.querySelector("[data-drop-discard]")?.getBoundingClientRect();
    if (target) {
      const startX = x ?? (source ? source.left + source.width / 2 : target.left);
      const startY = y ?? (source ? source.top + source.height / 2 : target.top);
      setFlight({ tile, x: startX, y: startY, dx: target.left + target.width / 2 - startX, dy: target.top + target.height / 2 - startY });
      window.setTimeout(() => setFlight(null), 360);
    }
    if (!muted) sound("tap");
    void send("discard", { tile });
  }
  function pointerDown(e: ReactPointerEvent<HTMLButtonElement>, source: DragSource) {
    if (busy) return;
    pointerRef.current = { source, x: e.clientX, y: e.clientY, active: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const p = pointerRef.current;
    if (!p) return;
    if (!p.active && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 7) return;
    p.active = true;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const slot = under?.closest("[data-rack-slot]")?.getAttribute("data-rack-slot");
    setDropSlot(slot === null || slot === undefined ? null : Number(slot));
    setDropThrow(!!under?.closest("[data-drop-discard]"));
    setDrag({ ...p.source, x: e.clientX, y: e.clientY });
  }
  function pointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const p = pointerRef.current;
    if (!p) return;
    pointerRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const slotAttr = under?.closest("[data-rack-slot]")?.getAttribute("data-rack-slot");
    const slot = slotAttr === null || slotAttr === undefined ? null : Number(slotAttr);
    const toThrow = !!under?.closest("[data-drop-discard]");
    setDrag(null); setDropSlot(null); setDropThrow(false);
    if (!p.active) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClickRef.current = true;
    window.setTimeout(() => { suppressClickRef.current = false; }, 750);
    if (p.source.kind === "rack") {
      if (slot !== null) moveTile(p.source.slot, slot);
      else if (toThrow) throwTile(p.source.tile, e.clientX, e.clientY);
    } else if (slot !== null && game?.phase === "playing" && game.me === game.turn && game.stage === "draw") {
      preferredSlotRef.current = slot;
      void send("draw", { source: p.source.kind });
    }
  }
  function pointerCancel() {
    pointerRef.current = null; setDrag(null); setDropSlot(null); setDropThrow(false);
  }
  function clickTile(tile: number) {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    if (game?.phase === "playing" && game.me === game.turn && game.stage === "discard") setSelected(selected === tile ? null : tile);
  }
  function clickDraw(source: "wall" | "discard") {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    if (game?.phase === "playing" && game.me === game.turn && game.stage === "draw") void send("draw", { source });
  }
  async function copyInvite() {
    if (!game) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?oda=${game.code}`);
      setCopied(true); window.setTimeout(() => setCopied(false), 2200);
    } catch { setError("Bağlantı kopyalanamadı. Adres çubuğundaki bağlantıyı paylaş."); }
  }
  const hand = game?.me !== undefined && game.me >= 0 ? game.seats[game.me]?.hand || [] : [];
  const myTurn = !!game && game.phase === "playing" && game.me === game.turn;
  const canDraw = myTurn && game.stage === "draw";
  const canThrow = myTurn && game.stage === "discard";
  return <main className="okey-app">
    <div className="ambience ambience-a" /><div className="ambience ambience-b" />
    <header className="topbar">
      <div className="brand"><span className="brand-icon">✦</span><span><strong>MASA</strong><small>DÜZ OKEY</small></span></div>
      <div className="topbar-right">
        {game && <span className="room-pill">ODA <b>{game.code}</b></span>}
        {myTurn && <span className="turn-pill"><span /> SIRA SENDE</span>}
        <button type="button" className="icon-button" onClick={() => setMuted(!muted)} aria-label={muted ? "Sesi aç" : "Sesi kapat"}>{muted ? "♪̸" : "♪"}</button>
      </div>
    </header>
    {turnAlert && <div className="turn-alert" role="alert" aria-live="assertive"><span>✦</span>{turnAlert}</div>}
    {closedRoom ? <section className="closed-room-wrap"><div className="welcome-card closed-room-card">
      <div className="eyebrow">ODA KAPANDI</div><h1>Bu bağlantı artık aktif değil.</h1>
      <p>{closedRoom} kodlu oda kapanmış. Oda sahibinden yeni bağlantıyı iste veya kendi odanı kur.</p>
      <button className="primary-button" onClick={() => { setClosedRoom(""); window.history.replaceState({}, "", "/"); }}>Yeni oda kur <span>↗</span></button>
    </div></section> : !game || game.me < 0 ? <section className="welcome-wrap">
      <div className="welcome-art" aria-hidden="true"><span className="art-tile art-one">7</span><span className="art-tile art-two">8</span><span className="art-tile art-three">9</span><span className="art-star">✦</span></div>
      <div className="welcome-card">
        <div className="eyebrow">ARKADAŞLARLA OKEY GECESİ</div>
        <h1>Taşlar hazır.<br /><em>Masa seni bekliyor.</em></h1>
        <p>İsmini ve avatarını seç, odanı kur, bağlantıyı arkadaşlarına gönder. Eksik koltuklara botlar otursun.</p>
        <label htmlFor="player-name">OYUNCU ADIN</label>
        <input id="player-name" value={name} maxLength={20} onChange={e => setName(e.target.value)} placeholder="İsmini yaz" autoComplete="nickname" />
        <div className="avatar-picker-heading">AVATARINI SEÇ <span>8 seçenek</span></div>
        <div className="avatar-picker" role="group" aria-label="Avatar seçimi">
          {AVATARS.map(option => <button type="button" key={option.id} className={`avatar-option ${avatar === option.id ? "chosen" : ""}`} onClick={() => setAvatar(option.id)} aria-label={option.label} aria-pressed={avatar === option.id}>
            <Avatar id={option.id} name={option.label} /><span>{option.label}</span>
          </button>)}
        </div>
        {room && <div className="join-note">Davet edildiğin oda: <b>{room}</b></div>}
        <div className="welcome-actions">
          {room && <button className="primary-button" disabled={busy} onClick={() => void send("join", { name, avatar })}>Odaya katıl <span>→</span></button>}
          <button className={room ? "secondary-button" : "primary-button"} disabled={busy} onClick={() => void send("create", { name, avatar })}>Yeni oda kur <span>↗</span></button>
        </div>
        <div className="welcome-foot"><span>◉</span> 4 kişilik normal okey · 2 veya 3 kişiyseniz botlarla tamamlanır</div>
        <div className="welcome-foot">Yeni oda kurunca bu tarayıcıda kurduğun önceki odanın bağlantısı kapanır.</div>
      </div>
    </section> : <section className="game-shell">
      {game.phase === "lobby" ? <div className="lobby-card">
        <div className="eyebrow">ODA HAZIR</div><h1>Masayı toplayalım.</h1>
        <p>Arkadaşlarına bağlantıyı gönder. Herkes katılınca başlat; boş koltuklara botlar geçer.</p>
        <div className="invite-row"><code>{typeof window !== "undefined" ? window.location.origin : ""}/?oda={game.code}</code><button onClick={() => void copyInvite()}>{copied ? "Kopyalandı ✓" : "Bağlantıyı kopyala"}</button></div>
        <div className="lobby-seats">{Array.from({ length: 4 }, (_, i) => <div className={`lobby-seat ${game.seats[i] ? "occupied" : ""}`} key={i}>
          {game.seats[i] ? <Avatar id={game.seats[i].avatar} name={game.seats[i].name} /> : <span className="empty-avatar">+</span>}
          <strong>{game.seats[i]?.name || "Boş koltuk"}</strong><small>{game.seats[i] ? (i === 0 ? "Oda sahibi" : "Hazır") : "Bot katılabilir"}</small>
        </div>)}</div>
        {game.host ? <button className="primary-button start-button" disabled={busy} onClick={() => void send("start")}>Oyunu başlat <span>→</span></button> : <div className="waiting"><span className="waiting-dot" /> Oda sahibinin oyunu başlatması bekleniyor</div>}
      </div> : <>
        <div className="table-header"><div><span className="eyebrow">OYUN MASASI</span><h1>{game.phase === "finished" ? game.result : myTurn ? (canDraw ? "Sıra sende · Taş çek" : "Sıra sende · Taş at") : `Sıra ${game.seats[game.turn]?.name || ""} oyuncusunda`}</h1></div><div className="round-meta"><span>DESTEKTE</span><strong>{game.wallCount} taş</strong></div></div>
        <div className="table">
          <div className="table-grain" />
          <div className="table-ornament ornament-one" /><div className="table-ornament ornament-two" />
          {game.seats.map((seat, i) => {
            const reaction = game.reactions?.[i];
            const relative = (i - Math.max(game.me, 0) + 4) % 4;
            return <div key={i} data-player-relative={relative} className={`player player-${relative} ${game.turn === i && game.phase === "playing" ? "player-active" : ""}`}>
              {reaction && now - reaction.at < 5200 && <div key={reaction.at} className="reaction-bubble">{reaction.emoji}</div>}
              <Avatar id={seat.avatar} name={seat.name} />
              <div><strong>{seat.name}{i === game.me ? " (Sen)" : ""}</strong><small>{seat.bot ? "BOT" : `${seat.count} TAŞ`}</small></div>
            </div>;
          })}
          <div className="table-center">
            <div className="indicator-block"><span>GÖSTERGE</span>{game.indicator !== null && <Tile tile={game.indicator} game={game} small indicator />}</div>
            <div className="center-emblem">✦<small>MASA</small></div>
            <div className="wall-block"><span>DESTE</span><div data-wall-stack className={`wall-stack ${canDraw ? "draw-active" : ""}`}>
              <Tile game={game} hidden small />
              <Tile game={game} hidden small onClick={canDraw ? () => clickDraw("wall") : undefined}
                onPointerDown={canDraw ? e => pointerDown(e, { kind: "wall" }) : undefined} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} />
            </div></div>
          </div>
          {game.seats.map((seat, i) => {
            const relative = (i - Math.max(game.me, 0) + 4) % 4;
            const pile = game.discardPiles?.[i] || [];
            const top = pile[pile.length - 1];
            const ownDock = i === game.me;
            const canTake = canDraw && i === (game.me + 3) % 4 && game.lastDiscard?.by === i && game.lastDiscard.tile === top;
            return <div key={i} data-dock-relative={relative} data-drop-discard={ownDock && canThrow ? "true" : undefined}
              className={`discard-dock dock-${relative} ${ownDock && canThrow ? "dock-ready" : ""} ${ownDock && dropThrow ? "dock-over" : ""} ${canTake ? "dock-take" : ""}`}>
              <span className="dock-caption">{ownDock ? "SOLUNDAKİNE AT" : canTake ? "SAĞDAN AL" : `${seat.name} attı`}</span>
              <div className="dock-content">{top !== undefined ? <Tile tile={top} game={game} small onClick={canTake ? () => clickDraw("discard") : undefined}
                onPointerDown={canTake ? e => pointerDown(e, { kind: "discard" }) : undefined} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} />
                : <span className="dock-empty">{ownDock && canThrow ? "↓" : "·"}</span>}
                {pile.length > 1 && <span className="pile-count">{pile.length}</span>}</div>
            </div>;
          })}
          {game.phase === "playing" && (botMessage || game.seats[game.turn]?.bot) && <div className="bot-status" aria-live="polite"><span className="waiting-dot" />{botMessage || `${game.seats[game.turn].name} düşünüyor…`}</div>}
          {game.phase === "finished" && <div className="result-overlay"><div className="result-card"><span>✦ EL SONA ERDİ ✦</span><h2>{game.result}</h2>{game.host && <button className="primary-button" disabled={busy} onClick={() => void send("restart")}>Yeni el başlat →</button>}</div></div>}
        </div>
        <div className="game-bottom">
          <div className="hand-heading"><div><span className="eyebrow">SENİN ISTAKAN</span><strong>{hand.length} taş · iki sırada sürükleyerek diz</strong><small className="joker-guide">Okey: {COLOR_NAMES[game.jokerColor]} {game.jokerNumber} · Yıldızlı sahte okey aynı sayı gibi oynanır.</small></div><div className="sort-actions"><button onClick={() => arrange("color")}>Renklere göre</button><button onClick={() => arrange("number")}>Sayılara göre</button></div></div>
          <div className="rack"><div className="rack-grid">{rack.map((tile, i) => <div key={i} className={`rack-slot ${dropSlot === i ? "rack-slot-over" : ""} ${i >= RACK_COLUMNS ? "rack-slot-bottom" : ""}`} data-rack-slot={i}>
            {tile !== null && <Tile tile={tile} game={game} tileData={tile} selected={selected === tile} fresh={freshTile === tile} dragging={drag?.kind === "rack" && drag.tile === tile}
              onClick={() => clickTile(tile)} onPointerDown={e => pointerDown(e, { kind: "rack", tile, slot: i })}
              onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} />}
          </div>)}</div><div className="rack-ledge" /></div>
          <div className="action-bar">
            <div className="game-status"><span className="status-spark">✦</span>{game.event}</div>
            <div className="turn-actions">{canDraw && <><button disabled={busy || !game.lastDiscard} onClick={() => void send("draw", { source: "discard" })}>Sağdaki taşı al</button><button className="primary-button" disabled={busy} onClick={() => void send("draw", { source: "wall" })}>Desteden sürükle / çek →</button></>}{canThrow && <button className="primary-button" disabled={busy || selected === null} onClick={() => selected !== null && throwTile(selected)}>Seçili taşı sola at →</button>}</div>
          </div>
          <div className="emoji-bar"><div><span>MASADA TEPKİ VER</span><small>Beklerken arkadaşlarına emoji gönder</small></div><div className="emoji-options">{EMOJIS.map(emoji => <button key={emoji} type="button" disabled={busy || game.phase !== "playing"} onClick={() => void send("react", { emoji })} aria-label={`${emoji} emojisi gönder`}>{emoji}</button>)}</div></div>
        </div>
      </>}
    </section>}
    {drag && game && <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}><Tile tile={drag.kind === "rack" ? drag.tile : drag.kind === "discard" ? game.lastDiscard?.tile : undefined} game={game} hidden={drag.kind === "wall"} /></div>}
    {flight && game && <div key={`${flight.x}-${flight.y}-${flight.hidden}`} className="flying-stone" style={{ left: flight.x, top: flight.y, ["--flight-x" as string]: `${flight.dx}px`, ["--flight-y" as string]: `${flight.dy}px` }}><Tile tile={flight.tile} game={game} hidden={flight.hidden} /></div>}
    {error && <div className="toast" role="alert"><span>!</span>{error}<button onClick={() => setError("")}>×</button></div>}
    <footer className="page-footer">DÜZ OKEY MASASI <span>✦</span> İYİ OYUNLAR</footer>
  </main>;
}
