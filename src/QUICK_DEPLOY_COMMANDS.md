# Find Your Project & Deploy

## Step 1: Find Your Project Location

Open Terminal and run:

```bash
# Find the elevenx-betting folder
find ~ -name "elevenx-betting" -type d 2>/dev/null
```

This will search your home directory and show paths like:
```
/Users/adam/Documents/elevenx/solana-programs/elevenx-betting
/Users/adam/Desktop/elevenx/solana-programs/elevenx-betting
/Users/adam/projects/elevenx/solana-programs/elevenx-betting
```

**OR** if you know where you cloned the project:

```bash
# Common locations
cd ~/Documents/elevenx/solana-programs/elevenx-betting
# OR
cd ~/Desktop/elevenx/solana-programs/elevenx-betting
# OR
cd ~/projects/elevenx/solana-programs/elevenx-betting
```

---

## Step 2: Navigate to the Directory

Once you find the path:

```bash
cd /YOUR/ACTUAL/PATH/solana-programs/elevenx-betting
```

**Verify you're in the right place:**

```bash
ls -la
```

You should see:
- `Anchor.toml`
- `programs/`
- `tests/`
- `migrations/`
- `target/`

---

## Step 3: Deploy

```bash
# Set to devnet
solana config set --url devnet

# Check SOL balance
solana balance

# Get free SOL if needed (you need ~0.5 SOL for deployment)
solana airdrop 2

# Build the program
anchor build

# Deploy
anchor deploy
```

---

## Step 4: Copy Program ID

After deployment, you'll see:

```
Deploying program "elevenx_betting"...
Program Id: 8xKjPqRtN5vLmWzYcHbDfGpU2sQ9rT4uV6wX7yA1bC2d
```

**Copy this Program ID!**

---

## Step 5: Update Base44 Dashboard

1. Open your Base44 Dashboard
2. Go to **Settings → Secrets**
3. Find `SOLANA_PROGRAM_ID`
4. Replace with your new Program ID
5. Click **Save**

---

## Quick Command Summary

```bash
# Find project
find ~ -name "elevenx-betting" -type d 2>/dev/null

# Navigate (replace with your actual path)
cd /Users/adam/YOUR_PATH/solana-programs/elevenx-betting

# Deploy
solana config set --url devnet
solana airdrop 2
anchor build
anchor deploy
```

---

**Run the `find` command first to locate your project!** 🚀