const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EJSON, ObjectId } = require('bson');
const { writeCollectionDataFile } = require('./backupDatabase');
const {
  DEFAULT_INSERT_BATCH_SIZE,
  insertDocumentStreamInBatches,
  insertDocumentsInBatches,
  parseArgs,
  readEjsonArrayFile,
  runRestore,
  validateRestoreOptions
} = require('./restoreDatabase');

const makeAsyncCollection = (documents) => ({
  find: () => ({
    async *[Symbol.asyncIterator]() {
      for (const document of documents) {
        yield document;
      }
    }
  })
});

const writeBackupFixture = async (backupPath, collectionName, documents, indexes = [{ name: '_id_', key: { _id: 1 } }]) => {
  fs.mkdirSync(backupPath, { recursive: true });
  const dataPath = path.join(backupPath, collectionName + '.data.ejson');
  await writeCollectionDataFile(makeAsyncCollection(documents), dataPath);
  fs.writeFileSync(
    path.join(backupPath, collectionName + '.indexes.ejson'),
    EJSON.stringify(indexes, null, 2, { relaxed: false })
  );
  fs.writeFileSync(
    path.join(backupPath, 'metadata.json'),
    JSON.stringify({
      startedAt: new Date().toISOString(),
      databaseName: 'restore_test',
      collections: [{ name: collectionName, documentCount: documents.length, indexCount: indexes.length }]
    }, null, 2)
  );
  return dataPath;
};

const makeRestoreDb = ({ existingCount = 0, events = [] } = {}) => {
  const insertedBatches = [];
  const createdIndexes = [];
  let deleted = false;
  const collection = {
    countDocuments: async () => existingCount,
    deleteMany: async () => {
      events.push('delete');
      deleted = true;
      return { deletedCount: existingCount };
    },
    insertMany: async (batch) => {
      insertedBatches.push(batch.map((item) => item._id));
      return { insertedCount: batch.length };
    },
    createIndex: async (key, options) => {
      createdIndexes.push({ key, options });
      return options.name || 'created_index';
    }
  };

  return { collection, createdIndexes, db: { collection: () => collection }, get deleted() { return deleted; }, insertedBatches };
};

