import { describe, it, expect, beforeEach } from "vitest";
import { uintCV, principalCV, buffCV } from "@stacks/transactions";

const ERR_UNAUTHORIZED = 100;
const ERR_EVENT_EXPIRED = 101;
const ERR_INVALID_DATA = 102;
const ERR_ALREADY_VERIFIED = 103;
const ERR_INVALID_EVENT_ID = 104;
const ERR_INVALID_USER = 105;
const ERR_INVALID_KWH = 106;
const ERR_INVALID_SCORE = 107;
const ERR_INVALID_SIGNATURE = 108;
const ERR_ORACLE_NOT_SET = 109;
const ERR_INVALID_BASELINE = 110;
const ERR_INVALID_COMMITTED = 111;
const ERR_INVALID_ACTUAL = 112;
const ERR_INVALID_REDUCTION = 113;
const ERR_INVALID_MULTIPLIER = 114;
const ERR_BATCH_LIMIT_EXCEEDED = 115;
const ERR_INVALID_PENALTY = 116;
const ERR_INVALID_REWARD = 117;
const ERR_EVENT_NOT_FOUND = 118;
const ERR_USER_NOT_COMMITTED = 119;
const ERR_VERIFICATION_FAILED = 120;
const ERR_PAUSED = 121;
const ERR_INVALID_NONCE = 122;
const ERR_NONCE_USED = 123;
const ERR_INVALID_TIMESTAMP = 124;
const ERR_INVALID_STATUS = 125;

interface Commitment {
  committedKwh: number;
  staked: number;
  baselineKwh: number;
  nonce: number;
}

interface Verification {
  actualKwh: number;
  score: number;
  verified: boolean;
  reduction: number;
}

