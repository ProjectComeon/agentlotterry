require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const { backupDir } = require('../config/env');
const { buildDirectMongoUri } = require('../utils/mongoUri');

const parseArgs = (argv = process.argv.slice(2)) => {
  const options = {
    tag: '',
    dir: backupDir,
    collections: []
  };

  argv.forEach((arg) => {
    if (arg.startsWith('--tag=')) {
      options.tag = arg.slice('--tag='.length);
      return;
    }

    if (arg.startsWith('--dir=')) {
      options.dir = path.resolve(process.cwd(), arg.slice('--dir='.length));
      return;
    }

    if (arg.startsWith('--collections=')) {
      options.collections = arg.slice('--collections='.length).split(',').map((item) => item.trim()).filter(Boolean);
    }
  });

  return options;
};

const createBackupFolderName = (tag = '') => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return tag ? stamp + '_' + tag : stamp;
};

const writeStreamChunk = (stream, chunk) => new Promise((resolve, reject) => {
  const onError = (error) => {
    stream.off('drain', onDrain);
    reject(error);
  };
  const onDrain = () => {
    stream.off('error', onError);
    resolve();
  };

  stream.once('error', onError);
  if (stream.write(chunk)) {
    stream.off('error', onError);
    resolve();
  } else {
    stream.once('drain', onDrain);
  }
});

const endStream = (stream) => new Promise((resolve, reject) => {
  stream.end((error) => (error ? reject(error) : resolve()));
});

const writeCollectionDataFile = async (collection, filePath) => {
  const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });
  let documentCount = 0;

  try {
    await writeStreamChunk(stream, '[\n');
    const cursor = collection.find({});
    for await (const document of cursor) {
      if (documentCount > 0) {
        await writeStreamChunk(stream, ',\n');
      }
      await writeStreamChunk(stream, EJSON.stringify(document, null, 2, { relaxed: false }));
      documentCount += 1;
    }
    await writeStreamChunk(stream, '\n]\n');
    await endStream(stream);
    return documentCount;
  } catch (error) {
    stream.destroy();
    throw error;
  }
};

const runBackup = async ({ options = parseArgs(), db = null } = {}) => {
  let ownsConnection = false;
  if (!db) {
    const mongoUri = await buildDirectMongoUri(process.env.MONGODB_URI);
    await mongoose.connect(mongoUri);
    db = mongoose.connection.db;
    ownsConnection = true;
  }

  try {
    const collections = await db.listCollections().toArray();
    const selectedCollections = collections
      .map((item) => item.name)
      .filter((name) => !name.startsWith('system.'))
      .filter((name) => options.collections.length === 0 || options.collections.includes(name))
      .sort();

    const backupPath = path.join(options.dir, createBackupFolderName(options.tag));
    fs.mkdirSync(backupPath, { recursive: true });

    const metadata = {
      startedAt: new Date().toISOString(),
      databaseName: db.databaseName,
      collections: []
    };

    for (const name of selectedCollections) {
      const collection = db.collection(name);
      const dataPath = path.join(backupPath, name + '.data.ejson');
      const [documentCount, indexes] = await Promise.all([
        writeCollectionDataFile(collection, dataPath),
        collection.indexes()
      ]);

      fs.writeFileSync(
        path.join(backupPath, name + '.indexes.ejson'),
        EJSON.stringify(indexes, null, 2, { relaxed: false })
      );

      metadata.collections.push({
        name,
        documentCount,
        indexCount: indexes.length
      });
    }

    metadata.finishedAt = new Date().toISOString();
    metadata.path = backupPath;

    fs.writeFileSync(
      path.join(backupPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    return {
      ok: true,
      backupPath,
      collectionCount: metadata.collections.length,
      collections: metadata.collections
    };
  } finally {
    if (ownsConnection && mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  }
};

const main = async () => {
  const result = await runBackup({ options: parseArgs() });
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
  createBackupFolderName,
  parseArgs,
  runBackup,
  writeCollectionDataFile,
  __test: {
    endStream,
    writeStreamChunk
  }
};
