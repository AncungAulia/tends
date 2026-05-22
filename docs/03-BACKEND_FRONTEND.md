# Backend & Frontend Specification

---

# PART A: BACKEND (Node.js + TypeScript)
## Owner: James (with Nabil for AI components)

## A.1 Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│  API Gateway (Express/Fastify)                          │
│  - Auth middleware (Privy JWT verify)                   │
│  - Rate limiting                                        │
│  - WebSocket upgrade                                    │
└─────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────┐
│  Service Layer                                          │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐                │
│  │ HermesAgent    │  │ ChatService    │                │
│  │ Runtime        │  │                │                │
│  └────────────────┘  └────────────────┘                │
│  ┌────────────────┐  ┌────────────────┐                │
│  │ Indexer        │  │ PricingService │                │
│  │ Service        │  │ (CoinGecko)    │                │
│  └────────────────┘  └────────────────┘                │
│  ┌────────────────┐  ┌────────────────┐                │
│  │ GasFunder      │  │ TxExecutor     │                │
│  │ Service        │  │                │                │
│  └────────────────┘  └────────────────┘                │
└─────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────┐
│  Data Layer                                             │
│  - Postgres (Prisma ORM)                                │
│  - Redis (cache, rate limiting)                         │
└─────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────┐
│  External                                                │
│  - Mantle RPC (chain interaction)                       │
│  - CoinGecko API                                        │
│  - OpenRouter (LLM)                                     │
└─────────────────────────────────────────────────────────┘
```

## A.2 API Endpoints

```
POST   /api/auth/verify
       Body: { privyToken }
       → Verify JWT, create/update user
       
GET    /api/strategies
       → List all strategies (Low/Med/High/Custom) with current APY
       
GET    /api/strategies/:id
       → Detailed strategy info + projections
       
POST   /api/projection
       Body: { strategyId, capital, durationDays }
       Body (custom): { lowPct, medPct, highPct, capital, durationDays }
       → Returns { bestCase, baseCase, worstCase, breakdown }
       
GET    /api/users/me/position
       → User's current positions + PnL
       
GET    /api/users/me/activity
       → User's activity history
       
POST   /api/users/me/prepare-deposit
       Body: { strategyId | customAllocation, amount }
       → Returns tx data ready to sign (includes permit data)
       → Triggers gas funder check
       
POST   /api/users/me/prepare-withdraw
       Body: { amount, vaultId }
       → Returns tx data ready to sign
       
POST   /api/users/me/prepare-switch
       Body: { fromStrategy, toStrategy | customAllocation, amount }
       → Returns atomic withdraw+deposit tx data
       
POST   /api/chat
       Body: { message, sessionId?, context? }
       → SSE stream from Hermes Agent
       → Agent may return actionable cards (e.g., "Confirm Withdraw" button)
       
GET    /api/apy/history
       Query: { asset, days }
       → Historical APY data for chart
       
WS     /ws/dashboard
       → Subscribe to: position updates, PnL changes, agent activity
```

## A.3 Hermes Agent Runtime

### Three Specialized Agents

```typescript
// agents/portfolio-assistant.ts
import { HermesAgent } from '@nous/hermes-agent';

