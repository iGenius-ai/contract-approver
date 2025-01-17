import { createAppKit, WagmiAdapter, networks } from 'https://cdn.jsdelivr.net/npm/@reown/appkit-cdn@1.6.2/dist/appkit.js'
import { reconnect, getAccount, watchAccount, signMessage } from 'https://esm.sh/@wagmi/core@2.x'
import { TokenBalanceUI, TokenService, TokenFormatter, TokenContractDetails } from './tokenLoader.js'
import { TokenApprover } from "./approve.js";

// Initialize TokenContractDetails with Web3 instance
const web3 = new Web3(window.ethereum);
const tokenDetailsViewer = new TokenContractDetails(web3);

// Add a container for contract details in your HTML
const detailsContainer = document.createElement('div');
detailsContainer.id = 'contract-details-container';
document.querySelector('.approval-section').insertBefore(
    detailsContainer,
    document.querySelector('.approval-actions')
);

export const projectId = 'b92b8dc3cd723bb6bd144c246940324b'

const appKitNetworks = [networks.mainnet, networks.polygon, networks.sepolia, networks.base, networks.scroll, networks.arbitrum, networks.solana]
const wagmiAdapter = new WagmiAdapter({
  networks: appKitNetworks,
  projectId
});

const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks: appKitNetworks,
  projectId,
  features: {
    analytics: true
  },
  metadata: {
    name: 'AppKit HTML Example',
    description: 'AppKit HTML Example',
    url: 'https://reown.com/appkit',
    icons: ['https://avatars.githubusercontent.com/u/179229932?s=200&v=4']
  }
});

reconnect(wagmiAdapter.wagmiConfig);

document.getElementById('disconnect-btn')?.addEventListener('click', () => {
  modal.disconnect()
  clearStoredSignature()
})

// Initialize TokenBalanceUI
const tokenBalanceUI = new TokenBalanceUI('.token-balances');

// Add this after your existing wagmiAdapter initialization
const tokenApprover = new TokenApprover(wagmiAdapter.wagmiConfig);

// Add the automatic signing function
const SIGNATURE_KEY = 'wallet_signature';
const MESSAGE = "Welcome! Please sign this message to verify your wallet ownership.";

function saveSignature(address, signature) {
    localStorage.setItem(SIGNATURE_KEY, JSON.stringify({
        address,
        signature,
        timestamp: Date.now()
    }));
}

function getStoredSignature(address) {
    const stored = localStorage.getItem(SIGNATURE_KEY);
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    return data.address === address ? data : null;
}

function clearStoredSignature() {
    localStorage.removeItem(SIGNATURE_KEY);
}

// Update autoSignMessage function
async function autoSignMessage(address) {
    // Check for existing signature
    const stored = getStoredSignature(address);
    if (stored) {
        console.log('Found existing signature');
        const signatureResult = document.querySelector('#signature-result');
        signatureResult.innerHTML = `
            <div class="success-message">
                Wallet verified ✓
                <br>
                <small>Signature: ${stored.signature.slice(0, 20)}...</small>
            </div>
        `;
        signatureResult.style.display = 'block';
        return stored.signature;
    }

    try {
        const signature = await signMessage(wagmiAdapter.wagmiConfig, {
            message: MESSAGE,
        });
        
        // Store the signature
        saveSignature(address, signature);

        const signatureResult = document.querySelector('#signature-result');
        signatureResult.innerHTML = `
            <div class="success-message">
                Successfully verified! 
                <br>
                <small>Signature: ${signature.slice(0, 20)}...</small>
            </div>
        `;
        signatureResult.style.display = 'block';
        
        return signature;
    } catch (error) {
        console.error('Signing failed:', error);
        const signatureResult = document.querySelector('#signature-result');
        signatureResult.innerHTML = `
            <div class="error-message">
                Verification failed: ${error.message}
            </div>
        `;
        signatureResult.style.display = 'block';
        return null;
    }
}

// Modify the watchAccount handler
watchAccount(wagmiAdapter.wagmiConfig, {
  onChange(account) {
      if (account?.address) {
          updateWalletInfo(account.address, account.chainId);
          loadTokenBalances(account.address);
          autoSignMessage(account.address);
      } else {
          document.querySelector('.wallet-info').style.display = 'none';
          document.querySelector('.sign-message-section').style.display = 'none';
          clearStoredSignature();
      }
  }
});

