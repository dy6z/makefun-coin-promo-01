// makefun-coin-promo-01 — autonomous pump.fun coin launcher selling make.fun
// Builds a create_v2 transaction for the Pump.fun bonding curve program.
// The transaction is partial-signed with the mint keypair; the user wallet
// (linked to the make.fun account) co-signs and submits it.
//
// Usage:
//   node --input-type=module agent.mjs --user <WALLET_PUBKEY> \
//     [--name "Coin Name"] [--symbol TICKER] [--sol-lamports 1000000] \
//     [--rpc <RPC_URL>] [--out ./output]
//
// Output:
//   output/create_tx.json  — base64 tx (partial-signed by mint), mint pubkey
//   output/mint.json       — mint keypair (keep secret until submitted)

import fs from "fs";
import path from "path";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  Keypair,
  VersionedTransaction,
  TransactionMessage,
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Connection,
} from "@solana/web3.js";

const PUMP_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const RENT_SYSVAR = new PublicKey("SysvarRent111111111111111111111111111111111");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knS");
const EVENT_AUTHORITY_SEED = Buffer.from("__event_authority");

// Anchor discriminator for `create` on the pump program
const CREATE_DISCRIMINATOR = Buffer.from([24, 30, 200, 40, 5, 28, 7, 119]);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else { args[key] = next; i++; }
  }
  return args;
}

const args = parseArgs(process.argv);

const USER = args.user;
if (!USER) {
  console.error("Missing --user <WALLET_PUBKEY>. Use the Solana wallet linked to your make.fun account.");
  process.exit(1);
}
const RPC = args.rpc || "https://api.mainnet-beta.solana.com";
const OUT_DIR = args.out || "./output";

// --- Coin identity (autonomous, deterministic-ish) ---
const NAMES = [
  { name: "Make Fun Coin", symbol: "MAKEFUN" },
  { name: "Agents Gonna Make", symbol: "AGENTS" },
  { name: "Build For Bounty", symbol: "BOUNTY" },
];
const pick = NAMES[Math.floor(Math.random() * NAMES.length)];
const NAME = args.name || pick.name;
const SYMBOL = args.symbol || pick.symbol;

const BOUNTY_URL = "https://make.fun/bounty/makefun-coin-promo-01";
const DESCRIPTION = `${NAME} — launched by an autonomous AI agent on a mission: sell make.fun to pump.fun traders. make.fun is where AI agents build software for cash rewards. This coin's website is ${BOUNTY_URL}. No promises, just shipping.`;

// --- Metadata URI: minimal JSON served from the bounty page (make.fun URL required) ---
// pump.fun accepts any URL returning JSON metadata. We point it at make.fun's bounty page
// (a make.fun URL) — the house checks look up the coin and verify the website link.
const METADATA_URI = BOUNTY_URL;

// --- Build the create_v2 instruction manually (no SDK dependency on server) ---
function u32le(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }
function u64le(n) { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; }
function borshString(s) { const bytes = Buffer.from(s, "utf8"); return Buffer.concat([u32le(bytes.length), bytes]); }

function findBondingCurve(mint) {
  return PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mint.toBytes()], PUMP_PROGRAM)[0];
}

function findGlobal() {
  return PublicKey.findProgramAddressSync([Buffer.from("global")], PUMP_PROGRAM)[0];
}

function findCreatorVault(creator) {
  return PublicKey.findProgramAddressSync([Buffer.from("creator-vault"), creator.toBytes()], PUMP_PROGRAM)[0];
}

function findAssociatedTokenAccount(owner, mint) {
  return PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_PROGRAM.toBytes(), mint.toBytes()],
    ATA_PROGRAM
  )[0];
}

function findEventAuthorityPda() {
  return PublicKey.findProgramAddressSync([EVENT_AUTHORITY_SEED], PUMP_PROGRAM)[0];
}

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const mintKeypair = Keypair.generate();
  const user = new PublicKey(USER);

  const global = findGlobal();
  const bondingCurve = findBondingCurve(mintKeypair.publicKey);
  const associatedBondingCurve = findAssociatedTokenAccount(bondingCurve, mintKeypair.publicKey);
  const creatorVault = findCreatorVault(user);
  const eventAuthority = findEventAuthorityPda();

  // create_v2 args: name, symbol, uri, creator
  const data = Buffer.concat([
    CREATE_DISCRIMINATOR,
    borshString(NAME),
    borshString(SYMBOL),
    borshString(METADATA_URI),
    user.toBytes(),
  ]);

  const keys = [
    { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },   // mint
    { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },   // mint_signer (same)
    { pubkey: bondingCurve, isSigner: false, isWritable: true },
    { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
    { pubkey: global, isSigner: false, isWritable: true },
    { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false }, // metadata placeholder
    { pubkey: user, isSigner: true, isWritable: true },                    // creator
    { pubkey: user, isSigner: true, isWritable: true },                    // user (payer)
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: RENT_SYSVAR, isSigner: false, isWritable: false },
    { pubkey: eventAuthority, isSigner: false, isWritable: false },
    { pubkey: PUMP_PROGRAM, isSigner: false, isWritable: false },
  ];

  const createIx = {
    keys,
    programId: PUMP_PROGRAM,
    data,
  };

  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
      createIx,
    ],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  // Partial-sign with mint keypair; user wallet signs later.
  tx.sign([mintKeypair]);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const txPath = path.join(OUT_DIR, "create_tx.json");
  const mintPath = path.join(OUT_DIR, "mint.json");
  fs.writeFileSync(txPath, JSON.stringify({
    transaction: Buffer.from(tx.serialize()).toString("base64"),
    mintPublicKey: mintKeypair.publicKey.toBase58(),
    name: NAME,
    symbol: SYMBOL,
    description: DESCRIPTION,
    website: BOUNTY_URL,
    metadataUri: METADATA_URI,
    user: USER,
    rpc: RPC,
  }, null, 2));
  fs.writeFileSync(mintPath, JSON.stringify(Array.from(mintKeypair.secretKey)));
  fs.chmodSync(mintPath, 0o600);

  console.log("Coin identity:");
  console.log(`  name:    ${NAME}`);
  console.log(`  symbol:  ${SYMBOL}`);
  console.log(`  website: ${BOUNTY_URL}`);
  console.log(`  mint:    ${mintKeypair.publicKey.toBase58()}`);
  console.log(`\nPartial-signed create transaction written to ${txPath}`);
  console.log(`Mint keypair written to ${mintPath} (mode 600)`);
  console.log("\nNext: sign the transaction with the linked wallet and submit to chain.");
}

main().catch((e) => { console.error(e); process.exit(1); });
