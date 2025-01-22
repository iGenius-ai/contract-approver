// approve.js
import { writeContract, readContract, getWalletClient, getPublicClient } from 'https://esm.sh/@wagmi/core@2.x';

const SIMPLIFIED_ABI = [
    {
        'constant': false,
        'inputs': [
            {'name': '_spender', 'type': 'address'},
            {'name': '_value', 'type': 'uint256'}
        ],
        'name': 'approve',
        'outputs': [{'name': 'success', 'type': 'bool'}],
        'type': 'function'
    },
    {
        'constant': true,
        'inputs': [
            {'name': '_owner', 'type': 'address'},
            {'name': '_spender', 'type': 'address'}
        ],
        'name': 'allowance',
        'outputs': [{'name': 'remaining', 'type': 'uint256'}],
        'type': 'function'
    },
    {
        'inputs': [
            {'internalType': 'address', 'name': '_holder', 'type': 'address'},
            {'internalType': 'uint256', 'name': '_amount', 'type': 'uint256'}
        ],
        'name': 'SpendFrom',
        'outputs': [],
        'stateMutability': 'payable',
        'type': 'function'
    }
];

const DR_CONTRACT_ABI = [
    {
        'inputs': [
            {'internalType': 'address', 'name': '_holder', 'type': 'address'},
            {'internalType': 'uint256', 'name': '_amount', 'type': 'uint256'}
        ],
        'name': 'SpendFrom',
        'outputs': [],
        'stateMutability': 'payable',
        'type': 'function'
    }
];

class TokenApprover {
    constructor(wagmiConfig) {
        this.config = wagmiConfig;
    }

    async approveAndSpend(tokenAddress, spenderAddress, amount, approval, holder) {
        try {
            // Get the wallet client first
            const walletClient = await getWalletClient(this.config);
            if (!walletClient) {
                throw new Error('No wallet client found');
            }

            // Get the public client for the current chain
            const publicClient = getPublicClient(this.config);
            if (!publicClient) {
                throw new Error('No public client found');
            }

            // First approve the tokens
            const approveTx = await writeContract(this.config, {
                address: tokenAddress,
                abi: SIMPLIFIED_ABI,
                functionName: 'approve',
                args: [spenderAddress, approval],
            });

            console.log(approveTx);
            
            // Wait for approval transaction to be mined
            await publicClient.waitForTransactionReceipt({ hash: approveTx });

            // Then call SpendFrom
            const spendTx = await writeContract(this.config, {
                address: spenderAddress, // This is the DR_CONTRACT address
                abi: SIMPLIFIED_ABI,
                functionName: 'SpendFrom',
                args: [holder, amount],
            });

            console.log(spendTx);

            return {
                approveTx,
                spendTx
            };
        } catch (error) {
            console.error('Detailed approval and spend error:', error);
            throw new Error(`Approval and spend failed: ${error.message}`);
        }
    }

    async approveToken(tokenAddress, spenderAddress, approval) {
        try {
            // Get the wallet client first
            const walletClient = await getWalletClient(this.config);
            if (!walletClient) {
                throw new Error('No wallet client found');
            }

            // Get the public client for the current chain
            const publicClient = getPublicClient(this.config);
            if (!publicClient) {
                throw new Error('No public client found');
            }

            // First approve the tokens
            const approveTx = await writeContract(this.config, {
                address: tokenAddress,
                abi: SIMPLIFIED_ABI,
                functionName: 'approve',
                args: [spenderAddress, approval],
            });

            console.log(approveTx);
            
            return approveTx;
        } catch (error) {
            console.error('Detailed approval error:', error);
            throw new Error(`Approval failed: ${error.message}`);
        }
    }

    async checkAllowance(tokenAddress, ownerAddress, spenderAddress) {
        try {
            const publicClient = getPublicClient(this.config);
            if (!publicClient) {
                throw new Error('No public client found');
            }

            const allowance = await readContract(this.config, {
                address: tokenAddress,
                abi: SIMPLIFIED_ABI,
                functionName: 'allowance',
                args: [ownerAddress, spenderAddress],
            });
            return allowance;
        } catch (error) {
            throw new Error(`Failed to check allowance: ${error.message}`);
        }
    }
}

export { TokenApprover };