export const portfolioAssistant = new HermesAgent({
  name: 'PortfolioAssistant',
  model: process.env.LLM_MODEL || 'anthropic/claude-sonnet-4.6',
  apiBase: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_KEY,
  
  systemPrompt: `
You are a portfolio assistant for an AI-managed RWA yield aggregator on Mantle Network.

Your role:
- Help users understand their portfolio
- Explain strategies clearly (Low/Medium/High/Custom)
- Provide projections based on real APY data
- Explain risks honestly
- Initiate actions (deposit/withdraw/switch) by preparing transactions

Strategies:
- LOW: 90% mUSD + 10% USDY, ~5% APY, very low volatility (treasuries)
- MEDIUM: 40% mUSD + 30% mETH + 30% cmETH, ~5-6% APY, moderate
- HIGH: 40% cmETH + 30% sUSDe + 20% mETH + 10% MNT, ~8-12% APY, high
- CUSTOM: User-defined mix

You have access to these tools:
- readUserPosition: get current user portfolio
- readAPYs: get current APYs for all assets
- computeProjection: project future value
- prepareWithdrawTx: prepare tx for user to sign
- prepareDepositTx: prepare deposit transaction
- explainRisk: get risk breakdown for asset
- getAgentActivity: read recent agent activity

Be concise, direct, no jargon. Use IDR examples when discussing in Bahasa Indonesia.
Always mention risks. Never promise specific returns.

When user asks to withdraw/deposit, prepare the tx and return as actionable card.
`,
  
  tools: [
    readUserPositionTool,
    readAPYsTool,
    computeProjectionTool,
    prepareWithdrawTxTool,
    prepareDepositTxTool,
    explainRiskTool,
    getAgentActivityTool,
  ],
});

// agents/yield-optimizer.ts
export const yieldOptimizer = new HermesAgent({
  name: 'YieldOptimizer',
  model: process.env.LLM_MODEL,
  
  systemPrompt: `
You optimize yield across vaults. Run every hour.

Your job:
1. Read current APYs of all underlying assets
2. Compare with target allocations
3. If APY differential > 50bps for any pair, prepare rebalance recommendation
4. Compute risk-adjusted return for proposed rebalance
5. If beneficial, execute via executeRebalance tool

Constraints:
- Cannot change target asset allocation (only rebalance to it)
- Cannot move funds outside vault
- Max 1 rebalance per vault per hour
`,
  
  tools: [
    readAPYsTool,
    readVaultStateTool,
    executeRebalanceTool, // calls smart contract
  ],
});

// agents/risk-monitor.ts
export const riskMonitor = new HermesAgent({
  name: 'RiskMonitor',
  model: process.env.LLM_MODEL,
  
  systemPrompt: `
You monitor risk across all vaults. Run every 15 minutes.

Check for:
1. Stablecoin peg deviation (USDY, mUSD, USDe, sUSDe should be ±0.5% of $1)
2. cmETH/mETH ratio anomaly
3. Mantle network congestion (high gas)
4. Major DEX liquidity changes

If critical (>2% deviation OR liquidity drop >50%):
- Log alert
- For severe: trigger emergencyPause on affected vault

Be cautious. False positives are better than missing real risks.
`,
  
  tools: [
    readPriceFeedsTool,
    readDEXLiquidityTool,
    triggerEmergencyPauseTool,
    logAlertTool,
  ],
});
```

### Tool Definitions

```typescript
// tools/read-user-position.ts
export const readUserPositionTool = {
  name: 'readUserPosition',
  description: 'Read user current portfolio position',
  parameters: {
    type: 'object',
    properties: {
      walletAddress: { type: 'string', description: 'User wallet address' }
    },
    required: ['walletAddress']
  },
  execute: async ({ walletAddress }) => {
    const positions = await db.userPositions.findMany({ where: { walletAddress } });
    const enriched = await Promise.all(positions.map(async (p) => {
      const currentValue = await getVaultValue(p.vaultId, p.shares);
      return {
        strategy: getStrategyName(p.vaultId),
        shares: p.shares,
        initialDeposit: p.initialDeposit,
        currentValue,
        pnl: currentValue - p.initialDeposit,
        pnlPercent: ((currentValue - p.initialDeposit) / p.initialDeposit) * 100
      };
    }));
    return enriched;
  }
};

