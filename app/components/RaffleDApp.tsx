'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract, useConnect, useDisconnect, useWaitForTransactionReceipt } from 'wagmi';
import { useLoginWithAbstract } from '@abstract-foundation/agw-react';
import { useWriteContractSponsored } from '@abstract-foundation/agw-react';
import { getGeneralPaymasterInput } from 'viem/zksync';
import { isAddress } from 'viem';
import { injected } from 'wagmi/connectors';

const RAFFLE_CONTRACT_ADDRESS = 
  (process.env.NEXT_PUBLIC_RAFFLE_CONTRACT as `0x${string}`) || 
  '0xB05585a897BBA3bA6F9AbDC415034BF88189238F';

const PAYMASTER_ADDRESS = 
  (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS as `0x${string}`) ||
  '0x5407B5040dec3D339A9247f3654E59EEccbb6391';

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

declare global {
  interface Window {
    ethereum?: any;
  }
}

async function addAbstractMainnet() {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0xAB5',
          chainName: 'Abstract Mainnet',
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://api.mainnet.abs.xyz'],
          blockExplorerUrls: ['https://abscan.org']
        }]
      });
    } catch (error) {
      console.error('Failed to add Abstract Mainnet:', error);
    }
  }
}

export default function RaffleDApp() {
  const { address, isConnected, connector } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  
  const { login: loginWithAbstract, logout: logoutFromAbstract } = useLoginWithAbstract();
  
  const isAbstractWallet = connector?.id === 'abstract';

  const handleAbstractConnect = async () => {
    try {
      console.log('Connecting to Abstract wallet via AGW...');
      await loginWithAbstract();
    } catch (error) {
      console.error('Abstract wallet connection failed:', error);
    }
  };

  const handleMetaMaskConnect = async () => {
    try {
      console.log('Connecting to MetaMask/Browser wallet...');
      await addAbstractMainnet();
      connect({ connector: injected() });
    } catch (error) {
      console.error('MetaMask connection failed:', error);
    }
  };

  const handleDisconnect = () => {
    if (isAbstractWallet) {
      logoutFromAbstract();
    } else {
      disconnect();
    }
  };

  return (
    <div className="min-h-screen text-white relative">
      <div 
        className="fixed inset-0 z-0 bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: 'url(/PDGYSTR_BGDK.png)' }}
      />
      <div 
        className="fixed inset-0 z-0 bg-center bg-cover bg-no-repeat opacity-65 blur-sm"
        style={{ backgroundImage: 'url(/PDGYBG2DK.png)' }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <div className="text-center mb-4">
            <h1 className="text-5xl font-bold mb-2">Raffle dApp</h1>
            <p className="text-blue-200">Provably Fair On-Chain Raffles</p>
          </div>

          <div className="flex justify-center gap-3 mb-4">
            {!isConnected ? (
              <>
                <button
                  onClick={handleAbstractConnect}
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-xl transition-all border border-white/20"
                >
                  Connect with Abstract
                </button>
                
                <button
                  onClick={handleMetaMaskConnect}
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-xl transition-all border border-white/20"
                >
                  Connect MetaMask
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/20">
                  <p className="text-sm text-blue-300">
                    {isAbstractWallet ? 'Connected via Abstract' : 'Connected via Browser Wallet'}
                  </p>
                  <p className="font-mono text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-xl border border-white/20"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        <CreateRaffleSection isAbstractWallet={isAbstractWallet} address={address} isConnected={isConnected} />

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <PickWinnersSection isAbstractWallet={isAbstractWallet} address={address} isConnected={isConnected} />
          <LoadRaffleSection isConnected={isConnected} />
        </div>
      </div>
    </div>
  );
}

function CreateRaffleSection({ isAbstractWallet, address, isConnected }: { isAbstractWallet: boolean; address?: `0x${string}`; isConnected: boolean }) {
  const [raffleName, setRaffleName] = useState('');
  const [participantsText, setParticipantsText] = useState('');
  const [status, setStatus] = useState('');

  const { chain } = useAccount();
  const { writeContractSponsored, isPending: isPendingSponsored } = useWriteContractSponsored();
  const { writeContract, isPending: isPendingStandard } = useWriteContract();

  const isPending = isPendingSponsored || isPendingStandard;

  const handleCreateRaffle = async () => {
    if (!isConnected) { setStatus('Connect wallet first'); return; }
    if (!address) { setStatus('Wallet address not found'); return; }
    if (!raffleName.trim()) { setStatus('Enter a raffle name'); return; }

    const enteredParticipants = participantsText
      .split('\n')
      .map(addr => addr.trim())
      .filter(addr => addr && isAddress(addr)) as `0x${string}`[];

    if (enteredParticipants.length === 0) { setStatus('Enter at least one valid address'); return; }

    const participants = [address, ...enteredParticipants];

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
        setStatus('Raffle created (gasless) - You are added as creator');
      } else {
        writeContract({
          address: RAFFLE_CONTRACT_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: 'createRaffle',
          args: [participants, raffleName, false],
        } as any);
        setStatus('Transaction sent - You are added as creator');
      }

      setRaffleName('');
      setParticipantsText('');
    } catch (error: any) {
      setStatus(`Error: ${error?.message || 'Unknown'}`);
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-white/15 bg-white/5 backdrop-blur p-6">
      <h2 className="text-2xl font-bold mb-4">Create Raffle</h2>
      
      <div className="mb-4">
        <label className="block text-blue-200 font-semibold mb-2 text-sm">Raffle Name</label>
        <input
          type="text"
          value={raffleName}
          onChange={(e) => setRaffleName(e.target.value)}
          placeholder="My Raffle"
          disabled={!isConnected}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-blue-300/50 disabled:opacity-50"
        />
      </div>

      <div className="mb-4">
        <label className="block text-blue-200 font-semibold mb-2 text-sm">Participants (one per line)</label>
        <textarea
          value={participantsText}
          onChange={(e) => setParticipantsText(e.target.value)}
          placeholder="0xabc...&#10;0xdef..."
          rows={6}
          disabled={!isConnected}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-blue-300/50 font-mono text-sm disabled:opacity-50"
        />
        <p className="text-xs text-purple-300 mt-1">
          {participantsText.split('\n').filter(l => l.trim() && isAddress(l.trim())).length} valid addresses
        </p>
      </div>

      <button
        onClick={handleCreateRaffle}
        disabled={isPending || !isConnected}
        className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isPending ? 'Creating...' : 'Create Raffle'}
      </button>

      {status && (
        <div className="mt-4 p-3 bg-white/10 rounded-xl text-center text-sm">{status}</div>
      )}
    </section>
  );
}

function PickWinnersSection({ isAbstractWallet, address, isConnected }: { isAbstractWallet: boolean; address?: `0x${string}`; isConnected: boolean }) {
  const [raffleId, setRaffleId] = useState('');
  const [winnerCount, setWinnerCount] = useState('1');
  const [status, setStatus] = useState('');

  const { chain } = useAccount();
  const { writeContractSponsored, data: sponsoredHash, isPending: isPendingSponsored } = useWriteContractSponsored();
  const { writeContract, data: standardHash, isPending: isPendingStandard } = useWriteContract();

  const isPending = isPendingSponsored || isPendingStandard;
  const txHash = sponsoredHash || standardHash;

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isConfirmed && raffleId) {
      setStatus('Winners picked successfully! Refreshing data...');
      setTimeout(() => {
        setStatus('Winners picked! Check "My Raffles" to see results.');
        window.dispatchEvent(new Event('raffleUpdated'));
      }, 2000);
    }
  }, [isConfirmed, raffleId]);

  const handlePickWinners = async () => {
    if (!isConnected) { setStatus('Connect wallet first'); return; }
    if (!raffleId || !winnerCount) { setStatus('Enter raffle ID and winner count'); return; }

    setStatus('Picking winners...');

    try {
      const randomSeed = BigInt(Math.floor(Math.random() * 1000000000));

      // Use standard writeContract for all wallets (no paymaster)
      writeContract({
        address: RAFFLE_CONTRACT_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: 'pickWinners',
        args: [BigInt(raffleId), BigInt(winnerCount), randomSeed],
      } as any);
    } catch (error: any) {
      setStatus(`Error: ${error?.message || 'Unknown'}`);
    }
  };

  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur p-6">
      <h2 className="text-2xl font-bold mb-4">Pick Winners</h2>
      
      <div className="mb-3">
        <label className="block text-blue-200 font-semibold mb-2 text-sm">Raffle ID</label>
        <input
          type="number"
          value={raffleId}
          onChange={(e) => setRaffleId(e.target.value)}
          placeholder="0"
          disabled={!isConnected}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white disabled:opacity-50"
        />
      </div>

      <div className="mb-4">
        <label className="block text-blue-200 font-semibold mb-2 text-sm">Winners</label>
        <input
          type="number"
          value={winnerCount}
          onChange={(e) => setWinnerCount(e.target.value)}
          min="1"
          disabled={!isConnected}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white disabled:opacity-50"
        />
      </div>

      <button
        onClick={handlePickWinners}
        disabled={isPending || isConfirming || !isConnected}
        className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isPending || isConfirming ? 'Picking Winners...' : 'Pick Winners'}
      </button>

      {status && (
        <div className={`mt-4 p-3 rounded-xl text-center text-sm ${
          isConfirmed ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-white/10'
        }`}>
          {status}
        </div>
      )}

      {isConfirming && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-blue-300">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
          Waiting for confirmation...
        </div>
      )}
    </div>
  );
}