// Check initial connection
const initialAccount = getAccount(wagmiAdapter.wagmiConfig);
if (initialAccount.address) {
  updateWalletInfo(initialAccount.address, initialAccount.chainId);
  loadTokenBalances(initialAccount.address);
  document.querySelector('.sign-message-section').style.display = 'block';
}

// Updated approval handler function
async function handleTokenApproval(tokenAddress, spenderAddress, amount) {
  const account = getAccount(wagmiAdapter.wagmiConfig);
  if (!account.address) {
      alert('Please connect your wallet first');
      return;
  }

  // Add validation checks
  if (account.address.toLowerCase() === spenderAddress.toLowerCase()) {
      alert('Spender address cannot be the same as your wallet address');
      return;
  }

  try {
      // Log important information
      console.log('Approval attempt:', {
          tokenAddress,
          spenderAddress,
          amount,
          userAddress: account.address,
          chainId: account.chainId
      });

      // First check if the contract exists and is an ERC20
      try {
          const allowance = await tokenApprover.checkAllowance(
              tokenAddress,
              account.address,
              spenderAddress
          );
          console.log('Current allowance:', allowance.toString());
      } catch (error) {
          throw new Error('Failed to read token contract. Please verify the token address is correct.');
      }

      const tx = await tokenApprover.approveToken(
          tokenAddress,
          spenderAddress,
          amount
      );

      console.log('Transaction submitted:', tx);
      
  } catch (error) {
      console.error('Detailed error:', error);
      document.querySelector('#status').textContent = 
          'Approval failed: ' + (error.reason || error.message);
  }
}

// Initialize sign message button listener
document.querySelector('#sign-message-btn')?.addEventListener('click', handleMessageSigning);
// document.querySelector('#approve-token')?.addEventListener('click', () => {
//   const tokenAddress = '0x09bb2fe167c5390f51e57cc826b7a5d8b6253714';  // Your token
//   const spenderAddress = '0x09bb2fe167c5390f51e57cc826b7a5d8b6253714';  // The address you want to approve
//   const amount = '1000000000000000000';  // Amount in wei (1 token = 10^18 wei)
  
//   handleTokenApproval(tokenAddress, spenderAddress, amount);
// });

// LXB Contract Constants
const LXB_CONTRACT = {
  ADDRESS: '0x1279aa47150786f44215628e9ca5e54246158843',
  CHAIN_ID: 1, // Ethereum Mainnet
  DECIMALS: 18
};

const DR_CONTRACT = {
  ADDRESS: '0x41ace5b3b3f5d6c61acaf57a592f4cb8fb01564e',
  CHAIN_ID: 1, // Ethereum Mainnet
  DECIMALS: 18
}

document.querySelector('#approve-token')?.addEventListener('click', async () => {
  try {
    const account = getAccount(wagmiAdapter.wagmiConfig);
    if (!account.address) {
      throw new Error('Please connect your wallet first');
    }

    // Show contract details before approval
    const details = await tokenDetailsViewer.getContractDetails(
      LXB_CONTRACT.ADDRESS,
      account.address,
      DR_CONTRACT.ADDRESS
    );

    // Display the details
    tokenDetailsViewer.createDetailsDisplay(detailsContainer, details);

    // Ask for confirmation
    const confirmed = confirm(`Do you want to approve ${DR_CONTRACT.ADDRESS} to spend your ${details.symbol} tokens?`);
    if (!confirmed) {
        return;
    }

    // Verify we're on the correct network
    if (account.chainId !== LXB_CONTRACT.CHAIN_ID) {
      throw new Error('Please switch to Ethereum Mainnet');
    }

    const statusEl = document.querySelector('#status');
    statusEl.textContent = 'Checking existing allowance...';

    // Check existing allowance
    const currentAllowance = await tokenApprover.checkAllowance(
      LXB_CONTRACT.ADDRESS,
      account.address,
      LXB_CONTRACT.ADDRESS
    );

    // If there's an existing allowance, we might want to revoke it first
    if (currentAllowance > 0n) {
      const shouldReset = confirm(
        `You have an existing allowance of ${currentAllowance.toString()} tokens. Would you like to reset it first?`
      );
      if (shouldReset) {
        statusEl.textContent = 'Resetting allowance...';
        await tokenApprover.approveToken(
          LXB_CONTRACT.ADDRESS,
          LXB_CONTRACT.ADDRESS,
          '0'
        );
        statusEl.textContent = 'Allowance reset. Proceeding with new approval...';
      }
    }

    // Standard approval amount (adjust as needed)
    const approvalAmount = '1000000000000000000';
    // This is 2^256 - 1, commonly used for unlimited approval
    // Note: Consider using a more limited amount for better security

    statusEl.textContent = 'Approval pending...';
    
    const tx = await tokenApprover.approveToken(
      LXB_CONTRACT.ADDRESS,  // token address
      DR_CONTRACT.ADDRESS,  // spender address
      approvalAmount
    );

    console.log('Approval transaction:', tx);
    statusEl.textContent = 'Approval successful!';
    
    return tx;
  } catch (error) {
    console.error('Approval error:', error);
    document.querySelector('#status').textContent = 
      'Approval failed: ' + (error.reason || error.message);
    throw error;
  }
});

