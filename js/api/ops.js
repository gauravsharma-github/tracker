// Write operations shared by both backends. The Google Sheets backend sends these same
// objects to the server, which applies them with identical rules (see backend/Code.gs).
//   { op: 'create',     coll, item }
//   { op: 'createMany', coll, items }
//   { op: 'update',     coll, id, patch }
//   { op: 'updateMany', coll, patches: [{ id, ...patch }] }
//   { op: 'remove',     coll, ids: [] }
//   { op: 'settings',   patch }
(function (TI) {
  const COLLECTIONS = ['projects', 'subjects', 'nodes', 'sessions', 'cards', 'reviews', 'notes', 'blocks', 'attachments', 'stages'];
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function apply(db, op) {
    const list = op.coll ? (db[op.coll] = db[op.coll] || []) : null;
    switch (op.op) {
      case 'create': list.push(clone(op.item)); break;
      case 'createMany': list.push(...clone(op.items)); break;
      case 'update': { const it = list.find((x) => x.id === op.id); if (it) Object.assign(it, clone(op.patch)); break; }
      case 'updateMany': {
        const map = new Map(list.map((x) => [x.id, x]));
        op.patches.forEach((p) => { const it = map.get(p.id); if (it) Object.assign(it, clone(p)); });
        break;
      }
      case 'remove': { const set = new Set(op.ids); db[op.coll] = list.filter((x) => !set.has(x.id)); break; }
      case 'settings': db.settings = Object.assign(db.settings || {}, clone(op.patch)); break;
      default: break;
    }
    return db;
  }

  function emptyDb(settings) {
    const db = { settings: settings || {} };
    COLLECTIONS.forEach((c) => { db[c] = []; });
    return db;
  }

  TI.ops = { COLLECTIONS, apply, emptyDb, clone };
})(window.TI);