function LoadRaffleSection({ isConnected }: { isConnected: boolean }) {
  const { address } = useAccount();
  const [myRaffles, setMyRaffles] = useState<number[]>([]);
  const [selectedRaffleId, setSelectedRaffleId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handleRaffleUpdate = () => {
      console.log('Raffle updated event received, refreshing data...');
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener('raffleUpdated', handleRaffleUpdate);
    return () => window.removeEventListener('raffleUpdated', handleRaffleUpdate);
  }, []);

  const { data: nextRaffleId } = useReadContract({
    address: RAFFLE_CONTRACT_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: 'nextRaffleId',
  });

  const { data: raffleInfo, refetch: refetchInfo } = useReadContract({
    address: RAFFLE_CONTRACT_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: 'getRaffleInfo',
    args: selectedRaffleId ? [BigInt(selectedRaffleId)] : undefined,
  });

  const { data: participants, refetch: refetchParticipants } = useReadContract({
    address: RAFFLE_CONTRACT_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: 'getParticipants',
    args: selectedRaffleId ? [BigInt(selectedRaffleId)] : undefined,
  });

  const { data: winners, refetch: refetchWinners } = useReadContract({
    address: RAFFLE_CONTRACT_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: 'getWinners',
    args: selectedRaffleId ? [BigInt(selectedRaffleId)] : undefined,
  });

  useEffect(() => {
    if (refreshKey > 0 && selectedRaffleId) {
      console.log('Refetching raffle data...');
      refetchInfo();
      refetchParticipants();
      refetchWinners();
    }
  }, [refreshKey, selectedRaffleId, refetchInfo, refetchParticipants, refetchWinners]);

  useEffect(() => {
    const fetchMyRaffles = async () => {
      if (!nextRaffleId || !address) {
        setMyRaffles([]);
        return;
      }

      setIsLoading(true);
      const userRaffles: number[] = [];
      const totalRaffles = Number(nextRaffleId);

      console.log(`Checking ${totalRaffles} total raffles for wallet ${address}`);

      const { createPublicClient, http } = await import('viem');
      const { abstract } = await import('viem/chains');

      const publicClient = createPublicClient({
        chain: abstract,
        transport: http('https://api.mainnet.abs.xyz')
      });

      for (let i = 0; i < totalRaffles; i++) {
        try {
          const participants = await publicClient.readContract({
  address: RAFFLE_CONTRACT_ADDRESS,
  abi: RAFFLE_ABI,
  functionName: 'getParticipants',
  args: [BigInt(i)]
} as any) as `0x${string}`[];

          if (participants && participants.length > 0) {
            const firstParticipant = participants[0];
            console.log(`Raffle ${i}: Creator = ${firstParticipant}, You = ${address}`);
            
            if (firstParticipant.toLowerCase() === address.toLowerCase()) {
              console.log(`✓ You created raffle ${i}!`);
              userRaffles.push(i);
            }
          } else {
            console.log(`Raffle ${i}: No participants found`);
          }
        } catch (error) {
          console.error(`Error reading raffle ${i}:`, error);
        }
      }

      console.log(`Total raffles you created: ${userRaffles.length}`);
      setMyRaffles(userRaffles);
      setIsLoading(false);
    };

    fetchMyRaffles();
  }, [nextRaffleId, address]);

  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur p-6">
      <h2 className="text-2xl font-bold mb-4">My Raffles</h2>

      {!isConnected ? (
        <div className="p-4 bg-white/10 rounded-xl text-center text-sm text-blue-300">
          Connect wallet to view your raffles
        </div>
      ) : (
        <>
          <div className="mb-3 p-3 bg-white/10 rounded-xl">
            <p className="text-sm">
              <strong>Total Raffles:</strong> {nextRaffleId ? nextRaffleId.toString() : '...'}
            </p>
            <p className="text-sm mt-1">
              <strong>Your Raffles:</strong> {isLoading ? 'Loading...' : myRaffles.length}
            </p>
          </div>

          {myRaffles.length > 0 ? (
            <>
              <div className="mb-4">
                <label className="block text-blue-200 font-semibold mb-2 text-sm">Select Your Raffle</label>
                <select
                  value={selectedRaffleId}
                  onChange={(e) => setSelectedRaffleId(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white"
                >
                  <option value="">Choose a raffle...</option>
                  {myRaffles.map((id) => (
                    <option key={id} value={id} className="bg-slate-800">
                      Raffle #{id}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRaffleId && raffleInfo && (
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xl font-bold">{raffleInfo[0]}</h3>
                      <div className="bg-purple-600/40 px-3 py-1 rounded-full">
                        <span className="text-sm font-semibold">ID: #{selectedRaffleId}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-purple-300">Participants</p>
                        <p className="font-bold">{raffleInfo[1].toString()}</p>
                      </div>
                      <div>
                        <p className="text-purple-300">Winners</p>
                        <p className="font-bold">{raffleInfo[2].toString()}</p>
                      </div>
                      <div>
                        <p className="text-purple-300">Status</p>
                        <p className="font-bold">{raffleInfo[5] ? 'Done' : 'Active'}</p>
                      </div>
                    </div>
                  </div>

                  {participants && participants.length > 0 && (
                    <div className="p-3 bg-white/10 rounded-xl">
                      <h4 className="font-bold mb-2 text-sm">Participants ({participants.length})</h4>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {participants.map((addr, i) => (
                          <div key={i} className="text-xs font-mono bg-black/30 p-2 rounded break-all">{addr}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {winners && winners.length > 0 && (
                    <div className="p-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl">
                      <h4 className="font-bold mb-2 text-sm">Winners ({winners.length})</h4>
                      <div className="space-y-1">
                        {winners.map((addr, i) => (
                          <div key={i} className="text-xs font-mono bg-black/30 p-2 rounded break-all">{addr}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : !isLoading ? (
            <div className="p-4 bg-white/10 rounded-xl text-center text-sm text-blue-300">
              You haven't created any raffles yet
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}