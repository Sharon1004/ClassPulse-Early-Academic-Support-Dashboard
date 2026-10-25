// Tiny storage layer with two interchangeable backends:
//  - MongoDB Atlas (when MONGODB_URI is set)
//  - A local JSON file (default, zero setup)
// Every document has a string `id` field.
const fs = require('fs');
const path = require('path');

const COLLECTIONS = ['users', 'students', 'plans', 'settings', 'assessments', 'submissions'];

function fileStore() {
  const file = process.env.DB_FILE || path.join(__dirname, 'data', 'db.json');
  let db = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  try {
    if (fs.existsSync(file)) db = { ...db, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) {
    console.warn('Could not read server/data/db.json, starting with an empty database.');
  }
  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(db));
  };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  return {
    mode: 'file',
    async list(c) { return clone(db[c]); },
    async get(c, id) { const d = db[c].find((x) => x.id === id); return d ? clone(d) : null; },
    async insert(c, doc) { db[c].push(clone(doc)); save(); return doc; },
    async update(c, id, patch) {
      const i = db[c].findIndex((x) => x.id === id);
      if (i < 0) return null;
      db[c][i] = { ...db[c][i], ...clone(patch) };
      save();
      return clone(db[c][i]);
    },
    async replaceAll(c, docs) { db[c] = clone(docs); save(); },
  };
}

async function mongoStore(uri, dbName) {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(dbName);
  for (const c of COLLECTIONS) await db.collection(c).createIndex({ id: 1 }, { unique: true });
  await db.collection('submissions').createIndex({ assessmentId: 1, studentId: 1 }, { unique: true });
  const col = (c) => db.collection(c);
  return {
    mode: 'mongodb',
    async list(c) { return col(c).find({}, { projection: { _id: 0 } }).toArray(); },
    async get(c, id) { return col(c).findOne({ id }, { projection: { _id: 0 } }); },
    async insert(c, doc) { await col(c).insertOne({ ...doc }); return doc; },
    async update(c, id, patch) {
      const { id: _ignore, ...rest } = patch;
      return col(c).findOneAndUpdate({ id }, { $set: rest }, { returnDocument: 'after', projection: { _id: 0 } });
    },
    async replaceAll(c, docs) {
      await col(c).deleteMany({});
      if (docs.length) await col(c).insertMany(docs.map((d) => ({ ...d })));
    },
  };
}

async function createStore() {
  const uri = (process.env.MONGODB_URI || '').trim();
  if (!uri) return fileStore();
  // If a URI is provided but cannot connect, fail loudly instead of silently using local storage.
  return mongoStore(uri, process.env.MONGODB_DB || 'classpulse');
}

module.exports = { createStore };
