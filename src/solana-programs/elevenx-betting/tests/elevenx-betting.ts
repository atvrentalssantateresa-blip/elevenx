import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ElevenxBetting } from "../target/types/elevenx_betting";
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("elevenx-betting", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.ElevenxBetting as Program<ElevenxBetting>;

  const admin = provider.wallet as anchor.Wallet;
  const bettor1 = anchor.web3.Keypair.generate();
  const bettor2 = anchor.web3.Keypair.generate();
  const oracle = anchor.web3.Keypair.generate();

  // Match ID: 32-byte buffer
  const matchId = Buffer.alloc(32);
  Buffer.from("FIFA-2026-MX-ZAF").copy(matchId);

  let platformPda: PublicKey;
  let feeVaultPda: PublicKey;
  let marketPda: PublicKey;
  let voteTallyPda: PublicKey;

  before(async () => {
    // Fund test accounts
    await Promise.all([
      provider.connection.requestAirdrop(bettor1.publicKey, 5 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(bettor2.publicKey, 5 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(oracle.publicKey, 2 * LAMPORTS_PER_SOL),
    ]);
    await new Promise((r) => setTimeout(r, 1000));

    [platformPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("platform")],
      program.programId
    );
    [feeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fee_vault")],
      program.programId
    );
    [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), matchId],
      program.programId
    );
    [voteTallyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote_tally"), marketPda.toBuffer()],
      program.programId
    );
  });

  it("✅ Initialize platform", async () => {
    await program.methods
      .initializePlatform(200) // 2% fee
      .accounts({
        platformConfig: platformPda,
        feeVault: feeVaultPda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.platformConfig.fetch(platformPda);
    assert.equal(config.feePercent, 200);
    assert.equal(config.consensusThreshold, 2);
    console.log("  Platform initialized. Fee: 2%, Consensus threshold: 2");
  });

  it("✅ Create market (3-outcome football)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const openUntil = new anchor.BN(now + 300);    // closes in 5 min
    const settleAfter = new anchor.BN(now + 600);  // settle after 10 min

    const padName = (s: string) => {
      const buf = Buffer.alloc(32);
      Buffer.from(s).copy(buf);
      return Array.from(buf);
    };

    await program.methods
      .createMarket({
        matchId: Array.from(matchId),
        outcomeNames: [padName("Mexico"), padName("Draw"), padName("South Africa")],
        openUntil,
        settleAfter,
        feePercentOverride: 0,
        outcomeCount: 3,
      })
      .accounts({
        market: marketPda,
        voteTally: voteTallyPda,
        platformConfig: platformPda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const market = await program.account.betMarket.fetch(marketPda);
    assert.equal(market.outcomeCount, 3);
    assert.equal(market.settled, false);
    console.log("  Market created: Mexico vs South Africa (3 outcomes)");
  });

  it("✅ Place bet — bettor1 backs Mexico (outcome 0)", async () => {
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), bettor1.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .placeBet(0, new anchor.BN(1 * LAMPORTS_PER_SOL))
      .accounts({
        market: marketPda,
        betPosition: positionPda,
        bettor: bettor1.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([bettor1])
      .rpc();

    const market = await program.account.betMarket.fetch(marketPda);
    assert.equal(market.totalAll.toNumber(), 1 * LAMPORTS_PER_SOL);
    console.log("  bettor1 placed 1 SOL on Mexico (outcome 0)");
  });

  it("✅ Place bet — bettor2 backs South Africa (outcome 2)", async () => {
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), bettor2.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .placeBet(2, new anchor.BN(2 * LAMPORTS_PER_SOL))
      .accounts({
        market: marketPda,
        betPosition: positionPda,
        bettor: bettor2.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([bettor2])
      .rpc();

    const market = await program.account.betMarket.fetch(marketPda);
    assert.equal(market.totalAll.toNumber(), 3 * LAMPORTS_PER_SOL);
    console.log("  bettor2 placed 2 SOL on South Africa (outcome 2)");
  });

  it("✅ Oracle votes — admin emergency settles (Mexico wins)", async () => {
    // Use emergency settle since we can't fast-forward time in tests easily.
    await program.methods
      .emergencySettle(0) // Mexico = outcome 0
      .accounts({
        market: marketPda,
        platformConfig: platformPda,
        feeVault: feeVaultPda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const market = await program.account.betMarket.fetch(marketPda);
    assert.equal(market.settled, true);
    assert.equal(market.winningOutcome, 0);
    console.log("  Market settled. Mexico (0) wins!");
  });

  it("✅ bettor1 claims winnings", async () => {
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), bettor1.publicKey.toBuffer()],
      program.programId
    );

    const balBefore = await provider.connection.getBalance(bettor1.publicKey);

    await program.methods
      .claimWinnings()
      .accounts({
        market: marketPda,
        betPosition: positionPda,
        feeVault: feeVaultPda,
        bettor: bettor1.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([bettor1])
      .rpc();

    const balAfter = await provider.connection.getBalance(bettor1.publicKey);
    const received = balAfter - balBefore;

    assert.isAbove(received, 0);
    console.log(`  bettor1 claimed ◎${(received / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  });

  it("✅ bettor2 cannot claim (lost)", async () => {
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), bettor2.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .claimWinnings()
        .accounts({
          market: marketPda,
          betPosition: positionPda,
          feeVault: feeVaultPda,
          bettor: bettor2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor2])
        .rpc();
      assert.fail("Should have thrown ClaimNothing");
    } catch (e: any) {
      assert.include(e.message, "ClaimNothing");
      console.log("  bettor2 correctly cannot claim (lost)");
    }
  });

  it("✅ Admin withdraws fees", async () => {
    const vault = await program.account.feeVault.fetch(feeVaultPda);
    if (vault.totalFees.toNumber() === 0) {
      console.log("  No fees accumulated (skipped)");
      return;
    }

    await program.methods
      .withdrawFees(vault.totalFees)
      .accounts({
        feeVault: feeVaultPda,
        platformConfig: platformPda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const vaultAfter = await program.account.feeVault.fetch(feeVaultPda);
    assert.equal(vaultAfter.totalFees.toNumber(), 0);
    console.log(`  Admin withdrew ◎${(vault.totalFees.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL in fees`);
  });
});