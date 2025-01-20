const ERC20_ABI = [
    // Basic ERC20 view functions
    {
        'constant': true,
        'inputs': [],
        'name': 'name',
        'outputs': [{'name': '', 'type': 'string'}],
        'type': 'function'
    },
    {
        'constant': true,
        'inputs': [],
        'name': 'symbol',
        'outputs': [{'name': '', 'type': 'string'}],
        'type': 'function'
    },
    {
        'constant': true,
        'inputs': [],
        'name': 'decimals',
        'outputs': [{'name': '', 'type': 'uint8'}],
        'type': 'function'
    },
    {
        'constant': true,
        'inputs': [
            {'name': '_owner', 'type': 'address'},
            {'name': '_spender', 'type': 'address'}
        ],
        'name': 'allowance',
        'outputs': [{'name': '', 'type': 'uint256'}],
        'type': 'function'
    },
    {
        'constant': true,
        'inputs': [{'name': '_owner', 'type': 'address'}],
        'name': 'balanceOf',
        'outputs': [{'name': 'balance', 'type': 'uint256'}],
        'type': 'function'
    }
];

const balanceOfABI = [
    {
      constant: true,
      inputs: [
        {
          name: "_owner",
          type: "address",
        },
      ],
      name: "balanceOf",
      outputs: [
        {
          name: "balance",
          type: "uint256",
        },
      ],
      payable: false,
      stateMutability: "view",
      type: "function",
    },
  ];

const tokenAddresses = [
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //WETH
    "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0", // MATIC
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
    "0xB8c77482e45F1F44dE1745F52C74426C631bDD52", // BNB
    "0x4Fabb145d64652a948d72533023f6E7A623C7C53", // BUSD
    "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", // stETH
    "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", // SHIB
    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", // UNI
    "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", // HEX
    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
    "0x4d224452801ACEd8B2F0aebE155379bb5D594381", // APE
    "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", // LDO
    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", // AAVE
    "0x26D5Bd2dfEDa983ECD6c39899e69DAE6431Dffbb" // ETH
];

class TokenContractDetails {
    constructor(web3Instance) {
        this.web3 = web3Instance;
    }

    async getContractDetails(tokenAddress, walletAddress, spenderAddress) {
        try {            
            const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
            const [
                name,
                symbol,
                decimals,
                allowance,
                balance
            ] = await Promise.all([
                contract.methods.name().call(),
                contract.methods.symbol().call(),
                contract.methods.decimals().call(),
                contract.methods.allowance(walletAddress, spenderAddress).call(),
                contract.methods.balanceOf(walletAddress).call()
            ]);

            // Convert balance and allowance to human-readable format
            const divisor = BigInt(10) ** BigInt(decimals);
            const formattedBalance = (BigInt(balance) / divisor).toString();
            const formattedAllowance = (BigInt(allowance) / divisor).toString();

            return {
                name,
                symbol,
                decimals,
                allowance: formattedAllowance,
                rawAllowance: allowance,
                balance: formattedBalance,
                rawBalance: balance,
                contractAddress: tokenAddress,
                spenderAddress
            };
        } catch (error) {
            throw new Error(`Failed to fetch contract details: ${error.message}`);
        }
    }

    createDetailsDisplay(containerElement, details) {
        containerElement.innerHTML = `
            <div class="contract-details">
                <h4>${details.name} (${details.symbol})</h4>
                <div class="detail-row">
                    <span>Contract Address:</span>
                    <span class="address">${details.contractAddress}</span>
                </div>
                <div class="detail-row">
                    <span>Spender Address:</span>
                    <span class="address">${details.spenderAddress}</span>
                </div>
                <div class="detail-row">
                    <span>Your Balance:</span>
                    <span>${details.balance} ${details.symbol}</span>
                </div>
                <div class="detail-row">
                    <span>Current Allowance:</span>
                    <span>${details.allowance} ${details.symbol}</span>
                </div>
            </div>
        `;
    }
}

class TokenService {
    constructor(web3Instance) {
        this.web3 = web3Instance;
    }

