'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { useLoginWithAbstract } from '@abstract-foundation/agw-react';
import { useWriteContractSponsored } from '@abstract-foundation/agw-react';
import { getGeneralPaymasterInput } from 'viem/zksync';
import { parseEther, isAddress, encodeFunctionData, decodeEventLog } from 'viem';

/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║           RAFFLE DAPP - BASIC VERSION (CREATE & PICK ONLY)        ║
 * ║                                                                   ║
 * ║  Current Features:                                                ║
 * ║  • Create Raffle (with participant list)                          ║
 * ║  • Pick Winners (provably fair selection)                         ║
 * ║  • View Raffle (see all details)                                  ║
 * ║                                                                   ║
 * ║  Coming Soon (Already in Backend):                                ║
 * ║  • Fund Raffle (add ETH prizes) - READY TO ENABLE                 ║
 * ║  • Claim Prize (winner redemption) - READY TO ENABLE              ║
 * ║                                                                   ║
 * ║  Just hiding the tabs for now - all code is ready!                ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

// ════════════════════════════════════════════════════════════════════
//                          CONFIGURATION
// ════════════════════════════════════════════════════════════════════

// REQUIRED: Your deployed raffle contract address
const RAFFLE_CONTRACT_ADDRESS = 
  (process.env.NEXT_PUBLIC_RAFFLE_CONTRACT as `0x${string}`) || 
  '0xB05585a897BBA3bA6F9AbDC415034BF88189238F';

// Paymaster for gasless transactions (optional for now)
const PAYMASTER_ADDRESS = 
  (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS as `0x${string}`) ||
  '0x5407B5040dec3D339A9247f3654E59EEccbb6391';

// Raffle contract ABI (essential functions only)
const RAFFLE_ABI = [
  {
    inputs: [
      { name: 'participants', type: 'address[]' },
      { name: 'name', type: 'string' },
      { name: 'autoDistribute', type: 'bool' }
    ],
    name: 'createRaffle',
    outputs: [{ name: 'raffleId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'raffleId', type: 'uint256' },
      { name: 'winnerCount', type: 'uint256' },
      { name: 'randomSeed', type: 'uint256' }
    ],
    name: 'pickWinners',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'raffleId', type: 'uint256' }],
    name: 'getRaffleInfo',
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'participantCount', type: 'uint256' },
      { name: 'winnerCount', type: 'uint256' },
      { name: 'totalPrize', type: 'uint256' },
      { name: 'prizePerWinner', type: 'uint256' },
      { name: 'isCompleted', type: 'bool' },
      { name: 'autoDistribute', type: 'bool' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'raffleId', type: 'uint256' }],
    name: 'getWinners',
    outputs: [{ name: 'winners', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'raffleId', type: 'uint256' }],
    name: 'getParticipants',
    outputs: [{ name: 'participants', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'nextRaffleId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'raffleId', type: 'uint256' },
      { indexed: false, name: 'name', type: 'string' },
      { indexed: false, name: 'participantCount', type: 'uint256' }
    ],
    name: 'RaffleCreated',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'raffleId', type: 'uint256' },
      { indexed: false, name: 'winners', type: 'address[]' }
    ],
    name: 'WinnersPicked',
    type: 'event'
  }
] as const;

// ════════════════════════════════════════════════════════════════════
//                          MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════

