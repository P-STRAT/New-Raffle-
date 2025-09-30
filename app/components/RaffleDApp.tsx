'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract, useConnect, useDisconnect } from 'wagmi';
import { useWriteContractSponsored } from '@abstract-foundation/agw-react';
import { getGeneralPaymasterInput } from 'viem/zksync';
import { isAddress } from 'viem';

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
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  const isAbstractWallet = connector?.id === 'abstract';

  const handleConnect = async (connectorToUse: any) => {
    // Add Abstract network for MetaMask/Injected wallets
    if (connectorToUse.id !== 'abstract') {
      await addAbstractMainnet();
    }
    connect({ connector: connectorToUse });
  };

  // Configuration from old file
  const CONFIG = {
    WORKER: 'https://pudgy-floor-proxy.pdgystr.workers.dev',
    ABSTRACT_RPC: 'https://api.mainnet.abs.xyz',
    NFT_CHAIN: 'ethereum',
    COLLECTION_SLUG: 'pudgypenguins',
    CONTRACT: '0xBd3531dA5CF5857e7CfAA92426877b022e612cf8',
    TREASURY: '0x4B550Aad15F5D28179e5Bc6918113bf64181621c',
  };
  
  const [pudgyHoldings, setPudgyHoldings] = useState<any[]>([]);
  const [treasuryEth, setTreasuryEth] = useState<number>(0);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [targetId, setTargetId] = useState<string>('');
  const [targetImage, setTargetImage] = useState<string>('');
  const [targetLink, setTargetLink] = useState<string>('');

  // Helper functions from old file
  const fmtEth = (n: number) => { 
    if (n === 0) return '0'; 
    if (!isFinite(n)) return '—'; 
    const v = Number(n); 
    return (v >= 1 ? v.toFixed(4) : v.toFixed(6)).replace(/0+$/, '').replace(/\.$/, ''); 
  };

  function hexWeiToEth(hex: string): number {
    try {
      const wei = BigInt(hex);
      const divisor = BigInt(10) ** BigInt(18);
      const whole = wei / divisor;
      const remainder = wei % divisor;
      const frac = remainder.toString().padStart(18, '0').replace(/0+$/, '');
      return Number(frac ? `${whole}.${frac}` : whole.toString());
    } catch {
      return 0;
    }
  }

  function extractEthPrice(obj: any): number | null {
    if (obj == null) return null;
    if (typeof obj === 'number' && isFinite(obj) && obj > 0) return obj;
    if (typeof obj === 'string') {
      const n = Number(obj);
      if (isFinite(n) && n > 0) return n;
    }
    if (obj.eth != null) {
      const n = Number(obj.eth);
      if (isFinite(n) && n > 0) return n;
    }
    if (obj.amount != null) {
      const n = Number(obj.amount);
      if (isFinite(n) && n > 0) return n;
    }
    return null;
  }

  async function getJson(url: string) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
    return r.json();
  }

  // Fetch data exactly like old file
  useEffect(() => {
    async function loadData() {
      try {
        // 1. Load holdings
        const holdingsData = await getJson(
          `${CONFIG.WORKER}/account/${CONFIG.NFT_CHAIN}/${CONFIG.TREASURY}/nfts?limit=48&collection_slug=${CONFIG.COLLECTION_SLUG}`
        );
        const nfts = Array.isArray(holdingsData?.nfts) ? holdingsData.nfts : [];
        setPudgyHoldings(nfts);

        // 2. Load treasury ETH
        const balanceData = await getJson(
          `${CONFIG.WORKER}/balance/abstract/${CONFIG.TREASURY}`
        );
        if (typeof balanceData?.eth === 'number') {
          setTreasuryEth(balanceData.eth);
        } else if (balanceData?.eth_str) {
          setTreasuryEth(Number(balanceData.eth_str));
        } else {
          // Fallback to direct RPC
          const rpcResp = await fetch(CONFIG.ABSTRACT_RPC, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_getBalance',
              params: [CONFIG.TREASURY, 'latest']
            })
          });
          const rpcData = await rpcResp.json();
          if (rpcData?.result) {
            setTreasuryEth(hexWeiToEth(rpcData.result));
          }
        }

        // 3. Load cheapest Pudgy (exact logic from old file)
        const limits = [120, 80, 50, 30];
        for (const L of limits) {
          try {
            const cheapestData = await getJson(
              `${CONFIG.WORKER}/collection/${encodeURIComponent(CONFIG.COLLECTION_SLUG)}/cheapest?chain=${CONFIG.NFT_CHAIN}&limit=${L}`
            );
            const arr = Array.isArray(cheapestData?.listings) ? cheapestData.listings : [];
            if (!arr.length) continue;

            const normalized = arr.map((it: any) => {
              const price = Number.isFinite(it.price_eth) ? it.price_eth : extractEthPrice(it.price);
              return { ...it, _priceEth: price };
            });

            const withPrice = normalized.filter((x: any) => Number.isFinite(x._priceEth) && x._priceEth > 0);
            const pick = withPrice.length
              ? withPrice.sort((a: any, b: any) => a._priceEth - b._priceEth)[0]
              : normalized.find((x: any) => x.contract && x.identifier);

            if (!pick) continue;

            const id = String(pick.identifier);
            const link = `https://opensea.io/assets/${CONFIG.NFT_CHAIN}/${pick.contract}/${id}`;
            let image = pick.image_url || null;

            if (!image) {
              try {
                const meta = await getJson(`${CONFIG.WORKER}/nft/${CONFIG.NFT_CHAIN}/${pick.contract}/${id}`);
                image = meta?.image_url || null;
              } catch {}
            }

            setTargetPrice(pick._priceEth ?? 0);
            setTargetId(id);
            setTargetImage(image || '');
            setTargetLink(link);
            break;
          } catch (e) {
            console.warn('OpenSea cheapest failed', e);
          }
        }
      } catch (err) {
        console.error('Failed to load Pudgy data:', err);
      }
    }

    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen text-white relative">
      {/* Background Images - Using your custom images */}
      <div 
        className="fixed inset-0 z-0 bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: 'url(/PDGYSTR_BGDK.png)' }}
      />
      <div 
        className="fixed inset-0 z-0 bg-center bg-cover bg-no-repeat opacity-65 blur-sm"
        style={{ backgroundImage: 'url(/PDGYBG2DK.png)' }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        {/* Header with Wallet Buttons ALWAYS at Top */}
        <div className="mb-8">
          <div className="text-center mb-4">
            <h1 className="text-5xl font-bold mb-2">Raffle dApp</h1>
            <p className="text-blue-200">Provably Fair On-Chain Raffles</p>
          </div>

          {/* Wallet Connection - Always Visible */}
          <div className="flex justify-center gap-3 mb-4">
            {!isConnected ? (
              <>
                {connectors.map((conn) => (
                  <button
                    key={conn.id}
                    onClick={() => handleConnect(conn)}
                    className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-xl transition-all border border-white/20"
                  >
                    {conn.id === 'abstract' ? 'Connect with Abstract' : 
                     conn.name.includes('MetaMask') || conn.name.includes('Injected') ? 'Connect MetaMask' : 
                     `Connect ${conn.name}`}
                  </button>
                ))}
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
                  onClick={() => disconnect()}
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-xl border border-white/20"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Content - ALWAYS VISIBLE */}
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
    if (!raffleName.trim()) { setStatus('Enter a raffle name'); return; }

    const participants = participantsText
      .split('\n')
      .map(addr => addr.trim())
      .filter(addr => addr && isAddress(addr)) as `0x${string}`[];

    if (participants.length === 0) { setStatus('Enter at least one valid address'); return; }

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
        setStatus('Raffle created (gasless)');
      } else {
        writeContract({
          address: RAFFLE_CONTRACT_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: 'createRaffle',
          args: [participants, raffleName, false],
        } as any);
        setStatus('Transaction sent');
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
  const { writeContractSponsored, isPending: isPendingSponsored } = useWriteContractSponsored();
  const { writeContract, isPending: isPendingStandard } = useWriteContract();

  const isPending = isPendingSponsored || isPendingStandard;

  const handlePickWinners = async () => {
    if (!isConnected) { setStatus('Connect wallet first'); return; }
    if (!raffleId || !winnerCount) { setStatus('Enter raffle ID and winner count'); return; }

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
        setStatus('Winners picked');
      } else {
        writeContract({
          address: RAFFLE_CONTRACT_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: 'pickWinners',
          args: [BigInt(raffleId), BigInt(winnerCount), randomSeed],
        } as any);
        setStatus('Transaction sent');
      }

      setRaffleId('');
      setWinnerCount('1');
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
        disabled={isPending || !isConnected}
        className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Picking...' : 'Pick Winners'}
      </button>

      {status && (
        <div className="mt-4 p-3 bg-white/10 rounded-xl text-center text-sm">{status}</div>
      )}
    </div>
  );
}

function LoadRaffleSection({ isConnected }: { isConnected: boolean }) {
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
    <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur p-6">
      <h2 className="text-2xl font-bold mb-4">Load Raffle Info</h2>

      <div className="mb-3 p-3 bg-white/10 rounded-xl">
        <p className="text-sm">
          <strong>Total Raffles:</strong> {nextRaffleId ? nextRaffleId.toString() : '...'}
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-blue-200 font-semibold mb-2 text-sm">Raffle ID</label>
        <input
          type="number"
          value={raffleId}
          onChange={(e) => setRaffleId(e.target.value)}
          placeholder="0"
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white"
        />
      </div>

      {raffleId && raffleInfo && (
        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl">
            <h3 className="text-xl font-bold mb-3">{raffleInfo[0]}</h3>
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
    </div>
  );
}
