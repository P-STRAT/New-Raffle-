'use client';

import React from 'react';
import { AbstractWalletProvider } from '@abstract-foundation/agw-react';
import { http } from 'viem';
import { abstractTestnet, abstract } from 'viem/chains';

/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║              ABSTRACT WALLET PROVIDER WRAPPER                     ║
 * ║                                                                   ║
 * ║  This component wraps your app with AbstractWalletProvider,       ║
 * ║  enabling Abstract Global Wallet functionality throughout.        ║
 * ║                                                                   ║
 * ║  Features:                                                        ║
 * ║  • Automatic network detection (testnet/mainnet)                  ║
 * ║  • Custom RPC support                                             ║
 * ║  • Environment variable configuration                             ║
 * ║                                                                   ║
 * ║  Based on official AGW boilerplate patterns                       ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

// ════════════════════════════════════════════════════════════════════
//                      CONFIGURATION
// ════════════════════════════════════════════════════════════════════

/**
 * Determine if we're on testnet or mainnet
 * Default: testnet (safest for development)
 */
const isTestnet =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_ABSTRACT_TESTNET === 'false'
    ? false
    : true;

/**
 * Get custom RPC URL if provided
 * Ensure it has the https:// protocol
 */
const getRpcUrl = (): string | undefined => {
  if (typeof process === 'undefined' || !process.env.NEXT_PUBLIC_ABSTRACT_RPC) {
    return undefined;
  }

  const rpc = String(process.env.NEXT_PUBLIC_ABSTRACT_RPC).trim();
  
  // Add https:// if not present
  if (rpc.startsWith('http://') || rpc.startsWith('https://')) {
    return rpc;
  }
  
  return `https://${rpc.replace(/^\/+/, '')}`;
};

const rpcUrl = getRpcUrl();

/**
 * Select the appropriate chain based on environment
 */
const selectedChain = isTestnet ? abstractTestnet : abstract;

/**
 * Create transport configuration
 * Uses custom RPC if provided, otherwise uses chain defaults
 */
const transport = rpcUrl ? http(rpcUrl) : undefined;

// ════════════════════════════════════════════════════════════════════
//                      PROVIDER COMPONENT
// ════════════════════════════════════════════════════════════════════

interface AbstractProviderProps {
  children: React.ReactNode;
}

export default function AbstractProvider({ children }: AbstractProviderProps) {
  // Log configuration in development
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('🔧 Abstract Provider Configuration:', {
      network: isTestnet ? 'Testnet' : 'Mainnet',
      chainId: selectedChain.id,
      rpcUrl: rpcUrl || 'default',
      chainName: selectedChain.name
    });
  }

  return (
    <AbstractWalletProvider 
      chain={selectedChain}
      transport={transport}
    >
      {children}
    </AbstractWalletProvider>
  );
}

// ════════════════════════════════════════════════════════════════════
//                      USAGE INSTRUCTIONS
// ════════════════════════════════════════════════════════════════════

/**
 * HOW TO USE THIS COMPONENT:
 * 
 * 1. Import in your root layout (app/layout.tsx):
 * 
 *    import AbstractProvider from '@/components/AbstractProvider';
 * 
 * 2. Wrap your app:
 * 
 *    export default function RootLayout({ children }) {
 *      return (
 *        <html lang="en">
 *          <body>
 *            <AbstractProvider>
 *              {children}
 *            </AbstractProvider>
 *          </body>
 *        </html>
 *      );
 *    }
 * 
 * 3. Configure via .env.local:
 * 
 *    NEXT_PUBLIC_ABSTRACT_TESTNET=true
 *    NEXT_PUBLIC_ABSTRACT_RPC=api.testnet.abs.xyz
 * 
 * 4. Use AGW hooks in any child component:
 * 
 *    import { useLoginWithAbstract } from '@abstract-foundation/agw-react';
 *    import { useAccount } from 'wagmi';
 * 
 *    function MyComponent() {
 *      const { login } = useLoginWithAbstract();
 *      const { address, isConnected } = useAccount();
 *      // ... your code
 *    }
 */

// ════════════════════════════════════════════════════════════════════
//                      NETWORK INFORMATION
// ════════════════════════════════════════════════════════════════════

/**
 * Abstract Testnet:
 * - Chain ID: 11124
 * - RPC: https://api.testnet.abs.xyz
 * - Explorer: https://explorer.testnet.abs.xyz
 * - Paymaster: 0x5407B5040dec3D339A9247f3654E59EEccbb6391
 * 
 * Abstract Mainnet:
 * - Chain ID: 2741
 * - RPC: https://api.mainnet.abs.xyz
 * - Explorer: https://abscan.org
 * - Native Token: ETH
 */