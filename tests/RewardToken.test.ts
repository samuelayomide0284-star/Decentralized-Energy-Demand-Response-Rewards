// RewardToken.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { uintCV, principalCV } from "@stacks/transactions";

const ERR_UNAUTHORIZED = 100;
const ERR_INSUFFICIENT_BALANCE = 101;
const ERR_INVALID_AMOUNT = 102;
const ERR_POOL_NOT_FOUND = 103;
const ERR_POOL_EXPIRED = 104;
const ERR_POOL_LOCKED = 105;
const ERR_CLAIM_TOO_EARLY = 106;
const ERR_ALREADY_CLAIMED = 107;
const ERR_INVALID_POOL_ID = 108;
const ERR_POOL_NOT_ACTIVE = 109;
const ERR_INVALID_RECIPIENT = 110;
const ERR_INVALID_LOCK_PERIOD = 111;
const ERR_INVALID_REWARD_RATE = 112;
const ERR_TRANSFER_FAILED = 113;
const ERR_MINT_FAILED = 114;
const ERR_BURN_FAILED = 115;

interface RewardPool {
  totalReward: number;
  claimed: number;
  startTime: number;
  endTime: number;
  lockPeriod: number;
  rewardRate: number;
  active: boolean;
  creator: string;
}

interface UserClaim {
  claimed: boolean;
  amount: number;
  timestamp: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class RewardTokenMock {
  state: {
    admin: string;
    nextPoolId: number;
    totalPools: number;
    balances: Map<string, number>;
    rewardPools: Map<number, RewardPool>;
    userClaims: Map<string, UserClaim>;
    poolBalances: Map<number, number>;
  } = {
    admin: "ST1ADMIN",
    nextPoolId: 0,
    totalPools: 0,
    balances: new Map(),
    rewardPools: new Map(),
    userClaims: new Map(),
    poolBalances: new Map(),
  };
  blockHeight: number = 100;
  caller: string = "ST1ADMIN";
  transfers: Array<{ amount: number; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      admin: "ST1ADMIN",
      nextPoolId: 0,
      totalPools: 0,
      balances: new Map([["contract", 0]]),
      rewardPools: new Map(),
      userClaims: new Map(),
      poolBalances: new Map(),
    };
    this.blockHeight = 100;
    this.caller = "ST1ADMIN";
    this.transfers = [];
  }

  getTokenBalance(user: string): number {
    return this.state.balances.get(user) ?? 0;
  }

  getPool(poolId: number): RewardPool | undefined {
    return this.state.rewardPools.get(poolId);
  }

  getPoolBalance(poolId: number): number {
    return this.state.poolBalances.get(poolId) ?? 0;
  }

  getUserClaim(poolId: number, user: string): UserClaim | undefined {
    return this.state.userClaims.get(`${poolId}-${user}`);
  }

  getNextPoolId(): number {
    return this.state.nextPoolId;
  }

  getTotalPools(): number {
    return this.state.totalPools;
  }

  isAdmin(): boolean {
    return this.caller === this.state.admin;
  }

  setAdmin(newAdmin: string): Result<boolean> {
    if (!this.isAdmin()) return { ok: false, value: ERR_UNAUTHORIZED };
    if (newAdmin === "SP000000000000000000002Q6VF78")
      return { ok: false, value: ERR_INVALID_RECIPIENT };
    this.state.admin = newAdmin;
    return { ok: true, value: true };
  }

  mint(amount: number, recipient: string): Result<boolean> {
    if (!this.isAdmin()) return { ok: false, value: ERR_UNAUTHORIZED };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (recipient === "SP000000000000000000002Q6VF78")
      return { ok: false, value: ERR_INVALID_RECIPIENT };
    const current = this.getTokenBalance("contract");
    this.state.balances.set("contract", current + amount);
    return { ok: true, value: true };
  }

  burn(amount: number, sender: string): Result<boolean> {
    if (!this.isAdmin()) return { ok: false, value: ERR_UNAUTHORIZED };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    const current = this.getTokenBalance("contract");
    if (current < amount) return { ok: false, value: ERR_TRANSFER_FAILED };
    this.state.balances.set("contract", current - amount);
    return { ok: true, value: true };
  }

  transfer(amount: number, sender: string, recipient: string): Result<boolean> {
    if (this.caller !== sender) return { ok: false, value: ERR_UNAUTHORIZED };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (recipient === "SP000000000000000000002Q6VF78")
      return { ok: false, value: ERR_INVALID_RECIPIENT };
    const fromBal = this.getTokenBalance(sender);
    const toBal = this.getTokenBalance(recipient);
    if (fromBal < amount) return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    this.state.balances.set(sender, fromBal - amount);
    this.state.balances.set(recipient, toBal + amount);
    this.transfers.push({ amount, from: sender, to: recipient });
    return { ok: true, value: true };
  }

