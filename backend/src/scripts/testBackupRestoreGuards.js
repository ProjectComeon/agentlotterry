const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EJSON } = require('bson');
const { writeCollectionDataFile } = require('./backupDatabase');
const {
  DEFAULT_INSERT_BATCH_SIZE,
  insertDocumentsInBatches,
  parseArgs,
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

const main = async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-restore-guards-'));
  const dataPath = path.join(tempDir, 'items.data.ejson');
  const count = await writeCollectionDataFile(makeAsyncCollection([
    { _id: 1, name: 'one' },
    { _id: 2, name: 'two' }
  ]), dataPath);

  assert.strictEqual(count, 2);
  assert.deepStrictEqual(EJSON.parse(fs.readFileSync(dataPath, 'utf8')).map((item) => item.name), ['one', 'two']);

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

  console.log('testBackupRestoreGuards: ok');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
