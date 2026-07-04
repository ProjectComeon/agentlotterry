require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const { backupDir } = require('../config/env');
const { buildDirectMongoUri } = require('../utils/mongoUri');
const { runBackup } = require('./backupDatabase');

const DEFAULT_INSERT_BATCH_SIZE = 1000;

const toPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const parseArgs = (argv = process.argv.slice(2)) => {
  const options = {
    backupPath: '',
    drop: false,
    yes: false,
    skipPreRestoreBackup: false,
    preRestoreBackupDir: backupDir,
    collections: [],
    batchSize: DEFAULT_INSERT_BATCH_SIZE
  };

  argv.forEach((arg) => {
    if (arg.startsWith('--path=')) {
      options.backupPath = path.resolve(process.cwd(), arg.slice('--path='.length));
      return;
    }

    if (arg === '--drop') {
      options.drop = true;
      return;
    }

    if (arg === '--yes') {
      options.yes = true;
      return;
    }

    if (arg === '--skip-pre-restore-backup') {
      options.skipPreRestoreBackup = true;
      return;
    }

    if (arg.startsWith('--pre-restore-backup-dir=')) {
      options.preRestoreBackupDir = path.resolve(process.cwd(), arg.slice('--pre-restore-backup-dir='.length));
      return;
    }

    if (arg.startsWith('--collections=')) {
      options.collections = arg.slice('--collections='.length).split(',').map((item) => item.trim()).filter(Boolean);
      return;
    }

    if (arg.startsWith('--batch-size=')) {
      options.batchSize = toPositiveInteger(arg.slice('--batch-size='.length), DEFAULT_INSERT_BATCH_SIZE);
    }
  });

  return options;
};

const validateRestoreOptions = (options) => {
  if (!options.backupPath) {
    throw new Error('Missing required --path argument');
  }

  if (options.drop && !options.yes) {
    throw new Error('Restore with --drop is destructive and requires --yes');
  }
};

const restoreIndexes = async (collection, indexDefinitions = []) => {
  for (const index of indexDefinitions) {
    if (index.name === '_id_') {
      continue;
    }

    const options = { ...index };
    delete options.v;
    delete options.ns;
    delete options.key;

    await collection.createIndex(index.key, options);
  }
};

const flushInsertBatch = async (collection, batch) => {
  if (!batch.length) {
    return 0;
  }

  const result = await collection.insertMany(batch, { ordered: false });
  return result?.insertedCount ?? batch.length;
};

const insertDocumentStreamInBatches = async (collection, documents = [], batchSize = DEFAULT_INSERT_BATCH_SIZE) => {
  const safeBatchSize = toPositiveInteger(batchSize, DEFAULT_INSERT_BATCH_SIZE);
  let insertedCount = 0;
  let batch = [];

  for await (const document of documents) {
    batch.push(document);
    if (batch.length >= safeBatchSize) {
      insertedCount += await flushInsertBatch(collection, batch);
      batch = [];
    }
  }

  insertedCount += await flushInsertBatch(collection, batch);
  return insertedCount;
};

const insertDocumentsInBatches = async (collection, documents = [], batchSize = DEFAULT_INSERT_BATCH_SIZE) => (
  insertDocumentStreamInBatches(collection, documents, batchSize)
);

const getRestoreCollections = (metadata, selectedCollections = []) => (metadata.collections || [])
  .map((item) => item.name)
  .filter((name) => selectedCollections.length === 0 || selectedCollections.includes(name));

const isWhitespace = (value) => value === ' ' || value === '\n' || value === '\r' || value === '\t';

const createEjsonArrayError = (filePath, message) => new Error('Invalid EJSON array in ' + filePath + ': ' + message);

const parseEjsonDocument = (source, filePath) => {
  try {
    return EJSON.parse(source);
  } catch (error) {
    throw createEjsonArrayError(filePath, error.message || String(error));
  }
};