  createRewardPool(
    totalReward: number,
    lockPeriod: number,
    rewardRate: number
  ): Result<number> {
    if (!this.isAdmin()) return { ok: false, value: ERR_UNAUTHORIZED };
    if (this.state.totalPools >= 100)
      return { ok: false, value: ERR_POOL_LOCKED };
    if (totalReward <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (lockPeriod > 525600)
      return { ok: false, value: ERR_INVALID_LOCK_PERIOD };
    if (rewardRate > 10000)
      return { ok: false, value: ERR_INVALID_REWARD_RATE };
    const poolId = this.state.nextPoolId;
    const startTime = this.blockHeight;
    const endTime = startTime + lockPeriod;
    this.mint(totalReward, "contract");
    this.state.rewardPools.set(poolId, {
      totalReward,
      claimed: 0,
      startTime,
      endTime,
      lockPeriod,
      rewardRate,
      active: true,
      creator: this.caller,
    });
    this.state.poolBalances.set(poolId, totalReward);
    this.state.nextPoolId++;
    this.state.totalPools++;
    return { ok: true, value: poolId };
  }

  depositToPool(poolId: number, amount: number): Result<boolean> {
    const pool = this.state.rewardPools.get(poolId);
    if (!pool) return { ok: false, value: ERR_POOL_NOT_FOUND };
    if (!pool.active) return { ok: false, value: ERR_POOL_NOT_ACTIVE };
    if (this.blockHeight > pool.endTime)
      return { ok: false, value: ERR_POOL_EXPIRED };
    if (poolId >= this.state.nextPoolId)
      return { ok: false, value: ERR_INVALID_POOL_ID };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.transfer(amount, this.caller, "contract");
    const currentBal = this.getPoolBalance(poolId);
    this.state.poolBalances.set(poolId, currentBal + amount);
    this.state.rewardPools.set(poolId, {
      ...pool,
      totalReward: pool.totalReward + amount,
    });
    return { ok: true, value: true };
  }

  claimReward(poolId: number, amount: number): Result<boolean> {
    const pool = this.state.rewardPools.get(poolId);
    if (!pool) return { ok: false, value: ERR_POOL_NOT_FOUND };
    if (!pool.active) return { ok: false, value: ERR_POOL_NOT_ACTIVE };
    if (this.blockHeight < pool.endTime)
      return { ok: false, value: ERR_CLAIM_TOO_EARLY };
    if (poolId >= this.state.nextPoolId)
      return { ok: false, value: ERR_INVALID_POOL_ID };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    const claimKey = `${poolId}-${this.caller}`;
    if (this.state.userClaims.has(claimKey))
      return { ok: false, value: ERR_ALREADY_CLAIMED };
    const poolBal = this.getPoolBalance(poolId);
    if (poolBal < amount) return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    if (pool.totalReward < pool.claimed + amount)
      return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    this.transfer(amount, "contract", this.caller);
    this.state.userClaims.set(claimKey, {
      claimed: true,
      amount,
      timestamp: this.blockHeight,
    });
    this.state.rewardPools.set(poolId, {
      ...pool,
      claimed: pool.claimed + amount,
    });
    this.state.poolBalances.set(poolId, poolBal - amount);
    return { ok: true, value: true };
  }

  closePool(poolId: number): Result<boolean> {
    const pool = this.state.rewardPools.get(poolId);
    if (!pool) return { ok: false, value: ERR_POOL_NOT_FOUND };
    if (this.caller !== pool.creator)
      return { ok: false, value: ERR_UNAUTHORIZED };
    if (!pool.active) return { ok: false, value: ERR_POOL_NOT_ACTIVE };
    if (this.blockHeight < pool.endTime)
      return { ok: false, value: ERR_CLAIM_TOO_EARLY };
    const remaining = this.getPoolBalance(poolId);
    this.state.rewardPools.set(poolId, { ...pool, active: false });
    if (remaining > 0) {
      this.transfer(remaining, "contract", pool.creator);
      this.state.poolBalances.set(poolId, 0);
    }
    return { ok: true, value: true };
  }

  getClaimableReward(
    poolId: number,
    user: string,
    score: number
  ): Result<number> {
    const pool = this.state.rewardPools.get(poolId);
    if (!pool) return { ok: false, value: ERR_POOL_NOT_FOUND };
    if (!pool.active) return { ok: false, value: ERR_POOL_NOT_ACTIVE };
    const claimKey = `${poolId}-${user}`;
    if (this.state.userClaims.has(claimKey))
      return { ok: false, value: ERR_ALREADY_CLAIMED };
    const baseReward = (pool.totalReward * score) / 100;
    const rateAdjusted = (baseReward * pool.rewardRate) / 10000;
    return { ok: true, value: rateAdjusted };
  }
}

describe("RewardToken", () => {
  let contract: RewardTokenMock;

  beforeEach(() => {
    contract = new RewardTokenMock();
    contract.reset();
  });

  it("mints tokens successfully", () => {
    const result = contract.mint(1000, "ST1USER");
    expect(result.ok).toBe(true);
    expect(contract.getTokenBalance("contract")).toBe(1000);
  });

  it("rejects mint by non-admin", () => {
    contract.caller = "ST2USER";
    const result = contract.mint(1000, "ST1USER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_UNAUTHORIZED);
  });

  it("creates reward pool successfully", () => {
    const result = contract.createRewardPool(5000, 100, 200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const pool = contract.getPool(0);
    expect(pool?.totalReward).toBe(5000);
    expect(pool?.active).toBe(true);
    expect(contract.getPoolBalance(0)).toBe(5000);
  });

  it("deposits to pool successfully", () => {
    contract.createRewardPool(5000, 100, 200);
    contract.caller = "ST1USER";
    contract.mint(1000, "ST1USER");
    const result = contract.depositToPool(0, 500);
    expect(result.ok).toBe(true);
    expect(contract.getPoolBalance(0)).toBe(5500);
  });

  it("rejects early claim", () => {
    contract.createRewardPool(5000, 100, 200);
    contract.blockHeight = 150;
    contract.caller = "ST1USER";
    const result = contract.claimReward(0, 1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_CLAIM_TOO_EARLY);
  });

  it("rejects claim after already claimed", () => {
    contract.createRewardPool(5000, 10, 200);
    contract.blockHeight = 120;
    contract.caller = "ST1USER";
    contract.claimReward(0, 1000);
    const result = contract.claimReward(0, 500);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ALREADY_CLAIMED);
  });
});
