# Lottery API integration

This project now has a read-only lottery provider adapter boundary. The first provider is `mock`, intended for local development, tests, and CI. This PR does not submit bets to an external provider and does not import provider results into settlement.

## Provider interface

The backend adapter exposes:

- `getProviderStatus()`
- `listLotteries()`
- `listRounds(params)`
- `getRound(externalRoundId)`
- `getResults(params)`

All methods return normalized data after schema validation. External provider payloads are treated as untrusted input.

## Read-only boundary

Provider code must not write to MongoDB, mutate wallet balances, create ledger entries, update `heldStakeBalance`, submit slips, or call settlement. Member purchase, draft, submit, cancel, payout, and ledger behavior must continue to use the local database and existing financial services.

The optional admin preview endpoints are GET-only:

- `GET /api/admin/lottery-provider/status`
- `GET /api/admin/lottery-provider/preview/lotteries`
- `GET /api/admin/lottery-provider/preview/rounds`
- `GET /api/admin/lottery-provider/preview/results`

These routes are admin-only because they live under the existing admin router middleware. They return normalized provider preview data and do not write DB records.

## Data mapping

Internal fields that future phases may map to:

- Lottery: `LotteryType.code`, `name`, `shortName`, `provider`, `resultSource`, `supportedBetTypes`
- Round: `DrawRound.code`, `title`, `openAt`, `closeAt`, `drawAt`, `resultPublishedAt`, `status`, `resultLookupCode`
- Result: `ResultRecord.firstPrize`, `twoTop`, `twoBottom`, hit arrays, `runTop`, `runBottom`, `sourceType`, `isPublished`

This PR does not add external IDs to internal schemas. If future imports need persistence, add optional external ID fields and scoped unique indexes in a separate migration PR.

## Timezone policy

Provider dates must include an explicit timezone offset or `Z`. The adapter rejects date strings that omit timezone information. Valid dates are normalized to ISO strings before they leave the adapter.

## Validation

The adapter rejects:

- missing required fields
- malformed dates
- unsupported statuses
- duplicate `externalId` values
- invalid result number formats
- payloads larger than the configured adapter limit

## Network, SSRF, and secrets

`LOTTERY_PROVIDER=mock` is the only implemented provider in this phase. CI uses the mock provider and must not call an external API.

Future real providers must follow these rules:

- base URL comes only from trusted environment variables
- never accept arbitrary URLs from user requests
- require HTTPS in production
- use bounded timeout and response size
- retry only GET/read-only calls, with a low retry count
- do not retry normal 4xx responses
- do not follow redirects to private or local addresses without validation
- never log `LOTTERY_API_KEY`, Authorization headers, or raw secret-bearing payloads
- return controlled errors without exposing internal URLs or tokens

## Mock provider

The mock provider includes fixtures for:

- valid lotteries
- valid open rounds
- near-closing round
- closed round
- valid result
- timeout simulation
- invalid schema
- duplicate ID
- malformed date
- provider unavailable

## Failure behavior

Provider failure must not break member purchase flows. Member buying continues from local `LotteryType`, `DrawRound`, and wallet data. Provider timeout or invalid response returns a controlled provider error in preview endpoints only.

Provider failures must not delete local lotteries or rounds.

## Future phases

Phase 2: preview/import draft only, still no settlement.

Phase 3: admin approval before writing provider-derived data.

Phase 4: idempotent result import with clear source tracking.

Phase 5: settlement integration after a separate review, migration plan, and financial regression coverage.
