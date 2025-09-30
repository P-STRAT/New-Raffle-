'use client';

import React, { useState } from 'react';
import { useAccount, useWriteContract, useReadContract, useConnect, useDisconnect } from 'wagmi';
import { useWriteContractSponsored } from '@abstract-foundation/agw-react';
import { getGeneralPaymasterInput } from 'viem/zksync';
import { isAddress } from 'viem';

// Configuration
const RAFFLE_CONTRACT_ADDRESS = 
  (process.env.NEXT_PUBLIC_RAFFLE_CONTRACT as `0x${string}`) || 
  '0xB05585a897BBA3bA6F9AbDC415034BF88189238F';

const PAYMASTER_ADDRESS = 
  (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS as `0x${string}`) ||
  '0x5407B5040dec3D339A9247f3654E59EEccbb6391';

// Raffle contract ABI
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
  }
] as const;

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Helper to add Abstract Network to MetaMask
async function addAbstractNetwork() {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0xAB5', // 2741 in hex
          chainName: 'Abstract Mainnet',
          nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18
          },
          rpcUrls: ['https://api.mainnet.abs.xyz'],
          blockExplorerUrls: ['https://abscan.org']
        }]
      });
      return true;
    } catch (error) {
      console.error('Failed to add network:', error);
      return false;
    }
  }
  return false;
}