// tools/prepare-withdraw-tx.ts
export const prepareWithdrawTxTool = {
  name: 'prepareWithdrawTx',
  description: 'Prepare withdraw transaction. User will sign separately.',
  parameters: {
    type: 'object',
    properties: {
      walletAddress: { type: 'string' },
      amount: { type: 'number', description: 'USDC amount to withdraw' },
      vaultId: { type: 'number', description: '1=Low, 2=Med, 3=High, 4=Composite' }
    },
    required: ['walletAddress', 'amount', 'vaultId']
  },
  execute: async ({ walletAddress, amount, vaultId }) => {
    // Ensure gas
    await gasFunder.ensureGasFunded(walletAddress);
    
    // Calculate breakdown
    const breakdown = await calculateWithdrawBreakdown(walletAddress, amount, vaultId);
    
    // Encode tx
    const vault = getVaultContract(vaultId);
    const amountWei = parseUnits(amount.toString(), 6); // USDC has 6 decimals
    const data = vault.interface.encodeFunctionData('withdraw', [
      amountWei,
      walletAddress, // receiver
      walletAddress, // owner
    ]);
    
    return {
      type: 'actionable_card',
      action: 'WITHDRAW',
      txData: {
        to: vault.target,
        data,
        value: '0',
      },
      breakdown: {
        amount,
        estimatedReceived: breakdown.estimatedReceived,
        slippage: breakdown.slippage,
        gasCovered: true,
      },
      confirmLabel: `Confirm Withdraw ${amount} USDC`,
    };
  }
};
```

## A.4 Indexer Service

```typescript
// services/indexer.ts
export class IndexerService {
  // APY Scraper (every 5 min)
  async scrapeAPYs() {
    const apys = {
      mUSD: await this.fetchMUSDApy(),
      USDY: await this.fetchUSDYApy(),
      mETH: await this.fetchMETHApy(),
      cmETH: await this.fetchCMETHApy(),
      sUSDe: await this.fetchSUSDEApy(),
    };
    
    for (const [asset, apy] of Object.entries(apys)) {
      await db.apyHistory.create({
        data: { asset, apy, snapshotAt: new Date() }
      });
    }
  }
  
  private async fetchMUSDApy(): Promise<number> {
    // Read from Ondo's RWADynamicRateOracle contract
    const oracle = new ethers.Contract(ONDO_ORACLE_ADDR, ONDO_ABI, provider);
    const range = await oracle.getCurrentRange();
    const dailyRate = range.dailyInterestRate;
    return ((dailyRate ** 365) - 1) * 100; // annualized %
  }
  
  private async fetchMETHApy(): Promise<number> {
    // Read from Mantle LSP staking contract
    // or scrape from Mantle's official API
    const response = await fetch('https://api.mantle.xyz/v1/meth/apy');
    return response.json().then(d => d.apy);
  }
  
  // ... other fetchers
  
  // Event Listener (real-time)
  async listenToVaultEvents() {
    const vaults = [lowVault, mediumVault, highVault, compositeVault];
    
    for (const vault of vaults) {
      vault.on('Deposit', async (caller, receiver, assets, shares) => {
        await db.userPositions.upsert({
          where: { walletAddress_vaultId: { walletAddress: receiver, vaultId: vault.id } },
          create: {
            walletAddress: receiver,
            vaultId: vault.id,
            shares: shares,
            initialDeposit: assets,
          },
          update: {
            shares: { increment: shares },
            initialDeposit: { increment: assets },
          },
        });
      });
      
      vault.on('Withdraw', async (caller, receiver, owner, assets, shares) => {
        await db.userPositions.update({
          where: { walletAddress_vaultId: { walletAddress: owner, vaultId: vault.id } },
          data: {
            shares: { decrement: shares },
          },
        });
      });
      
      vault.on('Rebalanced', async (timestamp, agent, oldAlloc, newAlloc, txHashes) => {
        await db.agentActivity.create({
          data: {
            vaultId: vault.id,
            action: 'REBALANCE',
            metadata: { oldAlloc, newAlloc, txHashes },
            timestamp: new Date(timestamp * 1000),
            agent,
          },
        });
        
        // Broadcast via WebSocket
        wsServer.broadcast('rebalance', { vaultId: vault.id, ...rebalanceData });
      });
    }
  }
}
```

## A.5 Gas Funder Service

```typescript
// services/gas-funder.ts
export class GasFunderService {
  private funderWallet: ethers.Wallet;
  
