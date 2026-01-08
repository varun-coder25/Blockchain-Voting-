// ===================================
// CONFIGURATION
// ===================================

// ⚠️ IMPORTANT: Replace these placeholders with your actual contract details
const CONTRACT_ADDRESS = '0x5B6d1c1bbDE708f693107DEAc408F9820d7Ae5d0'; // Deployed on Sepolia testnet
const CONTRACT_ABI = [
    // Replace this entire array with your contract ABI
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_name",
                "type": "string"
            }
        ],
        "name": "addCandidate",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "admin",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "candidates",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            },
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "uint256",
                "name": "voteCount",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "candidatesCount",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_id",
                "type": "uint256"
            }
        ],
        "name": "getCandidate",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "hasVoted",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_candidateId",
                "type": "uint256"
            }
        ],
        "name": "vote",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]; // Replace with your actual ABI

const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in decimal
const SEPOLIA_NETWORK_NAME = 'Sepolia Test Network';

// ===================================
// STATE MANAGEMENT
// ===================================

let provider = null;
let signer = null;
let contract = null;
let userAddress = null;
let votingChart = null;

// Candidate colors for chart visualization
const CANDIDATE_COLORS = [
    'rgba(102, 126, 234, 0.8)',  // Purple
    'rgba(245, 87, 108, 0.8)',   // Pink
    'rgba(79, 172, 254, 0.8)',   // Cyan
    'rgba(67, 233, 123, 0.8)'    // Green
];

// ===================================
// DOM ELEMENTS
// ===================================

const elements = {
    connectWallet: document.getElementById('connectWallet'),
    walletInfo: document.getElementById('walletInfo'),
    walletAddress: document.getElementById('walletAddress'),
    votingStatus: document.getElementById('votingStatus'),
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    retryButton: document.getElementById('retryButton'),
    votingSection: document.getElementById('votingSection'),
    resultsSection: document.getElementById('resultsSection'),
    candidatesGrid: document.getElementById('candidatesGrid'),
    statsGrid: document.getElementById('statsGrid'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
};

// ===================================
// INITIALIZATION
// ===================================

// Check for MetaMask on page load
window.addEventListener('load', async () => {
    if (typeof window.ethereum !== 'undefined') {
        console.log('MetaMask detected');

        // Check if already connected
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        } else {
            hideLoading();
        }

        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);

        // Listen for chain changes
        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
    } else {
        showError('MetaMask is not installed. Please install MetaMask to use this application.');
    }
});

// ===================================
// WALLET CONNECTION
// ===================================

elements.connectWallet.addEventListener('click', connectWallet);
elements.retryButton.addEventListener('click', connectWallet);

async function connectWallet() {
    try {
        showLoading();
        hideError();

        // Request account access
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        userAddress = accounts[0];

        // Initialize ethers provider and signer
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        // Check network
        const network = await provider.getNetwork();
        if (network.chainId.toString() !== parseInt(SEPOLIA_CHAIN_ID, 16).toString()) {
            await switchToSepolia();
        }

        // Initialize contract
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        // Update UI
        updateWalletUI();

        // Load voting data
        await loadVotingData();

        hideLoading();
        showToast('Wallet connected successfully!');

    } catch (error) {
        console.error('Connection error:', error);
        hideLoading();

        if (error.code === 4001) {
            showError('Connection rejected. Please approve the connection request.');
        } else {
            showError(`Failed to connect: ${error.message}`);
        }
    }
}

async function switchToSepolia() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
    } catch (error) {
        // This error code indicates that the chain has not been added to MetaMask
        if (error.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: SEPOLIA_CHAIN_ID,
                        chainName: SEPOLIA_NETWORK_NAME,
                        rpcUrls: ['https://sepolia.infura.io/v3/'],
                        nativeCurrency: {
                            name: 'SepoliaETH',
                            symbol: 'ETH',
                            decimals: 18
                        },
                        blockExplorerUrls: ['https://sepolia.etherscan.io']
                    }]
                });
            } catch (addError) {
                throw new Error('Failed to add Sepolia network');
            }
        } else {
            throw error;
        }
    }
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // User disconnected wallet
        resetApp();
    } else if (accounts[0] !== userAddress) {
        // User switched accounts
        window.location.reload();
    }
}

function updateWalletUI() {
    // Hide connect button, show wallet info
    elements.connectWallet.classList.add('hidden');
    elements.walletInfo.classList.remove('hidden');

    // Display truncated address
    const truncated = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
    elements.walletAddress.textContent = truncated;
}

// ===================================
// VOTING DATA MANAGEMENT
// ===================================

async function loadVotingData() {
    try {
        // Check if user has voted
        const hasVoted = await contract.hasVoted(userAddress);

        // Update voting status
        elements.votingStatus.textContent = hasVoted ? '✅ You have voted' : '⏳ Not voted yet';
        elements.votingStatus.className = hasVoted ? 'voting-status voted' : 'voting-status not-voted';

        // Get candidates count
        const candidatesCount = await contract.candidatesCount();

        // Load all candidates
        const candidates = [];
        for (let i = 1; i <= candidatesCount; i++) {
            const [name, voteCount] = await contract.getCandidate(i);
            candidates.push({
                id: i,
                name: name,
                voteCount: Number(voteCount)
            });
        }

        // Render candidates
        renderCandidates(candidates, hasVoted);

        // Render chart
        renderChart(candidates);

        // Render stats
        renderStats(candidates);

        // Show sections
        elements.votingSection.classList.remove('hidden');
        elements.resultsSection.classList.remove('hidden');

    } catch (error) {
        console.error('Error loading voting data:', error);
        showError('Failed to load voting data. Please check your contract address and ABI.');
    }
}