    async getWalletTokens(address) {
        try {
            const result = {
                ETH: {
                    balance: '0',
                    price: { rate: 0 }
                },
                tokens: []
            };

            // Get ETH balance
            const ethBalance = await this.web3.eth.getBalance(address);
            result.ETH.balance = this.web3.utils.fromWei(ethBalance, "ether");

            // Get ERC20 tokens
            for (const tokenAddress of tokenAddresses) {
                try {
                    const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
                    const [name, symbol, decimals, balance] = await Promise.all([
                        contract.methods.name().call(),
                        contract.methods.symbol().call(),
                        contract.methods.decimals().call(),
                        contract.methods.balanceOf(address).call(),
                    ]);

                    if (BigInt(balance) >= BigInt(0)) {
                        let formattedBalance;
                        if (decimals === '18') {
                            formattedBalance = this.web3.utils.fromWei(balance.toString(), "ether");
                        } else {
                            const divisor = BigInt(10) ** BigInt(decimals);
                            const beforeDecimal = BigInt(balance) / divisor;
                            const afterDecimal = BigInt(balance) % divisor;
                            const paddedAfterDecimal = afterDecimal.toString().padStart(Number(decimals), '0');
                            formattedBalance = `${beforeDecimal}.${paddedAfterDecimal}`.replace(/\.?0+$/, "");
                        }

                        result.tokens.push({
                            tokenInfo: {
                                name,
                                symbol,
                                decimals,
                                address: tokenAddress,
                                price: { rate: 0 }
                            },
                            balance: formattedBalance,
                            rawBalance: balance
                        });
                    }
                } catch (error) {
                    console.error(`Error fetching balance for token at ${tokenAddress}:`, error);
                    continue;
                }
            }

            return result;

        } catch (error) {
            console.error('Error in getWalletTokens:', error);
            return null;
        }
    }
}

// class TokenService {
//     constructor(web3Instance) {
//         this.web3 = web3Instance;
//     }

//     static API_KEY = 'EK-iPqth-ABTx7f9-hsuCW';
//     static BASE_URL = 'https://api.ethplorer.io';

//     // static async getWalletTokens(address) {
//     //     try {
//     //         const response = await fetch(
//     //             `${this.BASE_URL}/getAddressInfo/${address}?apiKey=${this.API_KEY}`
//     //         );
//     //         return await response.json();
//     //     } catch (error) {
//     //         console.error('API Error:', error);
//     //         return null;
//     //     }
//     // }
// }

class TokenFormatter {
    static formatBalance(balance, decimals = 18) {
        return (Number(balance) / Math.pow(10, decimals)).toFixed(6);
    }

    static formatUSD(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
}

class TokenBalanceUI {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector);
        this.balanceList = this.container.querySelector('.balance-list');
        this.loadingOverlay = this.container.querySelector('.loading-overlay');
    }

    displayTokenInfo(token) {
        const balanceItem = document.createElement('div');
        balanceItem.className = 'token-balance-item';
        
        balanceItem.innerHTML = `
            <div class="token-info">
                <span class="token-symbol">${token.symbol}</span>
                <span class="token-name">${token.name}</span>
            </div>
            <div class="token-balance">
                <span class="balance-amount">${token.formattedBalance}</span>
                <span class="balance-usd">${token.usdValue}</span>
            </div>
        `;

        this.balanceList.appendChild(balanceItem);
    }

    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    clearBalances() {
        this.balanceList.innerHTML = '';
    }

    displayError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'token-error';
        errorDiv.textContent = message;
        this.balanceList.appendChild(errorDiv);
    }
}

class TokenInfoLoader {
    constructor(rpcUrl) {
        this.web3 = new Web3(rpcUrl);
        this.cache = new Map();
        this.lastRequestTime = 0;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getTokenInfo(tokenAddress, walletAddress, retryCount = 0) {
        const cacheKey = `${tokenAddress}-${walletAddress}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            // Rate limiting - wait at least 1 second between requests
            const timeSinceLastRequest = Date.now() - this.lastRequestTime;
            if (timeSinceLastRequest < 1000) {
                await this.delay(1000 - timeSinceLastRequest);
            }

            const contract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress);
            
            const [balance, name, symbol, decimals] = await Promise.all([
                contract.methods.balanceOf(walletAddress).call(),
                contract.methods.name().call(),
                contract.methods.symbol().call(),
                contract.methods.decimals().call()
            ]);

            const formattedBalance = this.web3.utils.fromWei(balance, 'ether');
            const result = {
                address: tokenAddress,
                name,
                symbol,
                decimals,
                balance: formattedBalance,
                rawBalance: balance
            };

            this.cache.set(cacheKey, result);
            this.lastRequestTime = Date.now();
            return result;

        } catch (error) {
            console.error(`Error loading token info: ${error.message}`);
            
            if (retryCount < 3) { // Limit retries to 3 attempts
                await this.delay(Math.pow(2, retryCount) * 1000);
                return this.getTokenInfo(tokenAddress, walletAddress, retryCount + 1);
            }
            
            throw new Error(error.message);
        }
    }
}

export { TokenInfoLoader, TokenBalanceUI, TokenService, TokenFormatter, TokenContractDetails };