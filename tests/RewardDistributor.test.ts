// RewardDistributor.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { uintCV, principalCV } from "@stacks/transactions";

const ERR_UNAUTHORIZED = 100;
const ERR_INVALID_EVENT_ID = 101;
const ERR_INVALID_POOL_ID = 102;
const ERR_INVALID_USER = 103;
const ERR_INVALID_SCORE = 104;
const ERR_INVALID_REWARD = 105;
const ERR_EVENT_NOT_ENDED = 106;
const ERR_POOL_NOT_ACTIVE = 107;
const ERR_INSUFFICIENT_POOL = 108;
const ERR_ALREADY_DISTRIBUTED = 109;
const ERR_BATCH_LIMIT = 110;
const ERR_CLAIM_FAILED = 111;
const ERR_INVALID_TOTAL_SCORE = 112;
const ERR_INVALID_POOL_BALANCE = 113;
const ERR_VERIFICATION_NOT_FOUND = 114;
const ERR_TRANSFER_FAILED = 115;
const BATCH_LIMIT = 200;

interface Result<T> {
  ok: boolean;
  value: T;
}

class MockVerificationEngine {
  scores: Map<string, number> = new Map();
  eventStatus: Map<number, { active: boolean }> = new Map();

  getScore(eventId: number, user: string): number {
    return this.scores.get(`${eventId}-${user}`) ?? 0;
  }

  getEventStatus(eventId: number): { active: boolean } | undefined {
    return this.eventStatus.get(eventId);
  }

  setScore(eventId: number, user: string, score: number): void {
    this.scores.set(`${eventId}-${user}`, score);
  }

  setEventEnded(eventId: number): void {
    this.eventStatus.set(eventId, { active: false });
  }
}

class MockRewardToken {
  poolBalances: Map<number, number> = new Map();
  claims: Map<string, boolean> = new Map();

  getPoolBalance(poolId: number): number {
    return this.poolBalances.get(poolId) ?? 0;
  }

  claimReward(poolId: number, amount: number): Result<boolean> {
    const key = `${poolId}-${"contract"}`;
    if (this.claims.has(key)) return { ok: false, value: ERR_CLAIM_FAILED };
    if (amount > (this.poolBalances.get(poolId) ?? 0))
      return { ok: false, value: ERR_INSUFFICIENT_POOL };
    this.poolBalances.set(
      poolId,
      (this.poolBalances.get(poolId) ?? 0) - amount
    );
    this.claims.set(key, true);
    return { ok: true, value: true };
  }

  setPoolBalance(poolId: number, balance: number): void {
    this.poolBalances.set(poolId, balance);
  }
}

class RewardDistributorMock {
  state: {
    verificationEngine: string;
    rewardToken: string;
    admin: string;
    eventPools: Map<number, number>;
    distributedEvents: Map<number, boolean>;
    userRewards: Map<string, number>;
  } = {
    verificationEngine: "engine",
    rewardToken: "token",
    admin: "ST1ADMIN",
    eventPools: new Map(),
    distributedEvents: new Map(),
    userRewards: new Map(),
  };
  caller: string = "ST1ADMIN";
  verificationEngine: MockVerificationEngine;
  rewardToken: MockRewardToken;

  constructor() {
    this.verificationEngine = new MockVerificationEngine();
    this.rewardToken = new MockRewardToken();
    this.reset();
  }

  reset() {
    this.state = {
      verificationEngine: "engine",
      rewardToken: "token",
      admin: "ST1ADMIN",
      eventPools: new Map(),
      distributedEvents: new Map(),
      userRewards: new Map(),
    };
    this.caller = "ST1ADMIN";
    this.verificationEngine = new MockVerificationEngine();
    this.rewardToken = new MockRewardToken();
  }

  getVerificationEngine(): string {
    return this.state.verificationEngine;
  }

  getRewardToken(): string {
    return this.state.rewardToken;
  }

  getEventPool(eventId: number): number | undefined {
    return this.state.eventPools.get(eventId);
  }

  isDistributed(eventId: number): boolean {
    return this.state.distributedEvents.get(eventId) ?? false;
  }

  getUserReward(eventId: number, user: string): number {
    return this.state.userRewards.get(`${eventId}-${user}`) ?? 0;
  }

  getAdmin(): string {
    return this.state.admin;
  }

  isAdmin(): boolean {
    return this.caller === this.state.admin;
  }

  setVerificationEngine(engine: string): Result<boolean> {
    if (!this.isAdmin()) return { ok: false, value: ERR_UNAUTHORIZED };
    if (engine === "SP000000000000000000002Q6VF78")
      return { ok: false, value: ERR_INVALID_USER };
    this.state.verificationEngine = engine;
    return { ok: true, value: true };
  }

  setRewardToken(token: string): Result<boolean> {
    if (!this.isAdmin()) return { ok: false, value: ERR_UNAUTHORIZED };
    if (token === "SP000000000000000000002Q6VF78")
      return { ok: false, value: ERR_INVALID_USER };
    this.state.rewardToken = token;
    return { ok: true, value: true };
  }