interface EventStatus {
  active: boolean;
  startTime: number;
  endTime: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class VerificationEngineMock {
  state: {
    oracle: string;
    paused: boolean;
    minScore: number;
    penaltyRate: number;
    rewardMultiplier: number;
    batchLimit: number;
    nextNonce: number;
    commitments: Map<string, Commitment>;
    verifications: Map<string, Verification>;
    eventStatus: Map<number, EventStatus>;
    usedNonces: Map<number, boolean>;
  } = {
    oracle: "ST1TEST",
    paused: false,
    minScore: 50,
    penaltyRate: 20,
    rewardMultiplier: 150,
    batchLimit: 200,
    nextNonce: 0,
    commitments: new Map(),
    verifications: new Map(),
    eventStatus: new Map(),
    usedNonces: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  transfers: Array<{ amount: number; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      oracle: "ST1TEST",
      paused: false,
      minScore: 50,
      penaltyRate: 20,
      rewardMultiplier: 150,
      batchLimit: 200,
      nextNonce: 0,
      commitments: new Map(),
      verifications: new Map(),
      eventStatus: new Map(),
      usedNonces: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.transfers = [];
  }

  getCommitment(eventId: number, user: string): Commitment | undefined {
    return this.state.commitments.get(`${eventId}-${user}`);
  }

  getVerification(eventId: number, user: string): Verification | undefined {
    return this.state.verifications.get(`${eventId}-${user}`);
  }

  getEventStatus(eventId: number): EventStatus | undefined {
    return this.state.eventStatus.get(eventId);
  }

  isVerified(eventId: number, user: string): boolean {
    return this.getVerification(eventId, user)?.verified ?? false;
  }

  getOracle(): string {
    return this.state.oracle;
  }

  isPaused(): boolean {
    return this.state.paused;
  }

  getMinScore(): number {
    return this.state.minScore;
  }

  getPenaltyRate(): number {
    return this.state.penaltyRate;
  }

  getRewardMultiplier(): number {
    return this.state.rewardMultiplier;
  }

  getBatchLimit(): number {
    return this.state.batchLimit;
  }

  setOracle(newOracle: string): Result<boolean> {
    if (this.caller !== this.state.oracle) return { ok: false, value: ERR_UNAUTHORIZED };
    if (newOracle === "SP000000000000000000002Q6VF78") return { ok: false, value: ERR_INVALID_USER };
    this.state.oracle = newOracle;
    return { ok: true, value: true };
  }

  setPaused(newPaused: boolean): Result<boolean> {
    if (this.caller !== this.state.oracle) return { ok: false, value: ERR_UNAUTHORIZED };
    this.state.paused = newPaused;
    return { ok: true, value: true };
  }

  setMinScore(newMin: number): Result<boolean> {
    if (this.caller !== this.state.oracle) return { ok: false, value: ERR_UNAUTHORIZED };
    if (newMin > 100) return { ok: false, value: ERR_INVALID_SCORE };
    this.state.minScore = newMin;
    return { ok: true, value: true };
  }

  setPenaltyRate(newRate: number): Result<boolean> {
    if (this.caller !== this.state.oracle) return { ok: false, value: ERR_UNAUTHORIZED };
    if (newRate > 100) return { ok: false, value: ERR_INVALID_PENALTY };
    this.state.penaltyRate = newRate;
    return { ok: true, value: true };
  }

  setRewardMultiplier(newMulti: number): Result<boolean> {
    if (this.caller !== this.state.oracle) return { ok: false, value: ERR_UNAUTHORIZED };
    if (newMulti <= 0) return { ok: false, value: ERR_INVALID_MULTIPLIER };
    this.state.rewardMultiplier = newMulti;
    return { ok: true, value: true };
  }

  setBatchLimit(newLimit: number): Result<boolean> {
    if (this.caller !== this.state.oracle) return { ok: false, value: ERR_UNAUTHORIZED };
    if (newLimit > this.state.batchLimit) return { ok: false, value: ERR_BATCH_LIMIT_EXCEEDED };
    this.state.batchLimit = newLimit;
    return { ok: true, value: true };
  }

  createEvent(eventId: number, startTime: number, endTime: number): Result<boolean> {
    if (this.caller !== this.state.oracle) return { ok: false, value: ERR_UNAUTHORIZED };
    if (eventId <= 0) return { ok: false, value: ERR_INVALID_EVENT_ID };
    if (startTime < this.blockHeight) return { ok: false, value: ERR_INVALID_TIMESTAMP };
    if (endTime < this.blockHeight) return { ok: false, value: ERR_INVALID_TIMESTAMP };
    if (endTime <= startTime) return { ok: false, value: ERR_INVALID_TIMESTAMP };
    if (this.state.eventStatus.has(eventId)) return { ok: false, value: ERR_INVALID_EVENT_ID };
    this.state.eventStatus.set(eventId, { active: true, startTime, endTime });
    return { ok: true, value: true };
  }

  endEvent(eventId: number): Result<boolean> {
    if (this.caller !== this.state.oracle) return { ok: false, value: ERR_UNAUTHORIZED };
    if (eventId <= 0) return { ok: false, value: ERR_INVALID_EVENT_ID };
    const status = this.state.eventStatus.get(eventId);
    if (!status) return { ok: false, value: ERR_EVENT_NOT_FOUND };
    if (!status.active) return { ok: false, value: ERR_INVALID_STATUS };
    this.state.eventStatus.set(eventId, { ...status, active: false });
    return { ok: true, value: true };
  }

  submitCommitment(eventId: number, committedKwh: number, staked: number, baselineKwh: number): Result<boolean> {
    if (this.state.paused) return { ok: false, value: ERR_PAUSED };
    if (eventId <= 0) return { ok: false, value: ERR_INVALID_EVENT_ID };
    if (this.caller === "SP000000000000000000002Q6VF78") return { ok: false, value: ERR_INVALID_USER };
    if (committedKwh <= 0) return { ok: false, value: ERR_INVALID_COMMITTED };
    if (staked <= 0) return { ok: false, value: ERR_INVALID_KWH };
    if (baselineKwh <= 0) return { ok: false, value: ERR_INVALID_BASELINE };
    const nonce = this.state.nextNonce;
    if (nonce <= 0) return { ok: false, value: ERR_INVALID_NONCE };
    if (this.getCommitment(eventId, this.caller)) return { ok: false, value: ERR_ALREADY_VERIFIED };
    if (this.state.usedNonces.get(nonce)) return { ok: false, value: ERR_NONCE_USED };
    const status = this.state.eventStatus.get(eventId);
    if (!status) return { ok: false, value: ERR_EVENT_NOT_FOUND };
    if (!status.active) return { ok: false, value: ERR_EVENT_EXPIRED };
    if (this.blockHeight > status.endTime) return { ok: false, value: ERR_EVENT_EXPIRED };
    this.state.commitments.set(`${eventId}-${this.caller}`, { committedKwh, staked, baselineKwh, nonce });
    this.state.usedNonces.set(nonce, true);
    this.state.nextNonce++;
    return { ok: true, value: true };
  }

  submitOracleData(eventId: number, user: string, actualKwh: number, signature: Uint8Array): Result<{ score: number; multiplier: number }> {
    if (this.state.paused) return { ok: false, value: ERR_PAUSED };
    if (this.caller !== this.state.oracle) return { ok: false, value: ERR_UNAUTHORIZED };
    if (eventId <= 0) return { ok: false, value: ERR_INVALID_EVENT_ID };
    if (user === "SP000000000000000000002Q6VF78") return { ok: false, value: ERR_INVALID_USER };
    if (actualKwh < 0) return { ok: false, value: ERR_INVALID_ACTUAL };
    if (signature.length !== 65) return { ok: false, value: ERR_INVALID_SIGNATURE };
    const commitment = this.getCommitment(eventId, user);
    if (!commitment) return { ok: false, value: ERR_USER_NOT_COMMITTED };
    if (this.isVerified(eventId, user)) return { ok: false, value: ERR_ALREADY_VERIFIED };
    const status = this.state.eventStatus.get(eventId);
    if (!status) return { ok: false, value: ERR_EVENT_NOT_FOUND };
    if (status.active) return { ok: false, value: ERR_EVENT_EXPIRED };
    if (!this.verifySignatureImpl(eventId, user, actualKwh, signature, commitment.nonce)) return { ok: false, value: ERR_INVALID_SIGNATURE };
    const baseline = commitment.baselineKwh;
    const committed = commitment.committedKwh;
    const reduction = baseline >= actualKwh ? baseline - actualKwh : 0;
    if (reduction < 0) return { ok: false, value: ERR_INVALID_REDUCTION };
    const reductionPct = baseline > 0 ? (reduction * 100) / baseline : 0;
    const score = reductionPct >= committed ? 100 : Math.min(reductionPct, 100);
    if (score > 100) return { ok: false, value: ERR_INVALID_SCORE };
    this.state.verifications.set(`${eventId}-${user}`, { actualKwh, score, verified: true, reduction });
    const multiplier = (score * this.state.rewardMultiplier) / 100;
    return { ok: true, value: { score, multiplier } };
  }

  private verifySignatureImpl(eventId: number, user: string, actualKwh: number, sig: Uint8Array, nonce: number): boolean {
    return true;
  }

  batchVerifyAndSlash(eventId: number, users: string[]): Result<boolean> {
    if (this.caller !== this.state.oracle) return { ok: false, value: ERR_UNAUTHORIZED };
    if (eventId <= 0) return { ok: false, value: ERR_INVALID_EVENT_ID };
    if (users.length > this.state.batchLimit) return { ok: false, value: ERR_BATCH_LIMIT_EXCEEDED };
    let slashed = 0;
    for (const user of users) {
      const verif = this.getVerification(eventId, user);
      const commit = this.getCommitment(eventId, user);
      if (verif && commit) {
        if (verif.score < this.state.minScore) {
          this.slashStake(eventId, user, commit.staked);
          slashed++;
        }
      }
    }
    return { ok: true, value: true };
  }

  private slashStake(eventId: number, user: string, amount: number): void {
    this.transfers.push({ amount, from: user, to: "contract" });
  }

  getScore(eventId: number, user: string): Result<number> {
    const verif = this.getVerification(eventId, user);
    if (!verif) return { ok: false, value: ERR_EVENT_NOT_FOUND };
    return { ok: true, value: verif.score };
  }

  calculateReward(eventId: number, user: string, poolShare: number): Result<number> {
    const verif = this.getVerification(eventId, user);
    if (!verif) return { ok: false, value: ERR_EVENT_NOT_FOUND };
    const multiplier = (verif.score * this.state.rewardMultiplier) / 100;
    if (multiplier <= 0) return { ok: false, value: ERR_INVALID_MULTIPLIER };
    return { ok: true, value: poolShare * multiplier };
  }
}

describe("VerificationEngine", () => {
  let contract: VerificationEngineMock;

  beforeEach(() => {
    contract = new VerificationEngineMock();
    contract.reset();
  });

  it("creates an event successfully", () => {
    const result = contract.createEvent(1, 10, 20);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const status = contract.getEventStatus(1);
    expect(status?.active).toBe(true);
    expect(status?.startTime).toBe(10);
    expect(status?.endTime).toBe(20);
  });

  it("rejects event creation with invalid timestamps", () => {
    contract.blockHeight = 15;
    const result = contract.createEvent(1, 10, 12);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TIMESTAMP);
  });

  it("ends an event successfully", () => {
    contract.createEvent(1, 10, 20);
    const result = contract.endEvent(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const status = contract.getEventStatus(1);
    expect(status?.active).toBe(false);
  });

  it("rejects ending non-existent event", () => {
    const result = contract.endEvent(99);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_EVENT_NOT_FOUND);
  });

  it("rejects commitment on paused contract", () => {
    contract.setPaused(true);
    const result = contract.submitCommitment(1, 20, 50, 100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PAUSED);
  });

  it("rejects oracle data with invalid signature", () => {
    contract.createEvent(1, 0, 100);
    contract.submitCommitment(1, 20, 50, 100);
    contract.endEvent(1);
    const sig = new Uint8Array(64);
    const result = contract.submitOracleData(1, "ST1TEST", 80, sig);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SIGNATURE);
  });

  it("rejects batch over limit", () => {
    const users = Array(201).fill("user");
    const result = contract.batchVerifyAndSlash(1, users);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_BATCH_LIMIT_EXCEEDED);
  });

  it("sets oracle successfully", () => {
    const result = contract.setOracle("ST2NEW");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getOracle()).toBe("ST2NEW");
  });

  it("rejects set oracle by non-oracle", () => {
    contract.caller = "ST3FAKE";
    const result = contract.setOracle("ST2NEW");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_UNAUTHORIZED);
  });
});