function renderCandidates(candidates, hasVoted) {
    elements.candidatesGrid.innerHTML = '';

    candidates.forEach((candidate, index) => {
        const card = document.createElement('div');
        card.className = 'candidate-card';

        // Get first letter for avatar
        const initial = candidate.name.charAt(0).toUpperCase();

        // Assign gradient based on index
        const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
        ];

        card.innerHTML = `
            <div class="candidate-header">
                <div class="candidate-avatar" style="background: ${gradients[index % 4]}">
                    ${initial}
                </div>
                <div class="candidate-info">
                    <div class="candidate-name">${candidate.name}</div>
                    <div class="candidate-id">Candidate #${candidate.id}</div>
                </div>
            </div>
            <div class="candidate-votes">
                <span class="vote-count">${candidate.voteCount}</span>
                <span class="vote-label">Votes</span>
            </div>
            <button 
                class="btn btn-vote" 
                onclick="vote(${candidate.id})"
                ${hasVoted ? 'disabled' : ''}
            >
                <span class="btn-icon">${hasVoted ? '✓' : '🗳️'}</span>
                ${hasVoted ? 'Voted' : 'Vote Now'}
            </button>
        `;

        elements.candidatesGrid.appendChild(card);
    });
}

function renderChart(candidates) {
    const ctx = document.getElementById('votingChart').getContext('2d');

    // Destroy existing chart if it exists
    if (votingChart) {
        votingChart.destroy();
    }

    const labels = candidates.map(c => c.name);
    const data = candidates.map(c => c.voteCount);
    const colors = candidates.map((_, i) => CANDIDATE_COLORS[i % CANDIDATE_COLORS.length]);

    votingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Votes',
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.8', '1')),
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 14, 39, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(102, 126, 234, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return `Votes: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#a0aec0',
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    }
                },
                x: {
                    ticks: {
                        color: '#a0aec0'
                    },
                    grid: {
                        display: false
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function renderStats(candidates) {
    const totalVotes = candidates.reduce((sum, c) => sum + c.voteCount, 0);
    const leader = candidates.reduce((max, c) => c.voteCount > max.voteCount ? c : max, candidates[0]);

    elements.statsGrid.innerHTML = `
        <div class="stat-card">
            <span class="stat-value">${totalVotes}</span>
            <span class="stat-label">Total Votes</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${candidates.length}</span>
            <span class="stat-label">Candidates</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${leader.name.split('.')[0]}</span>
            <span class="stat-label">Current Leader</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${leader.voteCount}</span>
            <span class="stat-label">Leading Votes</span>
        </div>
    `;
}

// ===================================
// VOTING FUNCTIONALITY
// ===================================

async function vote(candidateId) {
    try {
        showToast('Submitting your vote...');

        // Call vote function on contract
        const tx = await contract.vote(candidateId);

        showToast('Transaction submitted. Waiting for confirmation...');

        // Wait for transaction confirmation
        await tx.wait();

        showToast('Vote recorded successfully! 🎉');

        // Reload voting data to update UI
        await loadVotingData();

    } catch (error) {
        console.error('Voting error:', error);

        if (error.code === 4001) {
            showToast('Transaction rejected by user');
        } else if (error.message.includes('Already voted')) {
            showToast('You have already voted!');
        } else {
            showToast(`Voting failed: ${error.message}`);
        }
    }
}

// ===================================
// UI HELPERS
// ===================================

function showLoading() {
    elements.loadingState.classList.remove('hidden');
    elements.errorState.classList.add('hidden');
    elements.votingSection.classList.add('hidden');
    elements.resultsSection.classList.add('hidden');
}

function hideLoading() {
    elements.loadingState.classList.add('hidden');
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorState.classList.remove('hidden');
    elements.loadingState.classList.add('hidden');
}

function hideError() {
    elements.errorState.classList.add('hidden');
}

function showToast(message) {
    elements.toastMessage.textContent = message;
    elements.toast.classList.remove('hidden');

    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

function resetApp() {
    provider = null;
    signer = null;
    contract = null;
    userAddress = null;

    elements.connectWallet.classList.remove('hidden');
    elements.walletInfo.classList.add('hidden');
    elements.votingSection.classList.add('hidden');
    elements.resultsSection.classList.add('hidden');

    showToast('Wallet disconnected');
}

// ===================================
// VALIDATION
// ===================================

// Warn if placeholders are still in use
if (CONTRACT_ADDRESS === '0x5B6d1c1bbDE708f693107DEAc408F9820d7Ae5d0') {
    console.warn('⚠️ WARNING: Please replace CONTRACT_ADDRESS with your actual deployed contract address');
}

if (CONTRACT_ABI.length === 8 && CONTRACT_ABI[0].type === 'constructor') {
    console.log('✅ Contract ABI is configured');
} else {
    console.warn('⚠️ WARNING: Please verify your CONTRACT_ABI is correct');
}
