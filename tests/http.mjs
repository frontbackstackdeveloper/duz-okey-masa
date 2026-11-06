import assert from "node:assert/strict";

const base = "http://127.0.0.1:8788";
const page = await fetch(base);
assert.equal(page.status, 200);
assert.match(await page.text(), /Taşlar hazır/);
async function post(action, room = "", token = "", extra = {}) {
  const response = await fetch(base + "/api/game", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, room, token, ...extra })
  });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
}
const ownerKey = crypto.randomUUID() + crypto.randomUUID();
const host = await post("create", "", "", { name: "Tamer", avatar: "avatar-1", ownerKey });
assert.equal(host.phase, "lobby");
assert.equal(host.me, 0);
assert.equal(host.seats[0].avatar, "avatar-1");
const friend = await post("join", host.code, "", { name: "Arkadaş", avatar: "avatar-2" });
assert.equal(friend.me, 1);
assert.equal(friend.seats[1].avatar, "avatar-2");
const ready = await post("start", host.code, host.token);
assert.equal(ready.phase, "playing");
assert.equal(ready.seats.length, 4);
assert.equal(ready.seats[0].hand.length, 15);
const turn1 = await post("discard", host.code, host.token, { tile: ready.seats[0].hand[0] });
assert.equal(turn1.turn, 1);
assert.equal(turn1.discardPiles[0].length, 1);
assert.equal(turn1.lastMove.seat, 0);
const reacted = await post("react", host.code, host.token, { emoji: "👏" });
assert.equal(reacted.reactions[0].emoji, "👏");
assert.equal(reacted.turn, 1);
const turn2 = await post("draw", host.code, friend.token, { source: "wall" });
assert.equal(turn2.seats[1].hand.length, 15);
const turn3 = await post("discard", host.code, friend.token, { tile: turn2.seats[1].hand[0] });
assert.equal(turn3.turn, 2);
assert.equal(turn3.stage, "draw");
const bot2 = await post("bot-step", host.code, host.token, { expectedRevision: turn3.revision });
assert.equal(bot2.turn, 3);
assert.equal(bot2.lastMove.seat, 2);
const bot3 = await post("bot-step", host.code, friend.token, { expectedRevision: bot2.revision });
assert.equal(bot3.turn, 0);
assert.equal(bot3.stage, "draw");
const observation = await fetch(base + "/api/game?room=" + host.code);
const observed = await observation.json();
assert.equal(observed.seats[0].hand, undefined);
assert.equal(observed.seats[1].hand, undefined);
const other = await post("create", "", "", { name: "Başka Oyuncu", ownerKey: crypto.randomUUID() + crypto.randomUUID() });
const replacement = await post("create", "", "", {
  name: "Tamer", ownerKey, previousRooms: [
    { code: host.code, token: host.token },
    { code: other.code, token: friend.token }
  ]
});
assert.notEqual(replacement.code, host.code);
assert.equal((await fetch(base + "/api/game?room=" + host.code)).status, 410);
assert.equal((await fetch(base + "/api/game?room=" + replacement.code)).status, 200);
assert.equal((await fetch(base + "/api/game?room=" + other.code)).status, 200);
const migratedOwner = await post("create", "", "", {
  name: "Başka Oyuncu", ownerKey: crypto.randomUUID() + crypto.randomUUID(),
  previousRooms: [{ code: other.code, token: other.token }]
});
assert.equal((await fetch(base + "/api/game?room=" + other.code)).status, 410);
assert.equal((await fetch(base + "/api/game?room=" + migratedOwner.code)).status, 200);
const staleAction = await fetch(base + "/api/game", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ action: "react", room: host.code, token: host.token, emoji: "👏" })
});
assert.equal(staleAction.status, 410);
console.log("HTTP room flow, latest-owner-room replacement, and independent rooms OK", replacement.code);