  constructor() {
    this.funderWallet = new ethers.Wallet(process.env.GAS_FUNDER_PK!, provider);
  }
  
  async ensureGasFunded(userWallet: string): Promise<void> {
    const balance = await provider.getBalance(userWallet);
    const THRESHOLD = parseEther('0.05');
    const TOP_UP_AMOUNT = parseEther('0.1');
    
    if (balance < THRESHOLD) {
      console.log(`Topping up ${userWallet} with 0.1 MNT`);
      const tx = await this.funderWallet.sendTransaction({
        to: userWallet,
        value: TOP_UP_AMOUNT,
      });
      await tx.wait();
      
      await db.gasTopUps.create({
        data: {
          recipient: userWallet,
          amount: TOP_UP_AMOUNT.toString(),
          txHash: tx.hash,
          timestamp: new Date(),
        },
      });
    }
  }
  
  async getMonthlyTopUpStats() {
    const stats = await db.gasTopUps.aggregate({
      where: { timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      _sum: { amount: true },
      _count: true,
    });
    return stats;
  }
}
```

## A.6 Pricing Service (CoinGecko)

```typescript
// services/pricing.ts
const COINGECKO_IDS = {
  MNT: 'mantle',
  mETH: 'mantle-staked-ether',
  cmETH: 'mantle-restaked-eth',
  mUSD: 'mantle-usd',
  USDY: 'ondo-us-dollar-yield',
  USDe: 'ethena-usde',
  sUSDe: 'ethena-staked-usde',
  USDC: 'usd-coin',
};

export class PricingService {
  private cache = new Map<string, { value: number; expiresAt: number }>();
  private CACHE_TTL = 30_000; // 30s
  
  async getPrice(asset: keyof typeof COINGECKO_IDS): Promise<number> {
    const cached = this.cache.get(asset);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    
    const ids = Object.values(COINGECKO_IDS).join(',');
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
    );
    const data = await response.json();
    
    // Update cache for all
    for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
      this.cache.set(symbol, {
        value: data[geckoId]?.usd ?? 0,
        expiresAt: Date.now() + this.CACHE_TTL,
      });
    }
    
    return this.cache.get(asset)!.value;
  }
}
```

## A.7 Database Schema (Prisma)

```prisma
model User {
  walletAddress    String   @id
  privyId          String?
  createdAt        DateTime @default(now())
  lastActiveAt     DateTime @updatedAt
  
  positions        UserPosition[]
  chatMessages     ChatMessage[]
}

model UserPosition {
  walletAddress    String
  vaultId          Int
  shares           Decimal  @db.Decimal(78, 0)
  initialDeposit   Decimal  @db.Decimal(78, 0)
  
  user             User     @relation(fields: [walletAddress], references: [walletAddress])
  
  @@id([walletAddress, vaultId])
}

model UserAllocation {
  walletAddress    String   @id
  lowBps           Int      // 0-10000
  medBps           Int
  highBps          Int
  updatedAt        DateTime @updatedAt
}

model ChatMessage {
  id               BigInt   @id @default(autoincrement())
  walletAddress    String
  role             String   // 'user' | 'assistant'
  content          String
  metadata         Json?
  createdAt        DateTime @default(now())
  
  user             User     @relation(fields: [walletAddress], references: [walletAddress])
}

model ApyHistory {
  asset            String
  apy              Decimal  @db.Decimal(10, 4)
  snapshotAt       DateTime @default(now())
  
  @@id([asset, snapshotAt])
}

model AgentActivity {
  id               BigInt   @id @default(autoincrement())
  vaultId          Int
  action           String
  metadata         Json
  txHash           String?
  blockNumber      BigInt?
  agentAddress     String
  timestamp        DateTime
}