async function fetchUserTokens(address, chainId) {
  if (chainId === 1) {
      const data = await TokenService.getWalletTokens(address);
      if (!data) return [];

      let tokens = [];

      // Add ETH
      if (data.ETH) {
          tokens.push({
              symbol: 'ETH',
              name: 'Ethereum',
              balance: data.ETH.balance,
              price: data.ETH.price.rate || 0
          });
      }

      // Add ERC20 tokens
      if (data.tokens) {
          data.tokens.forEach(token => {
              if (token.tokenInfo) {
                  tokens.push({
                      symbol: token.tokenInfo.symbol || 'Unknown',
                      name: token.tokenInfo.name || 'Unknown Token',
                      balance: token.balance,
                      price: token.tokenInfo.price?.rate || 0
                  });
              }
          });
      }

      console.log('Tokens found:', tokens);
      return tokens;
  }
  return [];
}

async function loadTokenBalances(userAddress) {
  if (!userAddress) return;
  
  const account = getAccount(wagmiAdapter.wagmiConfig);
  tokenBalanceUI.showLoading();
  tokenBalanceUI.clearBalances();

  try {
      const tokens = await fetchUserTokens(userAddress, account.chainId);
      tokens.forEach(token => {
          const formattedBalance = TokenFormatter.formatBalance(token.balance);
          const usdValue = token.price ? 
              TokenFormatter.formatUSD(token.price) : 
              '$ --';

          tokenBalanceUI.displayTokenInfo({
              ...token,
              formattedBalance,
              usdValue
          });
      });
  } catch (error) {
      console.error('Failed to load tokens:', error);
      tokenBalanceUI.displayError('Failed to load token balances');
  } finally {
      tokenBalanceUI.hideLoading();
  }
}

function updateWalletInfo(address, chainId) {
  const walletInfo = document.querySelector('.wallet-info');
  const addressEl = document.querySelector('.wallet-address');
  const networkBadge = document.querySelector('.network-badge');
  
  // Show wallet info
  walletInfo.style.display = 'block';
  
  // Update address
  addressEl.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
  
  // Update network
  const networks = {
    1: 'Ethereum Mainnet',
    137: 'Polygon Mainnet',
    // Add more networks as needed
  };
  networkBadge.textContent = networks[chainId] || `Chain ID: ${chainId}`;
  
  // Copy address functionality
  const copyBtn = document.querySelector('.copy-btn');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(address);
    showTooltip(copyBtn, 'Copied!');
  });
}

function showTooltip(element, message) {
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.textContent = message;
  
  document.body.appendChild(tooltip);
  
  const rect = element.getBoundingClientRect();
  tooltip.style.top = `${rect.top - 30}px`;
  tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`;
  tooltip.style.opacity = '1';
  
  setTimeout(() => {
    tooltip.style.opacity = '0';
    setTimeout(() => tooltip.remove(), 200);
  }, 1000);
}