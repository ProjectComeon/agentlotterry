require('dotenv').config();

const mongoose = require('mongoose');
const { buildDirectMongoUri } = require('../utils/mongoUri');
const { runRetentionCleanup } = require('../services/retentionCleanupService');

const parseArgs = (argv = process.argv.slice(2)) =>
  argv.reduce((acc, arg) => {
    if (arg === '--yes' || arg === '--apply') {
      acc.dryRun = false;
    } else if (arg === '--dry-run') {
      acc.dryRun = true;
    } else if (arg.startsWith('--now=')) {
      acc.now = new Date(arg.slice('--now='.length));
    } else if (arg.startsWith('--keep-previous-months=')) {
      acc.keepPreviousMonths = Number(arg.slice('--keep-previous-months='.length));
    }
    return acc;
  }, {
    dryRun: true,
    now: new Date(),
    keepPreviousMonths: Number(process.env.RETENTION_KEEP_PREVIOUS_MONTHS || 1)
  });

const main = async () => {
  const options = parseArgs();
  const mongoUri = await buildDirectMongoUri(process.env.MONGODB_URI);

  await mongoose.connect(mongoUri);
  const result = await runRetentionCleanup(options);
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore disconnect errors during failure handling
  }
  process.exit(1);
});
