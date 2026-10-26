/* ============================================================
   builder.js — the castle itself and the tools that change it
   ============================================================
   Castle holds the grid, the furniture, the rooms' names, the
   treasury, the quests and the undo history.  Every change goes
   through place/erase so undo, coins, quests and the people all
   see the same thing.  Nothing here touches the DOM.
   ============================================================ */
'use strict';

class Castle {
  constructor(G) {
    this.G = G;
    this.grid = new Grid();
    this.items = [];                 /* { id, key, cx, cy, layer } anchored bottom-left */
    this.roomMeta = [];              /* { anchor, type, name } */
    this.coins = 250;
    this.questsDone = new Set();
    this.unlocked = new Set();
    this.undoStack = []; this.redoStack = []; this.stroke = null;
    this.nextId = 1; this.version = 0;
    this.stats = { stones: 0, tiles: 0, erased: 0, items: 0, brushed: 0, photos: 0, dug: 0, quests: 0, coinsEarned: 0, named: 0, undos: 0, fed: 0, roomsMade: 0 };
    this.flags = {};
    this.isPlayer = true; this.id = 1;
    this.input = { actionPressed: false };
    this.lastRoomCount = 0;
  }

  /* ---------- rooms with their names ---------- */
  rooms() {
    const rooms = this.grid.rooms();
    if (this._roomsV !== this.grid.version || this._metaV !== this.version) {
      for (const r of rooms) {
        r.type = 'empty'; r.name = '';
        const set = new Set(r.cells);
        for (const m of this.roomMeta) if (set.has(m.anchor)) { r.type = m.type; r.name = m.name || ''; break; }
        r.items = [];
      }
      for (const it of this.items) { const r = this.grid.roomAt(it.cx, it.cy); if (r) r.items.push(it); it.room = r ? r.id : 0; }
      this._roomsV = this.grid.version; this._metaV = this.version;
    }
    return rooms;
  }
  roomAt(cx, cy) { this.rooms(); return this.grid.roomAt(cx, cy); }
  namedRooms() { return this.rooms().filter(r => !r.tiny && r.type !== 'empty'); }
  setRoomType(room, type, name, record = true) {
    if (!room || !ROOM_TYPES[type]) return false;
    if (ROOM_TYPES[type].groundOnly && !room.ground) return 'ground';
    const set = new Set(room.cells), old = this.roomMeta.find(m => set.has(m.anchor));
    const from = old ? { type: old.type, name: old.name } : null;
    this.roomMeta = this.roomMeta.filter(m => !set.has(m.anchor));
    if (type !== 'empty') this.roomMeta.push({ anchor: room.anchor, type, name: name || '' });
    this.version++;
    if (record) this.record({ type: 'room', anchor: room.anchor, from, to: type === 'empty' ? null : { type, name: name || '' } });
    if (type !== 'empty') { this.unlocked.add(type); if (!from || from.type !== type) { this.stats.named++; Bus.emit('roomNamed', this, room, type); } }
    this.changed();
    return true;
  }

