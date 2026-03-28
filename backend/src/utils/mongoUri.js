const { Resolver } = require('dns').promises;

const PUBLIC_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];

const isMongoSrvUri = (uri = '') => String(uri).startsWith('mongodb+srv://');

const parseTxtOptions = (records = []) => {
  const params = new URLSearchParams();

  records.flat().forEach((record) => {
    const query = new URLSearchParams(String(record || ''));
    query.forEach((value, key) => {
      if (!params.has(key)) {
        params.set(key, value);
      }
    });
  });

  return params;
};

const buildDirectMongoUri = async (uri) => {
  if (!isMongoSrvUri(uri)) {
    return uri;
  }

  const parsed = new URL(uri);
  const resolver = new Resolver();
  resolver.setServers(PUBLIC_DNS_SERVERS);

  const [srvRecords, txtRecords] = await Promise.all([
    resolver.resolveSrv(`_mongodb._tcp.${parsed.hostname}`),
    resolver.resolveTxt(parsed.hostname).catch(() => [])
  ]);

  const hosts = srvRecords
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((record) => `${record.name}:${record.port}`)
    .join(',');

  if (!hosts) {
    throw new Error(`Failed to resolve hosts for ${parsed.hostname}`);
  }

  const mergedParams = parseTxtOptions(txtRecords);
  parsed.searchParams.forEach((value, key) => {
    mergedParams.set(key, value);
  });

  if (!mergedParams.has('tls') && !mergedParams.has('ssl')) {
    mergedParams.set('tls', 'true');
  }

  const dbName = parsed.pathname.replace(/^\//, '') || 'test';
  const username = parsed.username ? encodeURIComponent(parsed.username) : '';
  const password = parsed.password ? `:${encodeURIComponent(parsed.password)}` : '';
  const credentials = username ? `${username}${password}@` : '';
  const query = mergedParams.toString();

  return `mongodb://${credentials}${hosts}/${dbName}${query ? `?${query}` : ''}`;
};

module.exports = {
  isMongoSrvUri,
  buildDirectMongoUri
};
