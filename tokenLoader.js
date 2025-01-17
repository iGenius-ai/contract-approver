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
    static API_KEY = 'EK-iPqth-ABTx7f9-hsuCW';
    static BASE_URL = 'https://api.ethplorer.io';

    static async getWalletTokens(address) {
        try {
            const response = await fetch(
                `${this.BASE_URL}/getAddressInfo/${address}?apiKey=${this.API_KEY}`
            );
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return null;
        }
    }
}

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