  /* ---------- occupancy ---------- */
  cellsOf(key, cx, cy) { const it = ITEMS[key], out = []; for (let x = cx; x < cx + it.w; x++) for (let y = cy - it.h + 1; y <= cy; y++) out.push([x, y]); return out; }
  layerOf(key) { const m = ITEMS[key].mount; return m === 'wall' || m === 'ceiling' ? 'wall' : m === 'rug' ? 'rug' : 'floor'; }
  itemAt(cx, cy, layer) {
    for (let i = this.items.length - 1; i >= 0; i--) { const it = this.items[i], d = ITEMS[it.key]; if (layer && this.layerOf(it.key) !== layer) continue; if (cx >= it.cx && cx < it.cx + d.w && cy <= it.cy && cy > it.cy - d.h) return it; }
    return null;
  }
  /* why an item can or cannot go here: { ok, why, room, autoType } */
  fits(key, cx, cy, ignore) {
    const it = ITEMS[key], g = this.grid; if (!it) return { ok: false, why: 'noFit' };
    const outdoorOK = it.rooms.includes('outdoor'), top = it.rooms.includes('top'), indoorOK = it.rooms.some(r => r !== 'outdoor' && r !== 'top'), layer = this.layerOf(key);
    const cells = this.cellsOf(key, cx, cy);
    for (const [x, y] of cells) { if (!g.inside(x, y) || y < 1 || y >= GROUND) return { ok: false, why: 'noFit' }; }
    const roomIds = new Set(cells.map(([x, y]) => g.roomId(x, y)));
    const room = roomIds.size === 1 ? this.roomAt(cells[0][0], cells[0][1]) : null;
    const indoors = room && !room.tiny;
    const outsideHere = roomIds.size === 1 && [...roomIds][0] === 0;
    for (const [x, y] of cells) {
      const t = g.get(x, y);
      if (!(t === T.AIR || (outsideHere && (top || outdoorOK) && t === T.BATTLEMENT))) return { ok: false, why: 'noFit' };
      const o = this.itemAt(x, y, layer); if (o && o !== ignore) return { ok: false, why: 'noFit' };
    }
    if (it.mount === 'floor' || it.mount === 'rug' || it.mount === 'top') { for (let x = cx; x < cx + it.w; x++) if (!g.solid(x, cy + 1) && g.get(x, cy + 1) !== T.STAIR) return { ok: false, why: 'noFloor' }; }
    if (it.mount === 'ceiling') { for (let x = cx; x < cx + it.w; x++) if (!g.solid(x, cy - it.h)) return { ok: false, why: 'noFit' }; }
    if (outsideHere) {
      if (!(outdoorOK || top)) return { ok: false, why: 'noRoom' };
      if (top && !outdoorOK) { /* flags and perches sit on top of a wall: something built underneath */ let built = false; for (let x = cx; x < cx + it.w; x++) if (g.get(x, cy + 1) !== T.EARTH && g.solid(x, cy + 1)) built = true; if (!built) return { ok: false, why: 'noFloor' }; }
      return { ok: true, room: null };
    }
    if (!indoorOK) return { ok: false, why: 'outside' };
    if (roomIds.size !== 1 || !indoors) return { ok: false, why: 'noRoom' };
    if (!itemFits(it, room.type)) {
      /* an empty room takes the item's own room type */
      if (room.type === 'empty' && !it.rooms.includes('any')) { const auto = it.rooms[0]; if (ROOM_TYPES[auto] && !(ROOM_TYPES[auto].groundOnly && !room.ground)) return { ok: true, room, autoType: auto }; return { ok: false, why: 'wrongRoom' }; }
      return { ok: false, why: 'wrongRoom' };
    }
    return { ok: true, room };
  }
  canAfford(key) { return this.free() || this.coins >= ITEMS[key].cost; }
  free() { return !!(this.G.settings && this.G.settings.unlockAll) || this.G.diff().unlockAll; }
  available(key) { const it = ITEMS[key]; if (!it) return false; if (it.quest && !this.free() && !this.questsDone.has(it.quest)) return false; return true; }

  /* ---------- undo ---------- */
  beginStroke() { this.stroke = []; }
  endStroke() { if (this.stroke && this.stroke.length) { this.undoStack.push(this.stroke); if (this.undoStack.length > 200) this.undoStack.shift(); this.redoStack.length = 0; } this.stroke = null; }
  record(a) { if (this.stroke) this.stroke.push(a); else { this.undoStack.push([a]); if (this.undoStack.length > 200) this.undoStack.shift(); this.redoStack.length = 0; } }
  apply(a, dir) {
    if (a.type === 'tile') { this.grid.set(a.cx, a.cy, dir > 0 ? a.to : a.from); }
    else if (a.type === 'item') { const add = dir > 0 ? a.add : !a.add; if (add) { if (!this.items.includes(a.item)) this.items.push(a.item); if (!this.free()) this.coins -= ITEMS[a.item.key].cost; } else { this.items = this.items.filter(x => x !== a.item); if (!this.free()) this.coins += ITEMS[a.item.key].cost; } }
    else if (a.type === 'room') { const to = dir > 0 ? a.to : a.from; this.roomMeta = this.roomMeta.filter(m => m.anchor !== a.anchor); if (to) this.roomMeta.push({ anchor: a.anchor, type: to.type, name: to.name }); }
    this.version++;
  }
  undo() { const s = this.undoStack.pop(); if (!s) return false; for (let i = s.length - 1; i >= 0; i--) this.apply(s[i], -1); this.redoStack.push(s); this.stats.undos++; this.afterEdit(); Bus.emit('undo', this); return true; }
  redo() { const s = this.redoStack.pop(); if (!s) return false; for (const a of s) this.apply(a, 1); this.undoStack.push(s); this.afterEdit(); Bus.emit('redo', this); return true; }