const main = async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-restore-guards-'));
  const dataPath = path.join(tempDir, 'items.data.ejson');
  const count = await writeCollectionDataFile(makeAsyncCollection([
    { _id: 1, name: 'one' },
    { _id: 2, name: 'two' }
  ]), dataPath);

  assert.strictEqual(count, 2);
  assert.deepStrictEqual(EJSON.parse(fs.readFileSync(dataPath, 'utf8')).map((item) => item.name), ['one', 'two']);
  const streamedDocuments = [];
  for await (const document of readEjsonArrayFile(dataPath)) {
    streamedDocuments.push(document);
  }
  assert.deepStrictEqual(streamedDocuments.map((item) => item.name), ['one', 'two']);
  assert.strictEqual(streamedDocuments[0]._id, 1, 'legacy EJSON array backups should stream document values intact');

  assert.throws(
    () => validateRestoreOptions(parseArgs(['--path=backups/manual', '--drop'])),
    /requires --yes/,
    'destructive restore must require explicit confirmation'
  );
  assert.doesNotThrow(() => validateRestoreOptions(parseArgs(['--path=backups/manual', '--drop', '--yes'])));

  assert.strictEqual(parseArgs(['--path=backups/manual', '--batch-size=25']).batchSize, 25);
  assert.strictEqual(parseArgs(['--path=backups/manual', '--batch-size=0']).batchSize, DEFAULT_INSERT_BATCH_SIZE);

  const insertedBatches = [];
  const insertedCount = await insertDocumentsInBatches({
    insertMany: async (batch) => {
      insertedBatches.push(batch.map((item) => item._id));
      return { insertedCount: batch.length };
    }
  }, [{ _id: 1 }, { _id: 2 }, { _id: 3 }], 2);

  assert.strictEqual(insertedCount, 3);
  assert.deepStrictEqual(insertedBatches, [[1, 2], [3]], 'restore inserts should be chunked');

  const streamInsertedBatches = [];
  const streamInsertedCount = await insertDocumentStreamInBatches({
    insertMany: async (batch) => {
      streamInsertedBatches.push(batch.map((item) => item._id));
      return { insertedCount: batch.length };
    }
  }, (async function* documents() {
    yield { _id: 'a' };
    yield { _id: 'b' };
    yield { _id: 'c' };
  }()), 2);

  assert.strictEqual(streamInsertedCount, 3);
  assert.deepStrictEqual(streamInsertedBatches, [['a', 'b'], ['c']], 'restore should batch streamed documents');

  const largeRestorePath = path.join(tempDir, 'large-restore');
  const largeDocuments = Array.from({ length: 2500 }, (_, index) => ({
    _id: index + 1,
    ref: new ObjectId(),
    label: 'item-' + (index + 1)
  }));
  const largeDataPath = await writeBackupFixture(largeRestorePath, 'items', largeDocuments);
  const originalReadFileSync = fs.readFileSync;
  let wholeDataFileReads = 0;
  fs.readFileSync = function guardedReadFileSync(filePath, ...args) {
    if (path.resolve(String(filePath)) === path.resolve(largeDataPath)) {
      wholeDataFileReads += 1;
      throw new Error('restore attempted to read the whole collection data file');
    }
    return originalReadFileSync.call(this, filePath, ...args);
  };

  try {
    const restoreDb = makeRestoreDb();
    const restoreResult = await runRestore({
      options: parseArgs(['--path=' + largeRestorePath, '--batch-size=400']),
      db: restoreDb.db
    });

    assert.strictEqual(wholeDataFileReads, 0, 'restore must stream data files instead of readFileSync on collection data');
    assert.strictEqual(restoreResult.restored[0].documentCount, 2500);
    assert.strictEqual(restoreDb.insertedBatches.length, 7);
    assert.strictEqual(restoreDb.insertedBatches[0].length, 400);
    assert.strictEqual(restoreDb.insertedBatches[6].length, 100);
    assert.deepStrictEqual(restoreDb.insertedBatches[0].slice(0, 3), [1, 2, 3]);
  } finally {
    fs.readFileSync = originalReadFileSync;
  }

  const nonEmptyRestorePath = path.join(tempDir, 'non-empty-restore');
  await writeBackupFixture(nonEmptyRestorePath, 'items', [{ _id: 1 }]);
  await assert.rejects(
    () => runRestore({
      options: parseArgs(['--path=' + nonEmptyRestorePath]),
      db: makeRestoreDb({ existingCount: 1 }).db
    }),
    /not empty/,
    'restore without --drop should still refuse populated collections'
  );

  const dropRestorePath = path.join(tempDir, 'drop-restore');
  await writeBackupFixture(dropRestorePath, 'items', [{ _id: 1 }, { _id: 2 }]);
  const events = [];
  const dropRestoreDb = makeRestoreDb({ existingCount: 2, events });
  const backupCalls = [];
  const dropRestoreResult = await runRestore({
    options: parseArgs(['--path=' + dropRestorePath, '--drop', '--yes', '--batch-size=1']),
    db: dropRestoreDb.db,
    backupRunner: async ({ options }) => {
      events.push('backup');
      backupCalls.push(options);
      return { backupPath: path.join(tempDir, 'pre-restore-backup') };
    }
  });

  assert.deepStrictEqual(events.slice(0, 2), ['backup', 'delete'], 'destructive restore should back up before deleting data');
  assert.strictEqual(dropRestoreResult.preRestoreBackupPath, path.join(tempDir, 'pre-restore-backup'));
  assert.deepStrictEqual(backupCalls[0].collections, ['items']);
  assert.deepStrictEqual(dropRestoreDb.insertedBatches, [[1], [2]], 'destructive restore should still honor batch size');

  console.log('testBackupRestoreGuards: ok');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