export default function RaffleDApp() {
  const { address, isConnected, connector } = useAccount();
  const { login, logout } = useLoginWithAbstract();

  // Detect if using Abstract wallet for enhanced features
  const isAbstractWallet = connector?.id === 'abstract';

  // Only show Create, Pick, and View tabs for now
  const [activeTab, setActiveTab] = useState<'create' | 'pick' | 'view'>('create');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">🎲 Raffle dApp</h1>
            <p className="text-purple-200">
              {isAbstractWallet 
                ? '✨ Powered by Abstract Global Wallet (Gasless Transactions)'
                : '🔌 Connected via Browser Wallet'}
            </p>
            <p className="text-sm text-purple-300 mt-1">
              Current Mode: Create & Pick Winners Only
            </p>
          </div>
          
          <WalletConnection 
            address={address}
            isConnected={isConnected}
            isAbstractWallet={isAbstractWallet}
            login={login}
            logout={logout}
          />
        </header>

        {isConnected ? (
          <>
            {/* Tab Navigation - Only showing Create, Pick, View */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {['create', 'pick', 'view'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    activeTab === tab
                      ? 'bg-purple-600 shadow-lg scale-105'
                      : 'bg-purple-800 hover:bg-purple-700'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-2xl">
              {activeTab === 'create' && <CreateRaffleTab isAbstractWallet={isAbstractWallet} />}
              {activeTab === 'pick' && <PickWinnersTab isAbstractWallet={isAbstractWallet} />}
              {activeTab === 'view' && <ViewRaffleTab />}
            </div>

            {/* Info Banner */}
            <div className="mt-6 p-4 bg-blue-500/20 border border-blue-400 rounded-lg">
              <p className="text-sm">
                ℹ️ <strong>Current Version:</strong> Create raffles and pick winners. 
                Prize funding and claiming features are built and ready - they'll be enabled when you're ready to launch that phase!
              </p>
            </div>
          </>
        ) : (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">🎰</div>
            <h2 className="text-2xl font-bold mb-4">Connect Your Wallet to Get Started</h2>
            <p className="text-purple-200 mb-6">
              Use Abstract Global Wallet for gasless transactions, or connect with MetaMask/any browser wallet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//                        WALLET CONNECTION
// ════════════════════════════════════════════════════════════════════

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

interface WalletConnectionProps {
  address?: `0x${string}`;
  isConnected: boolean;
  isAbstractWallet: boolean;
  login: () => void;
  logout: () => void;
}

function WalletConnection({ address, isConnected, isAbstractWallet, login, logout }: WalletConnectionProps) {
  if (!isConnected) {
    return (
      <div className="flex gap-2">
        <button
          onClick={login}
          className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 rounded-lg font-bold hover:scale-105 transition-transform shadow-lg"
        >
          Connect with Abstract
        </button>
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.ethereum) {
              window.ethereum.request({ method: 'eth_requestAccounts' });
            }
          }}
          className="bg-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-600 transition-colors"
        >
          Connect MetaMask
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg px-4 py-2 flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isAbstractWallet ? 'bg-green-400' : 'bg-blue-400'}`} />
        <span className="font-mono text-sm">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
      </div>
      <button
        onClick={logout}
        className="text-sm text-red-300 hover:text-red-200 font-semibold"
      >
        Disconnect
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//                        CREATE RAFFLE TAB
// ════════════════════════════════════════════════════════════════════

function CreateRaffleTab({ isAbstractWallet }: { isAbstractWallet: boolean }) {
  const [raffleName, setRaffleName] = useState('');
  const [participantsText, setParticipantsText] = useState('');
  const [autoDistribute, setAutoDistribute] = useState(false); // Default to false since no prizes yet
  const [status, setStatus] = useState('');

  const { address, chain } = useAccount();

  // AGW sponsored write hook
  const { writeContractSponsored, isPending: isPendingSponsored } = useWriteContractSponsored();
  
  // Standard write hook for browser wallets
  const { writeContract, isPending: isPendingStandard } = useWriteContract();

  const isPending = isPendingSponsored || isPendingStandard;

  const handleCreateRaffle = async () => {
    if (!raffleName.trim()) {
      setStatus('❌ Please enter a raffle name');
      return;
    }

    // Parse participants (one address per line)
    const participants = participantsText
      .split('\n')
      .map(addr => addr.trim())
      .filter(addr => addr && isAddress(addr)) as `0x${string}`[];

    if (participants.length === 0) {
      setStatus('❌ Please enter at least one valid Ethereum address');
      return;
    }

    setStatus('⏳ Creating raffle...');

    try {
      if (isAbstractWallet && chain && address) {
        // Use gasless transaction via AGW paymaster
        writeContractSponsored({
          address: RAFFLE_CONTRACT_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: 'createRaffle',
          args: [participants, raffleName, autoDistribute],
          paymaster: PAYMASTER_ADDRESS,
          paymasterInput: getGeneralPaymasterInput({ innerInput: '0x' }),
          chain,
          account: address,
        });
        setStatus('✅ Raffle created (gasless)! Check the View tab.');
      } else {
        // Use standard transaction for browser wallets
        writeContract({
          address: RAFFLE_CONTRACT_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: 'createRaffle',
          args: [participants, raffleName, autoDistribute],
        } as any);
        setStatus('✅ Transaction sent! Waiting for confirmation...');
      }

      // Clear form
      setRaffleName('');
      setParticipantsText('');
    } catch (error: any) {
      console.error('Create raffle error:', error);
      setStatus(`❌ Error: ${error?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4">🎯 Create New Raffle</h2>

      <div>
        <label className="block text-sm font-semibold mb-2">Raffle Name</label>
        <input
          type="text"
          value={raffleName}
          onChange={(e) => setRaffleName(e.target.value)}
          placeholder="e.g., Community Giveaway #1"
          className="w-full bg-white/10 border border-purple-500 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-300"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">
          Participants (one address per line)
        </label>
        <textarea
          value={participantsText}
          onChange={(e) => setParticipantsText(e.target.value)}
          placeholder="0x1234...&#10;0x5678...&#10;0xabcd..."
          rows={8}
          className="w-full bg-white/10 border border-purple-500 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-300 font-mono text-sm"
        />
        <p className="text-xs text-purple-300 mt-1">
          {participantsText.split('\n').filter(l => l.trim() && isAddress(l.trim())).length} valid addresses
        </p>
      </div>

      <div className="p-3 bg-yellow-500/20 border border-yellow-500 rounded-lg">
        <p className="text-sm">
          ℹ️ <strong>Note:</strong> Prize funding is not enabled yet, so winners will be selected without prizes. 
          This is perfect for testing and non-monetary raffles!
        </p>
      </div>

      <button
        onClick={handleCreateRaffle}
        disabled={isPending}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 py-3 rounded-lg font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? '⏳ Creating...' : '🎲 Create Raffle'}
      </button>

      {status && (
        <div className="mt-4 p-4 bg-white/10 rounded-lg text-center">
          {status}
        </div>
      )}

      {isAbstractWallet && (
        <div className="mt-4 p-3 bg-green-500/20 border border-green-500 rounded-lg text-sm">
          ✨ <strong>Gasless Transaction:</strong> This transaction will be sponsored by the paymaster. You won't pay any gas fees!
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//                        PICK WINNERS TAB
// ════════════════════════════════════════════════════════════════════

function PickWinnersTab({ isAbstractWallet }: { isAbstractWallet: boolean }) {
  const [raffleId, setRaffleId] = useState('');
  const [winnerCount, setWinnerCount] = useState('');
  const [randomSeed, setRandomSeed] = useState('');
  const [status, setStatus] = useState('');

  const { address, chain } = useAccount();

  const { writeContractSponsored, isPending: isPendingSponsored } = useWriteContractSponsored();
  const { writeContract, isPending: isPendingStandard } = useWriteContract();

  const isPending = isPendingSponsored || isPendingStandard;

  const handlePickWinners = async () => {
    if (!raffleId || !winnerCount) {
      setStatus('❌ Please enter raffle ID and winner count');
      return;
    }

    setStatus('⏳ Picking winners...');

    try {
      // Generate random seed if not provided
      const seed = randomSeed || Math.floor(Math.random() * 1000000).toString();

      if (isAbstractWallet && chain && address) {
        writeContractSponsored({
          address: RAFFLE_CONTRACT_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: 'pickWinners',
          args: [BigInt(raffleId), BigInt(winnerCount), BigInt(seed)],
          paymaster: PAYMASTER_ADDRESS,
          paymasterInput: getGeneralPaymasterInput({ innerInput: '0x' }),
          chain,
          account: address,
        });
        setStatus(`✅ Winners picked for raffle #${raffleId} (gasless)!`);
      } else {
        writeContract({
          address: RAFFLE_CONTRACT_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: 'pickWinners',
          args: [BigInt(raffleId), BigInt(winnerCount), BigInt(seed)],
        } as any);
        setStatus(`✅ Transaction sent!`);
      }

      setRaffleId('');
      setWinnerCount('');
      setRandomSeed('');
    } catch (error: any) {
      console.error('Pick winners error:', error);
      setStatus(`❌ Error: ${error?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4">🎲 Pick Winners</h2>

      <div>
        <label className="block text-sm font-semibold mb-2">Raffle ID</label>
        <input
          type="number"
          value={raffleId}
          onChange={(e) => setRaffleId(e.target.value)}
          placeholder="0"
          className="w-full bg-white/10 border border-purple-500 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-300"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">Number of Winners</label>
        <input
          type="number"
          value={winnerCount}
          onChange={(e) => setWinnerCount(e.target.value)}
          placeholder="1"
          className="w-full bg-white/10 border border-purple-500 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-300"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">
          Random Seed (optional)
        </label>
        <input
          type="number"
          value={randomSeed}
          onChange={(e) => setRandomSeed(e.target.value)}
          placeholder="Auto-generated if empty"
          className="w-full bg-white/10 border border-purple-500 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-300"
        />
        <p className="text-xs text-purple-300 mt-1">
          Optional: Provide your own random number for additional entropy
        </p>
      </div>

      <button
        onClick={handlePickWinners}
        disabled={isPending}
        className="w-full bg-gradient-to-r from-pink-500 to-rose-600 py-3 rounded-lg font-bold hover:scale-105 transition-transform disabled:opacity-50"
      >
        {isPending ? '⏳ Processing...' : '🎯 Pick Winners Now'}
      </button>

      {status && (
        <div className="mt-4 p-4 bg-white/10 rounded-lg text-center">
          {status}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500 rounded-lg text-sm">
        ℹ️ <strong>Note:</strong> The winner selection uses provably fair on-chain randomness combining your seed, block data, and timestamps.
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//                        VIEW RAFFLE TAB
// ════════════════════════════════════════════════════════════════════

function ViewRaffleTab() {
  const [raffleId, setRaffleId] = useState('');

  const { data: nextRaffleId } = useReadContract({
    address: RAFFLE_CONTRACT_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: 'nextRaffleId',
  });

  const { data: raffleInfo } = useReadContract({
    address: RAFFLE_CONTRACT_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: 'getRaffleInfo',
    args: raffleId ? [BigInt(raffleId)] : undefined,
  });

  const { data: participants } = useReadContract({
    address: RAFFLE_CONTRACT_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: 'getParticipants',
    args: raffleId ? [BigInt(raffleId)] : undefined,
  });

  const { data: winners } = useReadContract({
    address: RAFFLE_CONTRACT_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: 'getWinners',
    args: raffleId ? [BigInt(raffleId)] : undefined,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4">📊 View Raffle Details</h2>

      <div className="p-4 bg-white/10 rounded-lg">
        <p className="text-sm">
          <strong>Total Raffles Created:</strong> {nextRaffleId ? nextRaffleId.toString() : '...'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">Raffle ID to View</label>
        <input
          type="number"
          value={raffleId}
          onChange={(e) => setRaffleId(e.target.value)}
          placeholder="0"
          className="w-full bg-white/10 border border-purple-500 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-300"
        />
      </div>

      {raffleId && raffleInfo && (
        <div className="space-y-4">
          {/* Raffle Info Card */}
          <div className="p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500 rounded-lg space-y-2">
            <h3 className="text-xl font-bold mb-2">📋 {raffleInfo[0]}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-purple-300">Participants</p>
                <p className="font-bold">{raffleInfo[1].toString()}</p>
              </div>
              <div>
                <p className="text-purple-300">Winners Selected</p>
                <p className="font-bold">{raffleInfo[2].toString()}</p>
              </div>
              <div>
                <p className="text-purple-300">Status</p>
                <p className="font-bold">{raffleInfo[5] ? '✅ Completed' : '⏳ Pending'}</p>
              </div>
            </div>
          </div>

          {/* Participants List */}
          {participants && participants.length > 0 && (
            <div className="p-4 bg-white/10 rounded-lg">
              <h4 className="font-bold mb-2">👥 Participants ({participants.length})</h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {participants.map((addr, i) => (
                  <div key={i} className="text-xs font-mono bg-black/20 p-2 rounded">
                    {addr}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Winners List */}
          {winners && winners.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500 rounded-lg">
              <h4 className="font-bold mb-2">🏆 Winners ({winners.length})</h4>
              <div className="space-y-1">
                {winners.map((addr, i) => (
                  <div key={i} className="text-xs font-mono bg-black/20 p-2 rounded flex items-center gap-2">
                    <span className="text-yellow-400">🎉</span>
                    {addr}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}