  setAdmin(newAdmin: string): Result<boolean> {
    if (!this.isAdmin()) return { ok: false, value: ERR_UNAUTHORIZED };
    if (newAdmin === "SP000000000000000000002Q6VF78")
      return { ok: false, value: ERR_INVALID_USER };
    this.state.admin = newAdmin;
    return { ok: true, value: true };
  }

  linkEventToPool(eventId: number, poolId: number): Result<boolean> {
    if (!this.isAdmin()) return { ok: false, value: ERR_UNAUTHORIZED };
    if (eventId <= 0) return { ok: false, value: ERR_INVALID_EVENT_ID };
    if (poolId < 0) return { ok: false, value: ERR_INVALID_POOL_ID };
    if (this.state.eventPools.has(eventId))
      return { ok: false, value: ERR_ALREADY_DISTRIBUTED };
    this.state.eventPools.set(eventId, poolId);
    return { ok: true, value: true };
  }

  distributeRewards(eventId: number, users: string[]): Result<boolean> {
    if (!this.isAdmin()) return { ok: false, value: ERR_UNAUTHORIZED };
    if (eventId <= 0) return { ok: false, value: ERR_INVALID_EVENT_ID };
    if (users.length > BATCH_LIMIT)
      return { ok: false, value: ERR_BATCH_LIMIT };
    if (this.isDistributed(eventId))
      return { ok: false, value: ERR_ALREADY_DISTRIBUTED };
    const status = this.verificationEngine.getEventStatus(eventId);
    if (!status || status.active)
      return { ok: false, value: ERR_EVENT_NOT_ENDED };
    const poolId = this.state.eventPools.get(eventId);
    if (poolId === undefined) return { ok: false, value: ERR_INVALID_POOL_ID };
    const totalScore = users.reduce(
      (acc, user) => acc + this.verificationEngine.getScore(eventId, user),
      0
    );
    if (totalScore === 0) return { ok: false, value: ERR_INVALID_TOTAL_SCORE };
    const poolBalance = this.rewardToken.getPoolBalance(poolId);
    if (poolBalance < 1) return { ok: false, value: ERR_INSUFFICIENT_POOL };
    let distributed = 0;
    for (const user of users) {
      const score = this.verificationEngine.getScore(eventId, user);
      const currentReward = this.getUserReward(eventId, user);
      if (score > 0 && currentReward === 0) {
        const reward = Math.floor((poolBalance * score) / totalScore);
        if (reward > 0) {
          const result = this.rewardToken.claimReward(poolId, reward);
          if (result.ok) {
            this.state.userRewards.set(`${eventId}-${user}`, reward);
            distributed++;
          }
        }
      }
    }
    this.state.distributedEvents.set(eventId, true);
    return { ok: true, value: true };
  }

  getPendingReward(eventId: number, user: string): Result<number> {
    if (eventId <= 0) return { ok: false, value: ERR_INVALID_EVENT_ID };
    if (user === "SP000000000000000000002Q6VF78")
      return { ok: false, value: ERR_INVALID_USER };
    const poolId = this.state.eventPools.get(eventId);
    if (poolId === undefined) return { ok: false, value: ERR_INVALID_POOL_ID };
    const score = this.verificationEngine.getScore(eventId, user);
    const totalScore = this.verificationEngine.getScore(eventId, user);
    if (score === 0 || totalScore === 0) return { ok: true, value: 0 };
    const poolBalance = this.rewardToken.getPoolBalance(poolId);
    return { ok: true, value: Math.floor((poolBalance * score) / totalScore) };
  }
}

describe("RewardDistributor", () => {
  let contract: RewardDistributorMock;

  beforeEach(() => {
    contract = new RewardDistributorMock();
    contract.reset();
  });

  it("links event to pool successfully", () => {
    const result = contract.linkEventToPool(1, 10);
    expect(result.ok).toBe(true);
    expect(contract.getEventPool(1)).toBe(10);
  });

  it("rejects linking already distributed event", () => {
    contract.linkEventToPool(1, 10);
    const result = contract.linkEventToPool(1, 20);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ALREADY_DISTRIBUTED);
  });

  it("rejects distribution on active event", () => {
    contract.linkEventToPool(1, 100);
    const result = contract.distributeRewards(1, ["ST1USER1"]);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_EVENT_NOT_ENDED);
  });

  it("rejects batch over limit", () => {
    const users = Array(201).fill("ST1USER");
    const result = contract.distributeRewards(1, users);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_BATCH_LIMIT);
  });

  it("sets verification engine successfully", () => {
    const result = contract.setVerificationEngine("ST2ENGINE");
    expect(result.ok).toBe(true);
    expect(contract.getVerificationEngine()).toBe("ST2ENGINE");
  });

  it("rejects non-admin actions", () => {
    contract.caller = "ST2HACKER";
    const result = contract.linkEventToPool(1, 10);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_UNAUTHORIZED);
  });
});
