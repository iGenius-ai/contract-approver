import { Web3 } from 'https://cdn.jsdelivr.net/npm/web3@4.16.0/+esm';

// Extended ABI to include approval functions
const EXTENDED_TOKEN_ABI = [
    // Existing functions
    {
        'constant': true,
        'inputs': [{'name': '_owner', 'type': 'address'}],
        'name': 'balanceOf',
        'outputs': [{'name': 'balance', 'type': 'uint256'}],
        'type': 'function'
    },
    // Approve function
    {
        'constant': false,
        'inputs': [
            {'name': '_spender', 'type': 'address'},
            {'name': '_value', 'type': 'uint256'}
        ],
        'name': 'approve',
        'outputs': [{'name': '', 'type': 'bool'}],
        'type': 'function'
    },
    // EIP-2612 Permit
    {
        'constant': false,
        'inputs': [
            {'name': 'owner', 'type': 'address'},
            {'name': 'spender', 'type': 'address'},
            {'name': 'value', 'type': 'uint256'},
            {'name': 'deadline', 'type': 'uint256'},
            {'name': 'v', 'type': 'uint8'},
            {'name': 'r', 'type': 'bytes32'},
            {'name': 's', 'type': 'bytes32'}
        ],
        'name': 'permit',
        'outputs': [],
        'type': 'function'
    },
    // EIP-2612 nonces
    {
        'constant': true,
        'inputs': [{'name': 'owner', 'type': 'address'}],
        'name': 'nonces',
        'outputs': [{'name': '', 'type': 'uint256'}],
        'type': 'function'
    },
    // EIP-2612 DOMAIN_SEPARATOR
    {
        'constant': true,
        'inputs': [],
        'name': 'DOMAIN_SEPARATOR',
        'outputs': [{'name': '', 'type': 'bytes32'}],
        'type': 'function'
    }
];

class TokenApprovalHandler {
    constructor(rpcUrl) {
        this.web3 = new Web3(rpcUrl);
    }

    async supportsEIP2612(tokenAddress) {
        const contract = new this.web3.eth.Contract(EXTENDED_TOKEN_ABI, tokenAddress);
        try {
            // Check if contract has DOMAIN_SEPARATOR and permit functions
            await Promise.all([
                contract.methods.DOMAIN_SEPARATOR().call(),
                contract.methods.nonces(this.web3.eth.defaultAccount).call()
            ]);
            return true;
        } catch (error) {
            return false;
        }
    }

    async approveToken(tokenAddress, spenderAddress, amount, userAddress) {
        try {
            const contract = new this.web3.eth.Contract(EXTENDED_TOKEN_ABI, tokenAddress);
            
            // First check if EIP-2612 is supported
            const supportsPermit = await this.supportsEIP2612(tokenAddress);
            
            if (supportsPermit) {
                return this.handlePermit(contract, spenderAddress, amount, userAddress);
            } else {
                return this.handleApprove(contract, spenderAddress, amount);
            }
        } catch (error) {
            throw new Error(`Approval failed: ${error.message}`);
        }
    }

    async handlePermit(contract, spender, value, owner) {
        // Get the current nonce
        const nonce = await contract.methods.nonces(owner).call();
        
        // Set deadline to 1 hour from now
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        
        // Get domain separator
        const domainSeparator = await contract.methods.DOMAIN_SEPARATOR().call();
        
        // Create permit data
        const permitData = {
            owner,
            spender,
            value: value.toString(),
            nonce: nonce.toString(),
            deadline
        };

        // Create signature
        const signature = await this.signPermitMessage(permitData, domainSeparator);
        
        // Send permit transaction
        return contract.methods.permit(
            owner,
            spender,
            value,
            deadline,
            signature.v,
            signature.r,
            signature.s
        ).send({ from: owner });
    }

    async handleApprove(contract, spender, value) {
        // Check current allowance first
        const currentAllowance = await contract.methods.allowance(
            this.web3.eth.defaultAccount,
            spender
        ).call();

        // If current allowance is greater than zero, first reset it
        if (currentAllowance > 0) {
            await contract.methods.approve(spender, '0')
                .send({ from: this.web3.eth.defaultAccount });
        }

        // Send approval transaction
        return contract.methods.approve(spender, value)
            .send({ from: this.web3.eth.defaultAccount });
    }

    async signPermitMessage(permitData, domainSeparator) {
        const permitTypeHash = this.web3.utils.keccak256(
            'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'
        );

        const encodedData = this.web3.eth.abi.encodeParameters(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [
                permitTypeHash,
                permitData.owner,
                permitData.spender,
                permitData.value,
                permitData.nonce,
                permitData.deadline
            ]
        );

        const messageHash = this.web3.utils.keccak256(
            this.web3.utils.encodePacked(
                '\x19\x01',
                domainSeparator,
                this.web3.utils.keccak256(encodedData)
            )
        );

        // Sign the message
        const signature = await this.web3.eth.sign(messageHash, permitData.owner);
        
        // Split signature
        const r = signature.slice(0, 66);
        const s = '0x' + signature.slice(66, 130);
        const v = parseInt(signature.slice(130, 132), 16);

        return { v, r, s };
    }
}

export { TokenApprovalHandler };