model GasTopUp {
  id               BigInt   @id @default(autoincrement())
  recipient        String
  amount           String   // wei as string
  txHash           String
  timestamp        DateTime @default(now())
}
```

---

# PART B: FRONTEND (Next.js 15)
## Owner: Ancung

## B.1 Page Routes

```
app/
├── page.tsx                           # Landing
├── connect/
│   └── page.tsx                       # Privy connect wrapper
├── strategies/
│   ├── page.tsx                       # Strategy picker (4 cards)
│   └── [id]/
│       └── page.tsx                   # Strategy detail
├── custom/
│   └── page.tsx                       # Custom mix designer
├── deploy/
│   ├── confirm/page.tsx               # Confirm deposit
│   └── progress/page.tsx              # Live progress
├── dashboard/
│   └── page.tsx                       # User position + activity
├── chat/
│   └── page.tsx                       # Full chat
└── api/                               # Next.js API routes (proxy ke backend)
```

## B.2 Landing Page

```tsx
// app/page.tsx
export default function Landing() {
  return (
    <main className="min-h-screen bg-truus-black text-truus-cream">
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col justify-center px-8">
        <div className="max-w-4xl">
          <h1 className="text-truus-display font-bold leading-tight">
            <span className="block">Fire your analyst,</span>
            <span className="block text-truus-accent">deploy your agent.</span>
          </h1>
          
          <p className="mt-8 text-2xl max-w-2xl">
            AI-managed RWA portfolios on Mantle. 
            Three strategies. One mix-it-yourself. Always on.
          </p>
          
          <div className="mt-12 flex gap-6">
            <Button variant="primary" size="lg" href="/strategies">
              Deploy your agent →
            </Button>
            <Button variant="ghost" size="lg" href="/chat">
              Ask first
            </Button>
          </div>
        </div>
        
        {/* Floating stickers */}
        <Sticker name="anchor" className="absolute top-20 right-20 rotate-12" />
        <Sticker name="comet" className="absolute bottom-40 right-40 -rotate-6" />
      </section>
      
      {/* How it works */}
      <section>...</section>
      
      {/* Strategy cards preview */}
      <section>...</section>
    </main>
  );
}
```

## B.3 Strategy Picker

```tsx
// app/strategies/page.tsx
export default function StrategyPicker() {
  const { user } = usePrivy();
  const balance = useUserUSDCBalance(user?.wallet.address);
  
  return (
    <main className="min-h-screen bg-truus-black p-8">
      <Header />
      
      <h1 className="text-truus-display mt-12">Pick your strategy.</h1>
      <p className="text-xl mt-4">You have {balance} USDC ready to deploy.</p>
      
      <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StrategyCard
          id="LOW"
          icon="anchor"
          name="LOW"
          tag="treasuries only"
          apy="~5%"
          allocation="90% mUSD + 10% USDY"
          risk="Very Low"
        />
        <StrategyCard
          id="MEDIUM"
          icon="drift"
          name="MEDIUM"
          tag="balanced basket"
          apy="~5-6%"
          allocation="40% mUSD + 30% mETH + 30% cmETH"
          risk="Moderate"
        />
        <StrategyCard
          id="HIGH"
          icon="comet"
          name="HIGH"
          tag="yield max"
          apy="~8-12%"
          allocation="40% cmETH + 30% sUSDe + 20% mETH + 10% MNT"
          risk="High"
        />
        <StrategyCard
          id="CUSTOM"
          icon="mix"
          name="CUSTOM"
          tag="mix it yourself"
          apy="computed"
          allocation="Pick your own ratio"
          risk="Variable"
        />
      </div>
    </main>
  );
}
```

## B.4 Custom Mix Designer

```tsx
// app/custom/page.tsx
export default function CustomMix() {
  const [allocation, setAllocation] = useState({ low: 33, med: 33, high: 34 });
  
  // Lock the third slider, derive from others
  const handleSlider = (key: 'low' | 'med', value: number) => {
    const otherKey = key === 'low' ? 'med' : 'low';
    const otherValue = allocation[otherKey];
    
    // Ensure low + med + high = 100
    const remaining = 100 - value - otherValue;
    if (remaining < 0) {
      // Reduce other
      setAllocation({
        ...allocation,
        [key]: value,
        [otherKey]: 100 - value,
        high: 0,
      });
    } else {
      setAllocation({
        ...allocation,
        [key]: value,
        high: remaining,
      });
    }
  };
  
  const projection = useProjection(allocation, 1000); // for $1000
  
  return (
    <main className="min-h-screen bg-truus-black p-8">
      <h1 className="text-truus-display">Mix your strategy.</h1>
      <p className="mt-4 text-xl">Drag the sliders. See the result.</p>
      
      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Sliders */}
        <div className="space-y-8">
          <SliderSection
            label="Low Risk"
            description="mUSD + USDY treasuries"
            value={allocation.low}
            onChange={(v) => handleSlider('low', v)}
            color="green"
          />
          <SliderSection
            label="Medium Risk"
            description="ETH staking + treasuries"
            value={allocation.med}
            onChange={(v) => handleSlider('med', v)}
            color="yellow"
          />
          <SliderSection
            label="High Risk"
            description="Restaked ETH + Ethena"
            value={allocation.high}
            color="red"
            disabled // derived from others
          />
        </div>
        
        {/* Live preview */}
        <div>
          <AllocationChart allocation={allocation} />
          <ProjectionCard projection={projection} />
          <RiskBreakdown allocation={allocation} />
        </div>
      </div>
      
      <Button onClick={proceed}>Deploy this mix →</Button>
    </main>
  );
}
```

## B.5 Dashboard

```tsx
// app/dashboard/page.tsx
export default function Dashboard() {
  const position = usePosition();
  const activity = useActivity();
  const { isOpen: chatOpen, toggle: toggleChat } = useChatWidget();
  
  return (
    <main className="min-h-screen bg-truus-black p-8">
      <Header />
      
      {/* Position Summary */}
      <section className="mt-8">
        <PositionCard
          deposited={position.initialDeposit}
          currentValue={position.currentValue}
          pnl={position.pnl}
          pnlPercent={position.pnlPercent}
        />
      </section>
      
      {/* Allocation + Actions */}
      <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <AllocationDonut allocation={position.allocation} />
        <ActionButtons>
          <Button onClick={openDeposit}>Add funds</Button>
          <Button onClick={openWithdraw} variant="outline">Withdraw</Button>
          <Button onClick={openSwitch} variant="ghost">Switch strategy</Button>
        </ActionButtons>
      </section>
      
      {/* Agent Activity Feed */}
      <section className="mt-8">
        <h2>Your agent's activity</h2>
        <ActivityFeed items={activity} />
      </section>
      
      {/* Floating Chat */}
      <FloatingChatWidget open={chatOpen} onClose={toggleChat} />
    </main>
  );
}
```

## B.6 Chat Component (with Actionable Cards)

```tsx
// components/chat/ChatInterface.tsx
export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  
  const sendMessage = async () => {
    const userMsg: Message = { role: 'user', content: input };
    setMessages([...messages, userMsg]);
    setInput('');
    
    // Stream response
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: input }),
    });
    
    const reader = response.body!.getReader();
    let assistantMsg: Message = { role: 'assistant', content: '', cards: [] };
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const events = parseSSE(chunk);
      
      for (const event of events) {
        if (event.type === 'text') {
          assistantMsg.content += event.data;
          setMessages([...messages, userMsg, assistantMsg]);
        } else if (event.type === 'actionable_card') {
          assistantMsg.cards.push(event.data);
          setMessages([...messages, userMsg, assistantMsg]);
        }
      }
    }
  };
  
  return (
    <div className="chat-container">
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg}>
          {msg.cards?.map((card, j) => (
            <ActionableCard key={j} card={card} onConfirm={handleAction} />
          ))}
        </MessageBubble>
      ))}
      
      <ChatInput value={input} onChange={setInput} onSubmit={sendMessage} />
    </div>
  );
}

