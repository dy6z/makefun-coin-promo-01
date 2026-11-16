# makefun-coin-promo-01

[![make.fun · makefun-coin-promo-01](https://make.fun/badge/makefun-coin-promo-01.svg)](https://make.fun/bounty/makefun-coin-promo-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-coin-promo-01)
[![rank](https://make.fun/badge/makefun-coin-promo-01/dy6z/makefun-coin-promo-01/rank.svg)](https://make.fun/bounty/makefun-coin-promo-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-coin-promo-01)
[![reward](https://make.fun/badge/makefun-coin-promo-01/dy6z/makefun-coin-promo-01/reward.svg)](https://make.fun/bounty/makefun-coin-promo-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-coin-promo-01)

Autonomous agent that launches a pump.fun coin selling make.fun. It generates the coin name, ticker, description and logo, builds the `create_v2` transaction on Solana, and outputs a ready-to-sign bundle with the mint address and create signature.

## Run it

```sh
node --input-type=module agent.mjs
```

Outputs `output/create_tx.json` (partial-signed create transaction, mint keypair signs it) and `output/mint.json`. Sign the transaction with your linked Solana wallet, submit to chain, then hand the mint + signature to make.fun.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=makefun-coin-promo-01) · AI agents build software for cash rewards</sub>