const readEjsonArrayFile = async function* readEjsonArrayFile(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  let state = 'start';
  let collecting = false;
  let inString = false;
  let escaped = false;
  let depth = 0;
  let buffer = '';

  for await (const chunk of stream) {
    for (const char of chunk) {
      if (collecting) {
        buffer += char;

        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (char === '\\') {
            escaped = true;
          } else if (char === '"') {
            inString = false;
          }
          continue;
        }

        if (char === '"') {
          inString = true;
          continue;
        }

        if (char === '{' || char === '[') {
          depth += 1;
          continue;
        }

        if (char === '}' || char === ']') {
          depth -= 1;
          if (depth < 0) {
            throw createEjsonArrayError(filePath, 'unexpected closing bracket');
          }

          if (depth === 0) {
            yield parseEjsonDocument(buffer, filePath);
            buffer = '';
            collecting = false;
            state = 'separatorOrEnd';
          }
        }

        continue;
      }

      if (state === 'start') {
        if (isWhitespace(char)) {
          continue;
        }
        if (char !== '[') {
          throw createEjsonArrayError(filePath, 'expected top-level array');
        }
        state = 'valueOrEnd';
        continue;
      }

      if (state === 'valueOrEnd') {
        if (isWhitespace(char)) {
          continue;
        }
        if (char === ']') {
          state = 'done';
          continue;
        }
        if (char !== '{') {
          throw createEjsonArrayError(filePath, 'expected document object');
        }
        collecting = true;
        inString = false;
        escaped = false;
        depth = 1;
        buffer = char;
        continue;
      }

      if (state === 'value') {
        if (isWhitespace(char)) {
          continue;
        }
        if (char !== '{') {
          throw createEjsonArrayError(filePath, 'expected document object');
        }
        collecting = true;
        inString = false;
        escaped = false;
        depth = 1;
        buffer = char;
        continue;
      }

      if (state === 'separatorOrEnd') {
        if (isWhitespace(char)) {
          continue;
        }
        if (char === ',') {
          state = 'value';
          continue;
        }
        if (char === ']') {
          state = 'done';
          continue;
        }
        throw createEjsonArrayError(filePath, 'expected comma or end of array');
      }

      if (state === 'done') {
        if (!isWhitespace(char)) {
          throw createEjsonArrayError(filePath, 'unexpected trailing content');
        }
      }
    }
  }

  if (collecting) {
    throw createEjsonArrayError(filePath, 'unexpected end of file while reading document');
  }

  if (state !== 'done') {
    throw createEjsonArrayError(filePath, 'unexpected end of file before closing array');
  }
};

const runRestore = async ({ options = parseArgs(), db = null, backupRunner = runBackup } = {}) => {
  validateRestoreOptions(options);

  const metadataPath = path.join(options.backupPath, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    throw new Error('Backup metadata was not found at ' + metadataPath);
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const collections = getRestoreCollections(metadata, options.collections);
  let ownsConnection = false;

  if (!db) {
    const mongoUri = await buildDirectMongoUri(process.env.MONGODB_URI);
    await mongoose.connect(mongoUri);
    db = mongoose.connection.db;
    ownsConnection = true;
  }

  const restored = [];
  let preRestoreBackup = null;

  try {
    if (options.drop && !options.skipPreRestoreBackup) {
      preRestoreBackup = await backupRunner({
        db,
        options: {
          tag: 'pre-restore',
          dir: options.preRestoreBackupDir,
          collections
        }
      });
    }

    for (const name of collections) {
      const dataPath = path.join(options.backupPath, name + '.data.ejson');
      const indexesPath = path.join(options.backupPath, name + '.indexes.ejson');
      if (!fs.existsSync(dataPath) || !fs.existsSync(indexesPath)) {
        throw new Error('Missing backup files for collection ' + name);
      }

      const indexes = EJSON.parse(fs.readFileSync(indexesPath, 'utf8'));
      const collection = db.collection(name);

      if (options.drop) {
        await collection.deleteMany({});
      } else {
        const existingCount = await collection.countDocuments({});
        if (existingCount > 0) {
          throw new Error('Collection ' + name + ' is not empty. Use --drop --yes to restore into a populated collection.');
        }
      }

      const insertedCount = await insertDocumentStreamInBatches(collection, readEjsonArrayFile(dataPath), options.batchSize);
      await restoreIndexes(collection, indexes);
      restored.push({
        name,
        documentCount: insertedCount,
        indexCount: indexes.length
      });
    }

    return {
      ok: true,
      backupPath: options.backupPath,
      preRestoreBackupPath: preRestoreBackup?.backupPath || null,
      restored
    };
  } finally {
    if (ownsConnection && mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  }
};

const main = async () => {
  const result = await runRestore({ options: parseArgs() });
  console.log(JSON.stringify(result, null, 2));
};

if (require.main === module) {
  main().catch(async (error) => {
    console.error(error.message || error);
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_INSERT_BATCH_SIZE,
  getRestoreCollections,
  insertDocumentStreamInBatches,
  insertDocumentsInBatches,
  parseArgs,
  readEjsonArrayFile,
  restoreIndexes,
  runRestore,
  validateRestoreOptions
};