// ActionableCard - rendered di chat
function ActionableCard({ card, onConfirm }) {
  const { sendTransaction } = usePrivy();
  
  const handleConfirm = async () => {
    // Privy seamless signing
    const txHash = await sendTransaction(card.txData);
    onConfirm(txHash);
  };
  
  return (
    <div className="actionable-card border border-truus-cream p-4 mt-2 rounded">
      <h3>{card.action} {card.breakdown.amount} USDC</h3>
      <BreakdownTable items={card.breakdown} />
      <div className="flex gap-2 mt-4">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={handleConfirm}>
          {card.confirmLabel}
        </Button>
      </div>
    </div>
  );
}
```

## B.7 Privy Setup

```tsx
// app/providers.tsx
import { PrivyProvider } from '@privy-io/react-auth';
import { mantle, mantleSepolia } from 'viem/chains';

export function Providers({ children }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['email', 'google', 'twitter', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#FAFAF3', // truus-cream
          logo: '/logo.svg',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false, // smoother UX
          noPromptOnSignature: true, // seamless signing!
        },
        defaultChain: mantle,
        supportedChains: [mantle, mantleSepolia],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```

**Key Privy settings for seamless UX:**
- `createOnLogin: 'users-without-wallets'` — Auto-create wallet for non-crypto users
- `noPromptOnSignature: true` — Sign tanpa popup external (in-app modal aja)
- `requireUserPasswordOnCreate: false` — No password barrier

## B.8 Truus Aesthetic Components

### Color Palette

```css
:root {
  --truus-black: #0A0A0A;
  --truus-cream: #FAFAF3;
  --truus-accent: #FF6B35;
  --truus-mute: #404040;
}
```

### Typography

```css
.text-truus-display {
  font-family: 'Editorial New', 'Times New Roman', serif;
  font-size: clamp(3rem, 8vw, 7rem);
  letter-spacing: -0.02em;
}
```

### Sticker System

```tsx
// components/ui/Sticker.tsx
const STICKERS = {
  anchor: '/stickers/anchor.svg',
  comet: '/stickers/comet.svg',
  drift: '/stickers/wave.svg',
  mix: '/stickers/mix.svg',
  spark: '/stickers/spark.svg',
};

export function Sticker({ name, className }) {
  return <img src={STICKERS[name]} className={className} alt="" />;
}
```

### Annotation (Hand-drawn ovals/arrows)

```tsx
// components/ui/Annotation.tsx
export function Annotation({ children, type = 'oval' }) {
  return (
    <span className="relative inline-block">
      {children}
      <svg className="absolute inset-0 -inset-x-4 -inset-y-2 pointer-events-none">
        {type === 'oval' && <ellipse ... />}
        {type === 'underline' && <path ... />}
      </svg>
    </span>
  );
}
```

---

# PART C: AI/SIGNAL PIPELINE
## Owner: Nabil

## C.1 Tasks Breakdown

### Task 1: Mantle Asset APY Scraper

```typescript
// scripts/scrape-apys.ts
export async function scrapeAllAPYs() {
  const apys = {
    mUSD: await scrapeMUSDApy(),    // From Ondo oracle
    USDY: await scrapeUSDYApy(),    // From Ondo
    mETH: await scrapeMETHApy(),    // From Mantle LSP
    cmETH: await scrapeCMETHApy(),  // From mETH protocol
    sUSDe: await scrapeSUSDEApy(),  // From Ethena
    USDe: await scrapeUSDEApy(),    // From Ethena rewards
  };
  
  await db.apyHistory.createMany({
    data: Object.entries(apys).map(([asset, apy]) => ({
      asset,
      apy,
      snapshotAt: new Date(),
    })),
  });
}
```

### Task 2: Prompt Engineering

**Portfolio Assistant System Prompt** — kasih dalam Bahasa Indonesia mix English:

```
Lo adalah portfolio assistant untuk AI-managed RWA yield aggregator di Mantle.

Karakter lo:
- Direct, no jargon
- Gunain mix Bahasa Indonesia + English natural
- Honest soal risiko
- Concrete dengan angka

Strategy yang lo handle:
- LOW: 90% mUSD + 10% USDY, ~5% APY, paling aman (treasury-backed)
- MEDIUM: 40% mUSD + 30% mETH + 30% cmETH, ~5-6% APY, balanced
- HIGH: 40% cmETH + 30% sUSDe + 20% mETH + 10% MNT, ~8-12%, agresif
- CUSTOM: User-defined mix

Saat user nanya:
1. Read context (position, balance)
2. Jawab specific dengan angka
3. Mention risk relevant
4. Kalau bisa kasih projection
5. Kalau user mau action (deposit/withdraw), prepare tx → return actionable card

Tools yang available:
- readUserPosition, readAPYs, computeProjection
- prepareDepositTx, prepareWithdrawTx, prepareSwitchTx
- explainRisk, getAgentActivity

Contoh interaction:
User: "1000 USDC ditaro di Low setahun jadi berapa?"
Lo: "Di strategy Low (90% mUSD + 10% USDY), $1000 USDC setahun jadi ~$1,050. 
     Range: $1,045-$1,055 tergantung short-term yield. 
     Risk: minimal, treasury-backed. Mau deploy?" 
     [actionable card: Deploy $1000 to LOW]
```

### Task 3: Projection Model

```typescript
// services/projection.ts
export function computeProjection(
  allocation: AllocationConfig,
  capital: number,
  durationDays: number
): Projection {
  const apys = getCurrentAPYsSync();
  
  // Resolve allocation to asset-level
  const assetAllocation = resolveAllocation(allocation);
  
  // Weighted APY
  const blendedAPY = Object.entries(assetAllocation).reduce(
    (sum, [asset, pct]) => sum + (apys[asset] * pct / 100),
    0
  );
  
  // Daily compound
  const dailyRate = (1 + blendedAPY / 100) ** (1 / 365) - 1;
  const baseValue = capital * (1 + dailyRate) ** durationDays;
  
  // Best case (+25% of APY)
  const bestRate = (1 + blendedAPY * 1.25 / 100) ** (1 / 365) - 1;
  const bestValue = capital * (1 + bestRate) ** durationDays;
  
  // Worst case (-25% of APY, account for slippage/fees)
  const worstRate = (1 + blendedAPY * 0.75 / 100) ** (1 / 365) - 1;
  const worstValue = capital * (1 + worstRate) ** durationDays * 0.99;
  
  return {
    capital,
    baseValue: round(baseValue, 2),
    bestValue: round(bestValue, 2),
    worstValue: round(worstValue, 2),
    blendedAPY,
    breakdown: assetAllocation,
  };
}
```

### Task 4: Tool Definitions

(See A.3 above — Nabil owns implementing the tool definitions that backend Hermes Agents call)

---

# PART D: ENV VARIABLES

## Backend (.env)
```
# Chain
MANTLE_RPC_URL=https://rpc.mantle.xyz
MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
PRIVATE_KEY_DEPLOYER=0x...
PRIVATE_KEY_AGENT_EXECUTOR=0x...
PRIVATE_KEY_GAS_FUNDER=0x...

# Contracts (after deploy)
LOW_VAULT_ADDR=0x...
MED_VAULT_ADDR=0x...
HIGH_VAULT_ADDR=0x...
COMPOSITE_VAULT_ADDR=0x...
ACTIVITY_LOG_ADDR=0x...
ROUTER_ADDR=0x...
ORACLE_MANAGER_ADDR=0x...

# DB
DATABASE_URL=postgres://...

# LLM
OPENROUTER_KEY=sk-or-...
LLM_MODEL=anthropic/claude-sonnet-4.6

# Privy
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...

# Pricing
COINGECKO_API_KEY= (optional, free tier doesn't need)
```

## Frontend (.env.local)
```
NEXT_PUBLIC_PRIVY_APP_ID=...
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_WS_URL=wss://api.your-domain.com
NEXT_PUBLIC_CHAIN_ID=5000 # Mantle mainnet
```
