# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Client-side block explorer for the Unicity aggregator ("SMT explorer"). Three files do
everything: `index.html` (static markup + all element IDs), `rpc-client.js` (JSON-RPC
transport + response normalization), `app.js` (one `BlockExplorer` class: state, routing,
rendering). Deployed as-is to GitHub Pages (`unicitynetwork/smt-explorer`).

## Commands

No build, no bundler, no dependencies, no test suite, no linter. Scripts are loaded as
classic `<script>` tags, so `AggregatorRPCClient`, `BlockExplorer`, and the singleton
`blockExplorer` are globals — do not add `import`/`export`.

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Verification is manual: load the page, watch the browser console, exercise the affected
network/shard. The `local` network expects an aggregator at `http://localhost:3000`.

## Architecture

### Aggregator versions are detected per call, not per network

`mainnet` and `testnet2` (the default, labelled just "Testnet" in the UI) both run v2
gateways; a `local` aggregator may be either version. Rather than keying behaviour off the
network name, `AggregatorRPCClient.getBlockTransactions()` tries
v2's `get_block_records` first and falls back to v1's `get_block_commitments` **only** when
the error is "Method not found" — every other error is rethrown so real/transient failures
stay visible. It returns `{ version, records }`, and that tag is threaded through
`showBlockDetail` into `renderTransactionCard(record, index, blockNumber, version)`, which
switches between the two completely different record shapes (v2: `stateId` +
`certificationData`; v1: `requestId` + `authenticator`). Keep any new per-version field
handling inside that one function.

`rpc-client.js` also unwraps the Go aggregator's envelopes (`result.block`,
`result.commitments`, `result.aggregatorRecords`, `result.inclusionProof`) and converts
`createdAt` ms → `timestamp` s. Callers in `app.js` assume the normalized shape.

### Shards are discovered at runtime, in two formats

`GET {endpoint}/config/shards` returns either `bftShardPrefixes` (v2: zero-padded binary
prefix strings, one bit per level of sharding — mainnet `"00".."11"` = 4 shards, testnet
`"000".."111"` = 8) or `shardIds` (legacy: numbers with a leading `1` marker bit, e.g.
`2`, `3`). Shard counts are never hard-coded — a redeploy that changes the split is picked
up automatically. Both formats are stored as strings and cached per network in
`shardCache`; `local` falls back to `['1']` on 404. Every RPC method takes a `shardId`.

`getDisplayShardId()` maps internal → user-facing number and has one branch per format
(binary prefix → `parseInt(s, 2)`; numeric → strip the highest bit). Display IDs are
always 0-based; never show the raw ID.

### "All Shards" is a separate code path

When more than one shard exists, `currentShard` defaults to `'all'`. That mode has its own
loader (`loadBlocksAllShards` — fan out per shard, merge, sort by timestamp, paginate the
merged list client-side), its own summary renderer (`loadBlockSummaryWithShard`, adds a
shard badge), and its own pagination control updater. Changes to the single-shard path
(`loadBlocksSingleShard`, `loadBlockSummary`, `updatePaginationControls`) usually need a
mirrored change in the all-shards one. Clicking a block in all-shards mode routes through
`showBlockDetailFromShard`, which passes a `shardOverride` so RPCs hit the right shard
while `currentShard` stays `'all'`.

`'all'` is a UI-level value only — never pass it to a shard-scoped RPC, the gateway answers
HTTP 400 (`Invalid shard ID format for bft-shard mode`). A block number is likewise
ambiguous in that mode (every shard has its own block N), so `showBlockDetail()` delegates
to `showBlockSearchResults()` whenever it has no `shardOverride` and `currentShard` is
`'all'`: that fans `get_block` out across the shards and renders the matches as the normal
badged summary cards, which the user clicks through to a concrete shard. It covers both
entry points that lack a shard — the search box and a bare `?block=N` URL.

### Pagination is inverted

`currentPage === 0` is the **newest** page. "Next" *decrements* the page, "Prev"
increments it, "First" jumps to the oldest page (`maxPages - 1`), "Latest" to page 0.
Button enable/disable logic follows the same inversion.

### The URL is the state store

`updateURL()` deletes every managed param (`block`, `proof`, `page`, `pageSize`,
`network`, `shard`, `autoRefresh`) then rewrites them from instance state, so a new state
param must be added in three places or it will silently vanish on the next navigation:
`updateURL()`, `initializeFromURL()` (first load), and `handleURLChange()` (popstate).
Conventions: `network` is always written; `shard` only when the network has >1 shard;
booleans are written only when they differ from their `true` default.

Network values coming *out* of the URL always go through
`AggregatorRPCClient.normalizeNetwork()`, which is the single source of truth for what is
selectable (`getNetworks()`: `mainnet`, `testnet2`, `local`) and maps the retired v1
`testnet` value onto `testnet2`. It returns `null` for anything unrecognized, in which case
the caller keeps the current network. Adding a network means touching `getNetworks()`,
`getNetworkEndpoint()`, and the `#networkSelect` options — nothing else.

### Auto-refresh

1s `setInterval` (`updatePolling`). `checkForNewBlocks()` returns early while the block
detail section is visible or a `.modal-overlay` exists, so detail views are never yanked
out from under the user. On page 0 new blocks are *prepended* with animation by
`loadBlocksSmooth` (diffing against `data-block-number` already in the DOM) instead of
rebuilding the list; every other case clears and rebuilds. The manual Refresh button is
force-disabled while auto-refresh is on.

### Block emptiness / transaction counts

`previousBlockHash === rootHash` means the block is definitely empty, and that check is
used to skip the transactions RPC entirely. `block.totalCommitments` (total *including*
aggregated requests) and the number of records actually in the block are displayed as
distinct numbers when they disagree.

### Rendering and theming

Both view functions await RPCs before writing `innerHTML`, so they take a token from
`beginViewRequest()` and bail via `isStaleViewRequest()` after the await — otherwise a slow
earlier request lands on top of a newer view and the URL ends up describing something other
than what is on screen.

All rendering is template literals assigned to `innerHTML`; RPC values are interpolated
without escaping, so treat added fields accordingly. v1 transaction cards use an inline
`onclick="blockExplorer.showInclusionProofFromBlock(...)"` — that is why the instance is
exposed as a global. Theme is a `data-theme` attribute on `<html>` driving CSS variables
defined in `:root` / `[data-theme="dark"]` in `styles.css`, persisted to
`localStorage['theme']`, defaulting to the system preference.

## Gotchas

- The v2 gateways return `shardId: 0` on *every* block regardless of which shard was
  queried, so `block.shardId` is useless for display. The block-detail "Shard ID" row is
  rendered from the shard that was actually queried (`shardForRPC`) for that reason — don't
  "fix" it back to `block.shardId`.
- `getBlock()` still maps the chain's `chainId` string (`"unicity"`) to the number `1`, so
  the "Chain ID" row reads 1 on every network. `forkId` is passed through verbatim.
- `changeNetwork()` selects `shards[0]` after a network switch, while a fresh page load
  (`initializeFromURL`) defaults to `'all'` when a network has multiple shards. Switching
  networks therefore lands on Shard 0 rather than All Shards.
- `showLoading()`/`hideLoading()` reference a `#loading` element that is not in
  `index.html`; they are dead code and would throw if called.
