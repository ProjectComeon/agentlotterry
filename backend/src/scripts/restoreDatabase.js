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

const insertDocumentsInBatches = async (collection, documents = [], batchSize = DEFAULT_INSERT_BATCH_SIZE) => {
  const safeBatchSize = toPositiveInteger(batchSize, DEFAULT_INSERT_BATCH_SIZE);
  let insertedCount = 0;

  for (let index = 0; index < documents.length; index += safeBatchSize) {
    const batch = documents.slice(index, index + safeBatchSize);
    if (batch.length) {
      const result = await collection.insertMany(batch, { ordered: false });
      insertedCount += result?.insertedCount ?? batch.length;
    }
  }

  return insertedCount;
};

const getRestoreCollections = (metadata, selectedCollections = []) => (metadata.collections || [])
  .map((item) => item.name)
  .filter((name) => selectedCollections.length === 0 || selectedCollections.includes(name));

const runRestore = async ({ options = parseArgs(), db = null } = {}) => {
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
      preRestoreBackup = await runBackup({
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

      const documents = EJSON.parse(fs.readFileSync(dataPath, 'utf8'));
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

      const insertedCount = await insertDocumentsInBatches(collection, documents, options.batchSize);
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
  insertDocumentsInBatches,
  parseArgs,
  restoreIndexes,
  runRestore,
  validateRestoreOptions
};
