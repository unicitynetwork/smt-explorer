class BlockExplorer {
    constructor() {
        this.rpcClient = new AlphabillRPCClient();
        this.currentBlock = null;
        this.pageSize = 10;
        this.currentPage = 0;
        this.totalBlocks = 0;
        this.init();
    }

    async init() {
        this.bindEvents();
        this.initializeFromURL();
        
        // Check if we need to show a specific view based on URL
        const params = new URLSearchParams(window.location.search);
        const blockNumber = params.get('block');
        const proofRequestId = params.get('proof');
        
        this.loadLatestBlock();
        
        if (blockNumber) {
            // Show specific block
            await this.showBlockDetail(blockNumber, false);
        } else {
            // Show blocks list
            this.loadBlocks();
        }
        
        if (proofRequestId) {
            // Show inclusion proof modal
            const fromBlock = params.get('block');
            await this.showInclusionProof(proofRequestId, false, fromBlock);
        }
    }

    bindEvents() {
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadLatestBlock();
            this.loadBlocks();
        });

        document.getElementById('searchBtn').addEventListener('click', () => {
            this.searchBlock();
        });

        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchBlock();
            }
        });

        document.getElementById('pageSize').addEventListener('change', (e) => {
            this.pageSize = parseInt(e.target.value);
            this.currentPage = 0;
            this.loadBlocks();
        });

        document.getElementById('firstPageBtn').addEventListener('click', () => {
            this.goToFirstPage();
        });

        document.getElementById('prevPageBtn').addEventListener('click', () => {
            this.goToPrevPage();
        });

        document.getElementById('nextPageBtn').addEventListener('click', () => {
            this.goToNextPage();
        });

        document.getElementById('latestPageBtn').addEventListener('click', () => {
            this.goToLatestPage();
        });

        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            this.handleURLChange();
        });
    }

    initializeFromURL() {
        const params = new URLSearchParams(window.location.search);
        
        // Set page size from URL
        const pageSize = params.get('pageSize');
        if (pageSize && [5, 10, 25, 50, 100].includes(parseInt(pageSize))) {
            this.pageSize = parseInt(pageSize);
            document.getElementById('pageSize').value = pageSize;
        }

        // Set current page from URL
        const page = params.get('page');
        if (page && !isNaN(parseInt(page))) {
            this.currentPage = parseInt(page);
        }
    }

    handleURLChange() {
        const params = new URLSearchParams(window.location.search);
        
        // Handle block detail view
        const blockNumber = params.get('block');
        if (blockNumber) {
            this.showBlockDetail(blockNumber, false); // false = don't update URL
            return;
        }

        // Handle inclusion proof
        const proofRequestId = params.get('proof');
        if (proofRequestId) {
            const fromBlock = params.get('block');
            this.showInclusionProof(proofRequestId, false, fromBlock); // false = don't update URL
            return;
        }

        // Handle pagination
        const pageSize = params.get('pageSize');
        const page = params.get('page');
        
        if (pageSize && [5, 10, 25, 50, 100].includes(parseInt(pageSize))) {
            this.pageSize = parseInt(pageSize);
            document.getElementById('pageSize').value = pageSize;
        }
        
        if (page && !isNaN(parseInt(page))) {
            this.currentPage = parseInt(page);
        }

        // Show main blocks view
        this.showBlockList();
        this.loadBlocks();
    }

    updateURL(params = {}) {
        const url = new URL(window.location);
        const searchParams = url.searchParams;

        // Clear existing params that we manage
        searchParams.delete('block');
        searchParams.delete('proof');
        searchParams.delete('page');
        searchParams.delete('pageSize');

        // Add new params
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                searchParams.set(key, params[key]);
            }
        });

        // Update URL without page reload
        const newURL = url.toString();
        if (newURL !== window.location.href) {
            window.history.pushState({}, '', newURL);
        }
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showError(message) {
        const errorEl = document.getElementById('error');
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
        setTimeout(() => {
            errorEl.classList.add('hidden');
        }, 5000);
    }

    async loadLatestBlock() {
        try {
            this.showLoading();
            const heightResult = await this.rpcClient.getBlockHeight();
            const height = heightResult.blockNumber;
            document.getElementById('currentHeight').textContent = height;
            this.currentBlock = height;
        } catch (error) {
            this.showError(`Failed to load latest block: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async loadBlocks() {
        try {
            this.showLoading();
            const heightResult = await this.rpcClient.getBlockHeight();
            const height = parseInt(heightResult.blockNumber);
            this.totalBlocks = height; // blocks start from 1
            
            const container = document.getElementById('blocksContainer');
            container.innerHTML = '';

            // Calculate block range for current page
            const startBlock = Math.max(1, height - (this.currentPage * this.pageSize) - (this.pageSize - 1));
            const endBlock = Math.max(1, height - (this.currentPage * this.pageSize));

            // Load blocks for current page
            const promises = [];
            for (let i = startBlock; i <= endBlock; i++) {
                promises.push(this.loadBlockSummary(i));
            }

            const blocks = await Promise.all(promises);
            blocks.reverse().forEach(blockHtml => {
                container.innerHTML += blockHtml;
            });

            // Add click handlers for block details
            container.querySelectorAll('.block-summary').forEach(block => {
                block.addEventListener('click', (e) => {
                    const blockNumber = e.target.closest('.block-summary').dataset.blockNumber;
                    this.showBlockDetail(blockNumber);
                });
            });

            this.updatePaginationControls(startBlock, endBlock, height);
            this.updatePaginationURL();

        } catch (error) {
            this.showError(`Failed to load blocks: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    updatePaginationURL() {
        // Only update URL if we're on the main blocks view
        const params = new URLSearchParams(window.location.search);
        if (!params.get('block') && !params.get('proof')) {
            this.updateURL({
                page: this.currentPage,
                pageSize: this.pageSize
            });
        }
    }

    updatePaginationControls(startBlock, endBlock, latestBlock) {
        const blockRange = document.getElementById('blockRange');
        blockRange.textContent = `Blocks ${startBlock} - ${endBlock} (Latest: ${latestBlock})`;

        const firstBtn = document.getElementById('firstPageBtn');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const latestBtn = document.getElementById('latestPageBtn');

        // Disable/enable buttons based on current position
        const maxPages = Math.ceil(this.totalBlocks / this.pageSize);
        const isFirstPage = this.currentPage === 0;
        const isLastPage = startBlock === 1;

        firstBtn.disabled = isLastPage;
        prevBtn.disabled = isLastPage;
        nextBtn.disabled = isFirstPage;
        latestBtn.disabled = isFirstPage;
    }

    goToFirstPage() {
        const maxPages = Math.ceil(this.totalBlocks / this.pageSize);
        this.currentPage = maxPages - 1;
        this.loadBlocks();
    }

    goToPrevPage() {
        if (this.currentPage < Math.ceil(this.totalBlocks / this.pageSize) - 1) {
            this.currentPage++;
            this.loadBlocks();
        }
    }

    goToNextPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.loadBlocks();
        }
    }

    goToLatestPage() {
        this.currentPage = 0;
        this.loadBlocks();
    }

    async loadBlockSummary(blockNumber) {
        try {
            const [block, commitments] = await Promise.all([
                this.rpcClient.getBlock(blockNumber),
                this.rpcClient.getBlockCommitments(blockNumber).catch(() => [])
            ]);
            
            const timestamp = new Date(parseInt(block.timestamp) * 1000).toLocaleString();
            const commitmentCount = commitments.length;
            const isEmpty = commitmentCount === 0;
            
            return `
                <div class="block-summary ${isEmpty ? 'empty-block' : 'has-commitments'}" data-block-number="${blockNumber}">
                    <div class="block-header">
                        <div class="block-number">Block #${blockNumber}</div>
                        <div class="commitment-badge ${isEmpty ? 'empty' : 'has-data'}">
                            ${isEmpty ? 'Empty' : `${commitmentCount} commitment${commitmentCount !== 1 ? 's' : ''}`}
                        </div>
                    </div>
                    <div class="block-info">
                        <div>Timestamp: ${timestamp}</div>
                        <div>Root Hash: ${block.rootHash || 'N/A'}</div>
                    </div>
                </div>
            `;
        } catch (error) {
            return `
                <div class="block-summary error" data-block-number="${blockNumber}">
                    <div class="block-number">Block #${blockNumber}</div>
                    <div class="block-info">Error loading block</div>
                </div>
            `;
        }
    }

    async showBlockDetail(blockNumber, updateURL = true) {
        try {
            this.showLoading();
            
            const [block, commitments] = await Promise.all([
                this.rpcClient.getBlock(blockNumber),
                this.rpcClient.getBlockCommitments(blockNumber).catch(() => null)
            ]);

            const detailSection = document.getElementById('blockDetail');
            const contentEl = document.getElementById('blockDetailContent');
            
            const timestamp = new Date(parseInt(block.timestamp) * 1000).toLocaleString();
            
            contentEl.innerHTML = `
                <div class="block-detail-header">
                    <h3>Block #${blockNumber}</h3>
                    <button id="backBtn">← Back to List</button>
                </div>
                <div class="block-details">
                    <div class="detail-row">
                        <label>Index:</label>
                        <span>${block.index}</span>
                    </div>
                    <div class="detail-row">
                        <label>Chain ID:</label>
                        <span>${block.chainId}</span>
                    </div>
                    <div class="detail-row">
                        <label>Version:</label>
                        <span>${block.version}</span>
                    </div>
                    <div class="detail-row">
                        <label>Fork ID:</label>
                        <span>${block.forkId}</span>
                    </div>
                    <div class="detail-row">
                        <label>Timestamp:</label>
                        <span>${timestamp}</span>
                    </div>
                    <div class="detail-row">
                        <label>Root Hash:</label>
                        <span class="hash">${block.rootHash}</span>
                    </div>
                    <div class="detail-row">
                        <label>Previous Block Hash:</label>
                        <span class="hash">${block.previousBlockHash}</span>
                    </div>
                    ${block.noDeletionProofHash ? `
                        <div class="detail-row">
                            <label>No Deletion Proof Hash:</label>
                            <span class="hash">${block.noDeletionProofHash}</span>
                        </div>
                    ` : ''}
                    ${commitments && commitments.length > 0 ? `
                        <div class="commitments-section">
                            <h4>Commitments (${commitments.length})</h4>
                            <div class="commitments-list">
                                ${commitments.map((commitment, index) => `
                                    <div class="commitment-card">
                                        <div class="commitment-header">
                                            <span class="commitment-index">#${index + 1}</span>
                                            <span class="commitment-id">ID: ${commitment.requestId}</span>
                                        </div>
                                        <div class="commitment-details">
                                            <div class="detail-row">
                                                <label>Request ID:</label>
                                                <span class="hash clickable-hash" data-request-id="${commitment.requestId}" onclick="blockExplorer.showInclusionProofFromBlock('${commitment.requestId}', '${blockNumber}')">${commitment.requestId}</span>
                                            </div>
                                            <div class="detail-row">
                                                <label>Transaction Hash:</label>
                                                <span class="hash">${commitment.transactionHash}</span>
                                            </div>
                                            <div class="detail-row">
                                                <label>Algorithm:</label>
                                                <span>${commitment.authenticator.algorithm}</span>
                                            </div>
                                            <div class="detail-row">
                                                <label>Public Key:</label>
                                                <span class="hash">${commitment.authenticator.publicKey}</span>
                                            </div>
                                            <div class="detail-row">
                                                <label>Signature:</label>
                                                <span class="hash">${commitment.authenticator.signature}</span>
                                            </div>
                                            <div class="detail-row">
                                                <label>State Hash:</label>
                                                <span class="hash">${commitment.authenticator.stateHash}</span>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : '<div class="no-commitments">This block contains no commitments</div>'}
                </div>
            `;

            document.getElementById('backBtn').addEventListener('click', () => {
                this.showBlockList();
            });

            detailSection.classList.remove('hidden');
            document.getElementById('blockList').classList.add('hidden');
            document.getElementById('overview').classList.add('hidden');

            // Update URL with block parameter
            if (updateURL) {
                this.updateURL({ block: blockNumber });
            }

        } catch (error) {
            this.showError(`Failed to load block details: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    showBlockList() {
        document.getElementById('blockDetail').classList.add('hidden');
        document.getElementById('blockList').classList.remove('hidden');
        document.getElementById('overview').classList.remove('hidden');
        
        // Update URL to show blocks view with current pagination
        this.updateURL({
            page: this.currentPage,
            pageSize: this.pageSize
        });
    }

    async searchBlock() {
        const input = document.getElementById('searchInput');
        const blockNumber = input.value.trim();
        
        if (!blockNumber) {
            this.showError('Please enter a block number');
            return;
        }

        if (!/^\d+$/.test(blockNumber)) {
            this.showError('Please enter a valid block number');
            return;
        }

        await this.showBlockDetail(parseInt(blockNumber));
        input.value = '';
    }

    async showInclusionProof(requestId, updateURL = true, fromBlock = null) {
        try {
            this.showLoading();
            const proof = await this.rpcClient.getInclusionProof(requestId);
            
            // Create modal or section to display inclusion proof
            this.displayInclusionProofModal(requestId, proof, fromBlock);
            
            // Update URL with proof parameter
            if (updateURL) {
                const urlParams = { proof: requestId };
                if (fromBlock) {
                    urlParams.block = fromBlock;
                }
                this.updateURL(urlParams);
            }
            
        } catch (error) {
            this.showError(`Failed to load inclusion proof: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async showInclusionProofFromBlock(requestId, blockNumber) {
        await this.showInclusionProof(requestId, true, blockNumber);
    }

    displayInclusionProofModal(requestId, proof, fromBlock = null) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Inclusion Proof</h3>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="proof-request-id">
                        <label>Request ID:</label>
                        <span class="hash">${requestId}</span>
                    </div>
                    <div class="proof-details">
                        <h4>Proof Data</h4>
                        <pre class="proof-json">${JSON.stringify(proof, null, 2)}</pre>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal handlers
        const closeModal = () => {
            modal.remove();
            // Remove proof parameter from URL and go back to previous state
            if (fromBlock) {
                // Return to the block view we came from
                this.updateURL({ block: fromBlock });
            } else {
                // Return to blocks list
                this.updateURL({ page: this.currentPage, pageSize: this.pageSize });
            }
        };

        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
}

// Initialize the block explorer when the page loads
let blockExplorer;
document.addEventListener('DOMContentLoaded', () => {
    blockExplorer = new BlockExplorer();
});