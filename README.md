# ⚡ Decentralized Energy Demand-Response Rewards

Welcome to a revolutionary Web3 solution for energy grid optimization! This project uses the Stacks blockchain and Clarity smart contracts to incentivize users to shift their energy usage away from peak demand periods. By participating in demand-response events, users earn tokenized rewards for verifiable reductions in consumption, helping stabilize grids, reduce costs, and promote sustainable energy practices. This addresses real-world issues like grid overloads, high energy prices during peaks, and reliance on fossil fuel peaker plants.

## ✨ Features
🔋 Register as a user and link smart meters/devices for automated tracking  
📢 Utilities or grid operators signal peak demand events transparently  
🤝 Users commit to usage reductions and stake tokens for accountability  
✅ Oracle-verified proof of reduced consumption during events  
💰 Earn reward tokens proportional to your contribution to demand shifting  
🚫 Penalties for non-compliance to ensure system integrity  
🗳️ Community governance for adjusting reward parameters  
📊 Immutable records of events, commitments, and payouts for trust and audits  
🌍 Integrates with IoT devices for seamless, real-time participation  

## 🛠 How It Works
**For Users**  
- Register your account and link a smart meter (via off-chain API, hashed on-chain).  
- Monitor active demand-response events.  
- Commit to a specific reduction target (e.g., 20% less usage for 2 hours) by staking tokens.  
- During the event, your meter data is fed via oracles to verify compliance.  
- If successful, unstake and claim rewards; if not, face a penalty slash.  

**For Grid Operators/Utilities**  
- Create and broadcast a demand-response event with details like time, duration, and target reduction.  
- Set reward pools funded by utility tokens or grants.  
- After the event, the system automatically verifies and distributes rewards based on aggregated user contributions.  

**For Verifiers/Auditors**  
- Query event details, user commitments, and verification proofs.  
- Use governance to propose changes like reward multipliers or penalty rates.  

This system leverages 8 Clarity smart contracts for modularity, security, and scalability:  
1. **UserRegistry.clar**: Handles user registration, device linking (via hashes), and profile management.  
2. **RewardToken.clar**: Defines the fungible token (STX or SIP-10 compliant) used for rewards and staking.  
3. **EventManager.clar**: Allows authorized operators to create, start, and end demand-response events with parameters like duration and target MW reduction.  
4. **CommitmentContract.clar**: Users submit commitments to reductions, including staked amounts, tied to specific events.  
5. **DataOracle.clar**: Integrates with off-chain oracles to submit hashed energy usage data for verification (e.g., pre- and post-event readings).  
6. **VerificationEngine.clar**: Processes oracle data to confirm if commitments were met, calculating compliance scores.  
7. **RewardDistributor.clar**: Distributes tokens from event pools to verified participants based on their reduction impact.  
8. **GovernanceDAO.clar**: Enables token holders to vote on system parameters, such as reward rates or penalty thresholds.  

## 🚀 Getting Started
1. Set up a Stacks development environment with Clarinet.  
2. Deploy the contracts in sequence (e.g., Token first, then Registry).  
3. Test end-to-end: Simulate an event, commit as a user, submit mock oracle data, and claim rewards.  
4. Integrate with real IoT APIs for production (off-chain).  

This project promotes energy efficiency while creating a fair, decentralized marketplace for demand flexibility! 🚀