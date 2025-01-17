// simplified-token-approve.js
import { writeContract, readContract } from 'https://esm.sh/@wagmi/core@2.x';

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
    }
];

class TokenApprover {
    constructor(wagmiConfig) {
        this.config = wagmiConfig;
    }

    async approveToken(tokenAddress, spenderAddress, amount) {
        try {
            const tx = await writeContract(this.config, {
                address: tokenAddress,
                abi: SIMPLIFIED_ABI,
                functionName: 'approve',
                args: [spenderAddress, amount]
            });
            
            return tx;
        } catch (error) {
            throw new Error(`Approval failed: ${error.message}`);
        }
    }

    async checkAllowance(tokenAddress, ownerAddress, spenderAddress) {
        try {
            const allowance = await readContract(this.config, {
                address: tokenAddress,
                abi: SIMPLIFIED_ABI,
                functionName: 'allowance',
                args: [ownerAddress, spenderAddress]
            });
            return allowance;
        } catch (error) {
            throw new Error(`Failed to check allowance: ${error.message}`);
        }
    }
}

export { TokenApprover };