# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/vayne01-hub/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/vayne01-hub/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A Node 22 program that reads a sealed DefiLlama snapshot (758 protocols at $5M+ TVL) and ranks 264 tokenless and pre-token protocols by implied launch value. The radar-3 model prices every row from the snapshot's own figures with two independent anchors measured on the same launched peers — each category's median market-cap/TVL and a power-law size fit of market cap on TVL — and carries the peers' 25th–75th percentile band beside every price, plus a size-independent signal score (years without a token, momentum, footprint, category standing). Nothing is priced from hardcoded names, and tokenized and pre-token protocols are kept separate. Every row carries a concrete farm plan of 3–12 steps with costs and time, rolled up into an upfront/weekly budget, and the entry ships a static, fully offline dashboard (sortable, filterable, per-protocol detail view with the peer evidence and the model's arithmetic) with screenshots of the real board.

## Run it

```sh
node main.ts # reads /input/snapshot.json, writes /output/board.json and /output/dossier.json
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
