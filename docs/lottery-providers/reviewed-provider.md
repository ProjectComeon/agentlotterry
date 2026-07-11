# Reviewed provider contract review

Provider code: `reviewed-provider`

Status: unconfirmed contract shell. This provider is disabled by default and must not be considered production-ready until the missing evidence below is supplied and reviewed.

## Documentation source

No official API documentation or provider-confirmed payload sample has been supplied in this PR. The fixtures under `backend/src/services/lotteryProvider/fixtures/reviewed-provider/` are sanitized placeholders for contract-test structure only. They are not evidence for production field mapping.

## Authentication

Unconfirmed. Do not invent an authentication scheme.

Potential schemes that require evidence before implementation:

- Bearer token
- API key header
- Basic auth
- HMAC signature
- client ID/client secret

Current implementation does not enable live network calls. `LOTTERY_REAL_NETWORK_ENABLED=false` is the default in every environment.

## Endpoint table

| Capability | Endpoint | Method | Status | Evidence |
| --- | --- | --- | --- | --- |
| Provider health/status | Unconfirmed | GET only when confirmed | Not mapped | Missing official docs/sample |
| List lotteries | Unconfirmed | GET only when confirmed | Not mapped | Missing official docs/sample |
| List rounds | Unconfirmed | GET only when confirmed | Not mapped | Missing official docs/sample |
| Round detail | Unconfirmed | GET only when confirmed | Not mapped | Missing official docs/sample |
| Results | Unconfirmed | GET only when confirmed | Not mapped | Missing official docs/sample |

No POST/PUT/PATCH/DELETE provider calls are allowed in this PR.

## Required request parameters

Unconfirmed. Query parameters must be allowlisted after the provider docs are reviewed. Query allowlists are empty until provider docs confirm request parameters. The client must not accept arbitrary URL/path/query values from users.

Current fail-closed request policy:

- `buildRoundsRequest()` rejects canonical filters until provider query names are confirmed.
- `buildRoundDetailRequest()` rejects round IDs until provider detail request mapping is confirmed.
- `buildResultsRequest()` rejects canonical filters until provider query names are confirmed.
- Non-empty query values are rejected unless a test-only contract explicitly allowlists that key.
- Query values must be scalar, short, and not URL/path-like.

## Pagination

Unconfirmed. Do not assume page, cursor, offset, or limit names until provider docs confirm them.

## Rate limits

Unconfirmed. Retry behavior must be based on provider docs. Until confirmed, do not retry live provider requests.

## Timezone and date formats

Unconfirmed. Do not assume `Asia/Bangkok` or any timezone based on deployment location.

Required before mapping dates:

- provider timezone policy
- whether timestamps are ISO strings or Unix timestamps
- whether Unix timestamps are seconds or milliseconds
- whether timezone-less dates are allowed and how they should be interpreted

Canonical validation still requires explicit timezone offset or `Z` before dates leave the adapter.

## Raw provider schemas

Unconfirmed. Sanitized placeholder fixture files exist only to make the contract review boundary testable:

- `provider-status.success.json`
- `lotteries.valid.json`
- `rounds.valid.json`
- `round.valid.json`
- `results.pending.json`
- `results.published.json`
- `error.unauthorized.json`
- `error.rate-limit.json`
- `error.unavailable.json`
- `malformed.json`
- `unknown-status.json`
- `missing-required-field.json`
- `duplicate-ids.json`
- `invalid-date-timezone.json`
- `invalid-result-digit-length.json`
- `numeric-result.json`
- `oversized-payload.simulation.json`

## Canonical mapping

| Provider field | Canonical field | Transformation | Required | Evidence |
| --- | --- | --- | --- | --- |
| Provider lottery ID | `externalId` | Unconfirmed - not mapped | Yes | Missing official docs/sample |
| Provider lottery code | `code` | Unconfirmed - not mapped | Yes | Missing official docs/sample |
| Provider display name | `name` / `label` | Unconfirmed - not mapped | Yes | Missing official docs/sample |
| Provider timezone | `timezone` | Unconfirmed - not mapped | Yes | Missing official docs/sample |
| Provider round ID | `externalId` | Unconfirmed - not mapped | Yes | Missing official docs/sample |
| Provider lottery ID on round | `lotteryExternalId` | Unconfirmed - not mapped | Yes | Missing official docs/sample |
| Provider opening time | `openAt` | Unconfirmed - not mapped | Yes | Missing official docs/sample |
| Provider closing time | `closeAt` | Unconfirmed - not mapped | Yes | Missing official docs/sample |
| Provider draw/result time | `resultAt` | Unconfirmed - not mapped | Yes | Missing official docs/sample |
| Provider round status | `status` | Unconfirmed - not mapped | Yes | Missing official docs/sample |
| Provider result ID | `externalId` | Unconfirmed - not mapped | Yes | Missing official docs/sample |
| Provider round ID on result | `roundExternalId` | Unconfirmed - not mapped | Yes | Missing official docs/sample |
| Provider result numbers | canonical `numbers.*` fields | Unconfirmed - not mapped | Depends on result status | Missing official docs/sample |

## Null and missing-field policy

Unconfirmed provider fields are rejected by the mapper. Once docs exist, required fields must fail closed with controlled `LotteryProviderError` responses. Optional fields must be documented explicitly.

## Status mapping

No status mapping is confirmed.

Canonical statuses remain:

- Lottery: `active`, `inactive`
- Round: `upcoming`, `open`, `closed`, `resulted`
- Result: `pending`, `published`

Unknown provider statuses must not silently default; they must fail as controlled mapping errors.

## Error mapping

Current client maps controlled transport errors without exposing secrets:

- `LOTTERY_PROVIDER_NETWORK_DISABLED`
- `LOTTERY_PROVIDER_NOT_CONFIGURED`
- `LOTTERY_PROVIDER_UNAUTHORIZED`
- `LOTTERY_PROVIDER_RATE_LIMITED`
- `LOTTERY_PROVIDER_REDIRECT_BLOCKED`
- `LOTTERY_PROVIDER_TIMEOUT`
- `LOTTERY_PROVIDER_UNAVAILABLE`
- `LOTTERY_PROVIDER_RESPONSE_TOO_LARGE`
- `LOTTERY_PROVIDER_MAPPING_INVALID`

Provider-specific error body fields are unconfirmed and not mapped.

## Retry policy

No live retry policy is enabled. Future retries must be limited to idempotent GET requests and must follow documented provider guidance, including `Retry-After` bounds.

## Security assumptions

- Base URL must come from trusted environment variables only.
- Production base URL must be HTTPS and must not include credentials.
- No user-supplied arbitrary URL/path/query is accepted.
- Request secrets must never be logged or returned.
- Admin preview endpoints must remain admin-only, GET-only, and DB-read/write neutral.
- CI must use fixtures/fake transport only and must not call provider DNS/network.
- Redirect responses are blocked and are not followed; Location headers and redirect URLs must not be exposed.
- Endpoint paths must be relative/same-origin contract paths; absolute URLs, protocol-relative URLs, credentials, fragments, and backslashes are rejected.
- Response size is checked both through transport limits and serialized payload size validation.

## Remaining review items

Before this provider can be marked ready or used beyond contract review, provide:

- confirmed provider name/code
- official API docs or provider-confirmed spec
- sanitized real successful responses
- sanitized real error responses
- authentication mechanism
- endpoint paths
- required headers
- pagination/rate-limit details
- timezone/date format policy
- status mapping evidence
- result-number mapping evidence

Do not merge this placeholder name as production mapping if a real provider code is known before review completes.