export default function RaffleDApp() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  const isAbstractWallet = connector?.id === 'abstract';
  const [activeTab, setActiveTab] = useState<'create' | 'pick' | 'view'>('create');

  const handleConnect = async (connectorToUse: any) => {
    // If it's MetaMask, add the network first
    if (connectorToUse.name.toLowerCase().includes('metamask')) {
      await addAbstractNetwork();
    }
    connect({ connector: connectorToUse });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Animated Background Pattern */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
            Raffle dApp
          </h1>
          <p className="text-xl text-blue-200">
            Provably Fair On-Chain Raffles
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="max-w-md mx-auto mb-8 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-6">
          {!isConnected ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white text-center mb-4">
                Connect Your Wallet
              </h2>
              <p className="text-blue-200 text-center text-sm mb-6">
                Use Abstract Global Wallet for gasless transactions, or connect with MetaMask
              </p>
              {connectors.map((conn) => (
                <button
                  key={conn.id}
                  onClick={() => handleConnect(conn)}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  {conn.name === 'Abstract' ? 'Connect with Abstract' : `Connect ${conn.name}`}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-blue-300 mb-2">
                  {isAbstractWallet ? 'Connected via Abstract' : 'Connected via Browser Wallet'}
                </p>
                <p className="text-white font-mono text-sm bg-black/30 px-4 py-2 rounded-lg break-all">
                  {address}
                </p>
              </div>
              <button
                onClick={() => disconnect()}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Main Content */}
        {isConnected && (
          <div className="max-w-4xl mx-auto">
            {/* Tab Navigation */}
            <div className="flex justify-center gap-4 mb-8">
              {['create', 'pick', 'view'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-8 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                    activeTab === tab
                      ? 'bg-white text-purple-900 shadow-2xl'
                      : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md'
                  }`}
                >
                  {tab === 'create' && 'Create Raffle'}
                  {tab === 'pick' && 'Pick Winners'}
                  {tab === 'view' && 'View Raffle'}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-8">
              {activeTab === 'create' && <CreateRaffleTab isAbstractWallet={isAbstractWallet} />}
              {activeTab === 'pick' && <PickWinnersTab isAbstractWallet={isAbstractWallet} />}
              {activeTab === 'view' && <ViewRaffleTab />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// CREATE RAFFLE TAB
function CreateRaffleTab({ isAbstractWallet }: { isAbstractWallet: boolean }) {
  const [raffleName, setRaffleName] = useState('');
  const [participantsText, setParticipantsText] = useState('');
  const [status, setStatus] = useState('');

  const { address, chain } = useAccount();
  const { writeContractSponsored, isPending: isPendingSponsored } = useWriteContractSponsored();
  const { writeContract, isPending: isPendingStandard } = useWriteContract();

  const isPending = isPendingSponsored || isPendingStandard;

  const handleCreateRaffle = async () => {
    if (!raffleName.trim()) {
      setStatus('Please enter a raffle name');
      return;
    }

    const participants = participantsText
      .split('\n')
      .map(addr => addr.trim())
      .filter(addr => addr && isAddress(addr)) as `0x${string}`[];

    if (participants.length === 0) {
      setStatus('Please enter at least one valid address');
      return;
    }

    setStatus('Creating raffle...');

    try {
      if (isAbstractWallet && chain && address) {
        writeContractSponsored({
          address: RAFFLE_CONTRACT_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: 'createRaffle',
          args: [participants, raffleName, false],
          paymaster: PAYMASTER_ADDRESS,
          paymasterInput: getGeneralPaymasterInput({ innerInput: '0x' }),
          chain,
          account: address,
        });
        setStatus('Raffle created (gasless)!');
      } else {
        writeContract({
          address: RAFFLE_CONTRACT_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: 'createRaffle',
          args: [participants, raffleName, false],
        } as any);
        setStatus('Transaction sent!');
      }

      setRaffleName('');
      setParticipantsText('');
    } catch (error: any) {
      setStatus(`Error: ${error?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-6">Create New Raffle</h2>
      
      <div>
        <label className="block text-blue-200 font-semibold mb-2">Raffle Name</label>
        <input
          type="text"
          value={raffleName}
          onChange={(e) => setRaffleName(e.target.value)}
          placeholder="My Amazing Raffle"
          className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div>
        <label className="block text-blue-200 font-semibold mb-2">
          Participants (one address per line)
        </label>
        <textarea
          value={participantsText}
          onChange={(e) => setParticipantsText(e.target.value)}
          placeholder="0xabc...&#10;0xdef..."
          rows={8}
          className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono text-sm"
        />
        <p className="text-xs text-purple-300 mt-1">
          {participantsText.split('\n').filter(l => l.trim() && isAddress(l.trim())).length} valid addresses
        </p>
      </div>

      <button
        onClick={handleCreateRaffle}
        disabled={isPending}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50"
      >
        {isPending ? 'Creating...' : 'Create Raffle'}
      </button>

      {status && (
        <div className="mt-4 p-4 bg-white/10 rounded-xl text-center text-white">
          {status}
        </div>
      )}
    </div>
  );
}

// PICK WINNERS TAB
function PickWinnersTab({ isAbstractWallet }: { isAbstractWallet: boolean }) {
  const [raffleId, setRaffleId] = useState('');
  const [winnerCount, setWinnerCount] = useState('1');
  const [status, setStatus] = useState('');

  const { address, chain } = useAccount();
  const { writeContractSponsored, isPending: isPendingSponsored } = useWriteContractSponsored();
  const { writeContract, isPending: isPendingStandard } = useWriteContract();

  const isPending = isPendingSponsored || isPendingStandard;

  const handlePickWinners = async () => {
    if (!raffleId || !winnerCount) {
      setStatus('Please enter raffle ID and winner count');
      return;
    }

    setStatus('Picking winners...');

    try {
      const randomSeed = BigInt(Math.floor(Math.random() * 1000000000));

      if (isAbstractWallet && chain && address) {
        writeContractSponsored({
          address: RAFFLE_CONTRACT_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: 'pickWinners',
          args: [BigInt(raffleId), BigInt(winnerCount), randomSeed],
          paymaster: PAYMASTER_ADDRESS,
          paymasterInput: getGeneralPaymasterInput({ innerInput: '0x' }),
          chain,
          account: address,
        });
        setStatus('Winners picked!');
      } else {
        writeContract({
          address: RAFFLE_CONTRACT_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: 'pickWinners',
          args: [BigInt(raffleId), BigInt(winnerCount), randomSeed],
        } as any);
        setStatus('Transaction sent!');
      }

      setRaffleId('');
      setWinnerCount('1');
    } catch (error: any) {
      setStatus(`Error: ${error?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-6">Pick Winners</h2>
      
      <div>
        <label className="block text-blue-200 font-semibold mb-2">Raffle ID</label>
        <input
          type="text"
          value={raffleId}
          onChange={(e) => setRaffleId(e.target.value)}
          placeholder="0"
          className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div>
        <label className="block text-blue-200 font-semibold mb-2">Number of Winners</label>
        <input
          type="number"
          value={winnerCount}
          onChange={(e) => setWinnerCount(e.target.value)}
          min="1"
          className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <button
        onClick={handlePickWinners}
        disabled={isPending}
        className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50"
      >
        {isPending ? 'Picking...' : 'Pick Winners'}
      </button>

      {status && (
        <div className="mt-4 p-4 bg-white/10 rounded-xl text-center text-white">
          {status}
        </div>
      )}
    </div>
  );
}

// VIEW RAFFLE TAB
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
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-6">View Raffle Details</h2>

      <div className="p-4 bg-white/10 rounded-xl">
        <p className="text-sm text-white">
          <strong>Total Raffles Created:</strong> {nextRaffleId ? nextRaffleId.toString() : '...'}
        </p>
      </div>

      <div>
        <label className="block text-blue-200 font-semibold mb-2">Raffle ID</label>
        <input
          type="text"
          value={raffleId}
          onChange={(e) => setRaffleId(e.target.value)}
          placeholder="0"
          className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {raffleId && raffleInfo && (
        <div className="space-y-4">
          <div className="p-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500 rounded-xl">
            <h3 className="text-2xl font-bold text-white mb-4">{raffleInfo[0]}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-white">
              <div>
                <p className="text-purple-300">Participants</p>
                <p className="font-bold text-lg">{raffleInfo[1].toString()}</p>
              </div>
              <div>
                <p className="text-purple-300">Winners Selected</p>
                <p className="font-bold text-lg">{raffleInfo[2].toString()}</p>
              </div>
              <div>
                <p className="text-purple-300">Status</p>
                <p className="font-bold text-lg">{raffleInfo[5] ? 'Completed' : 'Pending'}</p>
              </div>
            </div>
          </div>

          {participants && participants.length > 0 && (
            <div className="p-4 bg-white/10 rounded-xl">
              <h4 className="font-bold text-white mb-3">Participants ({participants.length})</h4>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {participants.map((addr, i) => (
                  <div key={i} className="text-xs font-mono bg-black/30 p-3 rounded-lg text-white break-all">
                    {addr}
                  </div>
                ))}
              </div>
            </div>
          )}

          {winners && winners.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500 rounded-xl">
              <h4 className="font-bold text-white mb-3">Winners ({winners.length})</h4>
              <div className="space-y-2">
                {winners.map((addr, i) => (
                  <div key={i} className="text-xs font-mono bg-black/30 p-3 rounded-lg text-white break-all">
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