  /* ---------- the tools ---------- */
  placeTile(cx, cy, tile) {
    const g = this.grid;
    if (!g.canPlace(cx, cy, tile)) return false;
    const from = g.get(cx, cy); if (from === tile) return false;
    g.set(cx, cy, tile);
    this.record({ type: 'tile', cx, cy, from, to: tile });
    this.stats.tiles++; if (tile === T.STONE || tile === T.TOWER) this.stats.stones++; if (tile === T.WATER) this.stats.dug++;
    this.afterEdit(); Bus.emit('placed', this, tile, cx, cy);
    return true;
  }
  erase(cx, cy) {
    const it = this.itemAt(cx, cy, 'floor') || this.itemAt(cx, cy, 'wall') || this.itemAt(cx, cy, 'rug');
    if (it) { this.removeItem(it); Bus.emit('erasedItem', this, it); return true; }
    const g = this.grid; if (!g.canErase(cx, cy)) return false;
    const from = g.get(cx, cy), to = g.erased(cx, cy);
    g.set(cx, cy, to); this.record({ type: 'tile', cx, cy, from, to }); this.stats.erased++;
    this.afterEdit(); Bus.emit('erased', this, from, cx, cy);
    return true;
  }
  placeItem(key, cx, cy) {
    const f = this.fits(key, cx, cy); if (!f.ok) return f;
    if (!this.available(key)) return { ok: false, why: 'locked' };
    if (!this.canAfford(key)) return { ok: false, why: 'poor' };
    if (f.autoType) this.setRoomType(f.room, f.autoType, '', true);
    const item = { id: this.nextId++, key, cx, cy };
    this.items.push(item); if (!this.free()) this.coins -= ITEMS[key].cost;
    this.record({ type: 'item', add: true, item }); this.stats.items++;
    this.afterEdit(); Bus.emit('item', this, item, f.room);
    return { ok: true, item, room: f.room, autoType: f.autoType };
  }
  removeItem(item, refund = true) {
    if (!this.items.includes(item)) return;
    this.items = this.items.filter(x => x !== item); if (!this.free() && refund) this.coins += ITEMS[item.key].cost;
    this.record({ type: 'item', add: false, item });
    this.afterEdit(); Bus.emit('itemGone', this, item);
  }
  /* after any edit: furniture that lost its floor or its room comes out (and is refunded) */
  afterEdit() {
    this.version++;
    let dropped = 0;
    for (const it of this.items.slice()) { const f = this.fits(it.key, it.cx, it.cy, it); if (!f.ok && f.why !== 'wrongRoom') { this.items = this.items.filter(x => x !== it); if (!this.free()) this.coins += ITEMS[it.key].cost; if (this.stroke) this.stroke.push({ type: 'item', add: false, item: it }); else this.undoStack.length && this.undoStack[this.undoStack.length - 1].push({ type: 'item', add: false, item: it }); dropped++; Bus.emit('itemDropped', this, it); } }
    this.rooms();
    const n = this.rooms().filter(r => !r.tiny).length;
    if (n > this.lastRoomCount) { this.stats.roomsMade += n - this.lastRoomCount; Bus.emit('roomMade', this, n); }
    this.lastRoomCount = n;
    this.changed();
    return dropped;
  }
  changed() { this.dirty = true; }

  /* ---------- what the castle has (for quests, stickers and missions) ---------- */
  summary(world) {
    const g = this.grid, rooms = this.rooms().filter(r => !r.tiny), items = {}, roomTypes = {};
    for (const k of ITEM_KEYS) items[k] = 0; for (const it of this.items) items[it.key]++;
    for (const k of ROOM_KEYS) roomTypes[k] = 0; for (const r of rooms) if (r.type !== 'empty') roomTypes[r.type]++;
    let stairsUp = 0; for (let cy = 1; cy < GROUND; cy++) for (let cx = 0; cx < COLS; cx++) if (g.get(cx, cy) === T.STAIR && g.roomId(cx, cy - 1) > 0 && (g.roomId(cx, cy + 1) > 0 || g.get(cx, cy + 1) === T.STAIR)) stairsUp++;
    const outdoor = this.items.filter(it => ITEMS[it.key].rooms.includes('outdoor') || ITEMS[it.key].rooms.includes('top')).length;
    return {
      stones: this.stats.stones, tiles: this.stats.tiles, doors: g.count(T.DOOR), gates: g.count(T.GATE), windows: g.count(T.WIN_SLIT) + g.count(T.WIN_ARCH) + g.count(T.WIN_STAINED),
      battlements: g.count(T.BATTLEMENT), cones: g.count(T.CONE), water: g.count(T.WATER), drawbridges: g.count(T.DRAWBRIDGE), bridges: g.count(T.BRIDGE), stairs: g.count(T.STAIR), stairsUp,
      rooms: rooms.length, named: rooms.filter(r => r.type !== 'empty').length, roomTypes, items, tallest: g.tallest().h, moatAround: g.moatAround(),
      horses: world ? world.horses.length : 0, dogs: world ? world.dogs.length : 0, knights: world ? world.people.filter(p => p.role === 'knight').length : 0,
      garden: outdoor, furniture: this.items.length - outdoor, stained: g.count(T.WIN_STAINED), brushed: this.stats.brushed, coins: this.coins, photos: this.stats.photos, undos: this.stats.undos, dug: this.stats.dug, erased: this.stats.erased, quests: this.questsDone.size, fed: this.stats.fed
    };
  }
  activeQuests() { const out = []; for (const q of QUESTS) { if (this.questsDone.has(q.key)) continue; out.push(q); if (out.length >= 3) break; } return out; }
  /* returns the quests finished just now */
  checkQuests(world) {
    const S = this.summary(world), done = [];
    for (const q of QUESTS) { if (this.questsDone.has(q.key)) continue; let ok = false; try { ok = q.check(S); } catch (e) { ok = false; } if (ok) { this.questsDone.add(q.key); const coins = Math.round(q.reward * this.G.diff().questK); this.coins += coins; this.stats.coinsEarned += coins; this.stats.quests++; done.push({ q, coins }); if (q.unlock) this.unlocked.add(q.unlock); Bus.emit('questDone', this, q, coins); } }
    return done;
  }
  earn(n, why) { this.coins += n; this.stats.coinsEarned += n; Bus.emit('coins', this, n, why); }
  /* a milestone: the big moments; Read to Play may wrap this to put a page first */
  milestone(key, fn) { if (fn) fn(); }

  /* ---------- blueprints ---------- */
  applyBlueprint(key) {
    const bp = BLUEPRINTS[key] || BLUEPRINTS.plot, g = this.grid, self = this;
    const marks = [], items = [];
    const b = {
      set(x, y, t) { if (g.inside(x, y)) g.t[y * COLS + x] = t; },
      rect(x0, y0, x1, y1, t) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) b.set(x, y, t); },
      room(x, y, type) { marks.push([x, y, type]); },
      item(k, x, y) { items.push([k, x, y]); }
    };
    bp.build(b); g.version++;
    for (const [x, y, type] of marks) { const r = self.roomAt(x, y); if (r) self.setRoomType(r, type, '', false); }
    const freeBefore = this.free();
    for (const [k, x, y] of items) { const f = this.fits(k, x, y); if (f.ok) { if (f.autoType) this.setRoomType(f.room, f.autoType, '', false); this.items.push({ id: this.nextId++, key: k, cx: x, cy: y }); } else if (typeof console !== 'undefined' && this.G.debug) console.warn('blueprint item does not fit', k, x, y, f.why); }
    this.undoStack.length = 0; this.redoStack.length = 0;
    this.version++; this.rooms(); this.lastRoomCount = this.rooms().filter(r => !r.tiny).length;
    const S = this.summary(null); for (const q of QUESTS) { let ok = false; try { ok = q.check(S); } catch (e) { ok = false; } if (ok) { this.questsDone.add(q.key); if (q.unlock) this.unlocked.add(q.unlock); } }
    void freeBefore;
  }

  /* ---------- save ---------- */
  serialize() {
    return { grid: this.grid.serialize(), items: this.items.map(it => [it.key, it.cx, it.cy]), rooms: this.roomMeta.map(m => [m.anchor, m.type, m.name || '']), coins: Math.round(this.coins), quests: [...this.questsDone], unlocked: [...this.unlocked], stats: this.stats, flags: this.flags, nextId: this.nextId };
  }
  restore(o) {
    if (!o || typeof o !== 'object') return false;
    if (!this.grid.restore(o.grid)) return false;
    this.items = []; this.roomMeta = [];
    if (Array.isArray(o.rooms)) for (const m of o.rooms) if (Array.isArray(m) && Number.isInteger(m[0]) && m[0] >= 0 && m[0] < COLS * ROWS && ROOM_TYPES[m[1]]) this.roomMeta.push({ anchor: m[0], type: m[1], name: typeof m[2] === 'string' ? m[2].slice(0, 40) : '' });
    this.version++;
    if (Array.isArray(o.items)) for (const it of o.items) { if (!Array.isArray(it) || !ITEMS[it[0]] || !Number.isInteger(it[1]) || !Number.isInteger(it[2])) continue; const f = this.fits(it[0], it[1], it[2]); if (f.ok) this.items.push({ id: this.nextId++, key: it[0], cx: it[1], cy: it[2] }); }
    this.coins = Number.isFinite(o.coins) ? clamp(o.coins, 0, 999999) : 250;
    this.questsDone = new Set((Array.isArray(o.quests) ? o.quests : []).filter(k => QUEST_BY_KEY[k]));
    this.unlocked = new Set((Array.isArray(o.unlocked) ? o.unlocked : []).filter(k => typeof k === 'string'));
    if (o.stats && typeof o.stats === 'object') for (const k in this.stats) if (Number.isFinite(o.stats[k])) this.stats[k] = o.stats[k];
    this.flags = o.flags && typeof o.flags === 'object' ? o.flags : {};
    this.nextId = Math.max(this.nextId, o.nextId | 0);
    this.undoStack.length = 0; this.redoStack.length = 0;
    this.version++; this.rooms(); this.lastRoomCount = this.rooms().filter(r => !r.tiny).length;
    return true;
  }
}
