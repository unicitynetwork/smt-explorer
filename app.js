class BlockExplorer {
    constructor() {
        this.currentNetwork = 'testnet'; // default
        this.rpcClient = new AggregatorRPCClient();
        this.currentBlock = null;
        this.pageSize = 10;
        this.currentPage = 0;
        this.totalBlocks = 0;
        this.autoRefresh = true; // default to enabled
        this.includeEmpty = true; // default to enabled
        this.pollingInterval = null;
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
        
        // Start polling for new blocks
        this.updatePolling();
        
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
            const newPageSize = parseInt(e.target.value);
            this.adjustPageForNewPageSize(newPageSize);
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

        document.getElementById('blockExplorerTitle').addEventListener('click', () => {
            this.goToFrontpage();
        });

        document.getElementById('networkSelect').addEventListener('change', (e) => {
            this.changeNetwork(e.target.value);
        });

        document.getElementById('autoRefreshCheckbox').addEventListener('change', (e) => {
            this.setAutoRefresh(e.target.checked);
        });

        document.getElementById('includeEmptyCheckbox').addEventListener('change', (e) => {
            this.setIncludeEmpty(e.target.checked);
        });

        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            this.handleURLChange();
        });
    }

    initializeFromURL() {
        const params = new URLSearchParams(window.location.search);
        
        // Set network from URL
        const network = params.get('network');
        if (network && ['devnet', 'testnet', 'mainnet'].includes(network)) {
            this.currentNetwork = network;
            document.getElementById('networkSelect').value = network;
            this.rpcClient.setEndpoint(AggregatorRPCClient.getNetworkEndpoint(network));
        } else {
            // Set default network
            this.rpcClient.setEndpoint(AggregatorRPCClient.getNetworkEndpoint(this.currentNetwork));
        }
        
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

        // Set auto-refresh from URL (default is true)
        const autoRefresh = params.get('autoRefresh');
        if (autoRefresh !== null) {
            this.autoRefresh = autoRefresh === 'true';
            document.getElementById('autoRefreshCheckbox').checked = this.autoRefresh;
        }

        // Set include-empty from URL (default is true)
        const includeEmpty = params.get('includeEmpty');
        if (includeEmpty !== null) {
            this.includeEmpty = includeEmpty === 'true';
            document.getElementById('includeEmptyCheckbox').checked = this.includeEmpty;
        }
        
        // Update button state after setting auto-refresh state
        this.updateRefreshButtonState();
    }

    handleURLChange() {
        const params = new URLSearchParams(window.location.search);
        
        // Handle network change
        const network = params.get('network');
        if (network && ['devnet', 'testnet', 'mainnet'].includes(network) && network !== this.currentNetwork) {
            this.currentNetwork = network;
            document.getElementById('networkSelect').value = network;
            this.rpcClient.setEndpoint(AggregatorRPCClient.getNetworkEndpoint(network));
        }
        
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

        // Handle auto-refresh setting
        const autoRefresh = params.get('autoRefresh');
        if (autoRefresh !== null && autoRefresh !== this.autoRefresh.toString()) {
            this.autoRefresh = autoRefresh === 'true';
            document.getElementById('autoRefreshCheckbox').checked = this.autoRefresh;
            this.updatePolling();
            this.updateRefreshButtonState();
        }

        // Handle include-empty setting
        const includeEmpty = params.get('includeEmpty');
        if (includeEmpty !== null && includeEmpty !== this.includeEmpty.toString()) {
            this.includeEmpty = includeEmpty === 'true';
            document.getElementById('includeEmptyCheckbox').checked = this.includeEmpty;
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
        searchParams.delete('network');
        searchParams.delete('autoRefresh');

        // Always include network in URL (unless it's the default testnet)
        if (this.currentNetwork !== 'testnet') {
            searchParams.set('network', this.currentNetwork);
        }

        // Include autoRefresh in URL only if it's disabled (since true is default)
        if (!this.autoRefresh) {
            searchParams.set('autoRefresh', 'false');
        }

        // Include includeEmpty in URL only if it's disabled (since true is default)
        if (!this.includeEmpty) {
            searchParams.set('includeEmpty', 'false');
        }

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

    showSpinner() {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.classList.remove('hidden');
        }
    }

    hideSpinner() {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.classList.add('hidden');
        }
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
            this.showSpinner();
            const heightResult = await this.rpcClient.getBlockHeight();
            const height = heightResult.blockNumber;
            document.getElementById('currentHeight').textContent = height;
            this.currentBlock = height;
        } catch (error) {
            this.showError(`Failed to load latest block: ${error.message}`);
        } finally {
            this.hideSpinner();
        }
    }

    async loadBlocks() {
        try {
            const heightResult = await this.rpcClient.getBlockHeight();
            const height = parseInt(heightResult.blockNumber);
            this.totalBlocks = height; // blocks start from 1
            
            const container = document.getElementById('blocksContainer');
            
            // Calculate block range for current page
            const startBlock = Math.max(1, height - (this.currentPage * this.pageSize) - (this.pageSize - 1));
            const endBlock = Math.max(1, height - (this.currentPage * this.pageSize));

            // For auto-refresh on first page, check for new blocks and add them smoothly
            if (this.currentPage === 0 && this.autoRefresh) {
                await this.loadBlocksSmooth(container, startBlock, endBlock, height);
            } else {
                // For pagination or manual refresh, clear and rebuild
                container.innerHTML = '';
                await this.loadBlocksComplete(container, startBlock, endBlock);
            }

            this.updatePaginationControls(startBlock, endBlock, height);
            this.updatePaginationURL();

        } catch (error) {
            this.showError(`Failed to load blocks: ${error.message}`);
        } finally {
            this.hideSpinner();
        }
    }

    async loadBlocksComplete(container, startBlock, endBlock) {
        // Load blocks for current page
        const promises = [];
        for (let i = startBlock; i <= endBlock; i++) {
            promises.push(this.loadBlockSummary(i));
        }

        const blocks = await Promise.all(promises);
        
        // Filter blocks based on includeEmpty setting
        const filteredBlocks = blocks.filter(block => 
            this.includeEmpty || !block.isEmpty
        );
        
        // Display filtered blocks (might be empty if all blocks are empty and includeEmpty is false)
        filteredBlocks.reverse().forEach(block => {
            container.innerHTML += block.html;
        });

        // Add click handlers for block details
        container.querySelectorAll('.block-summary').forEach(block => {
            block.addEventListener('click', (e) => {
                const blockNumber = e.target.closest('.block-summary').dataset.blockNumber;
                this.showBlockDetail(blockNumber);
            });
        });
    }

    async loadBlocksSmooth(container, startBlock, endBlock, currentHeight) {
        // Get existing block numbers
        const existingBlocks = Array.from(container.querySelectorAll('.block-summary'))
            .map(el => parseInt(el.dataset.blockNumber))
            .sort((a, b) => b - a); // Sort descending (newest first)
        
        const highestExisting = existingBlocks.length > 0 ? Math.max(...existingBlocks) : 0;
        
        // Find new blocks that need to be added
        const newBlocks = [];
        for (let i = endBlock; i > highestExisting && i >= startBlock; i--) {
            newBlocks.push(i);
        }
        
        // Load and add new blocks to the top
        if (newBlocks.length > 0) {
            const promises = newBlocks.map(blockNum => this.loadBlockSummary(blockNum));
            const blocks = await Promise.all(promises);
            
            // Filter blocks based on includeEmpty setting
            const filteredBlocks = blocks.filter(block => 
                this.includeEmpty || !block.isEmpty
            );
            
            // Add slide-down class to existing blocks to prepare for animation
            const existingBlockElements = container.querySelectorAll('.block-summary');
            existingBlockElements.forEach(block => {
                block.classList.add('block-slide-down');
            });
            
            // Add new blocks to the top with animation in correct order (highest block first)
            for (let i = filteredBlocks.length - 1; i >= 0; i--) {
                const block = filteredBlocks[i];
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = block.html;
                const newBlockEl = tempDiv.firstElementChild;
                
                // Add animation classes
                newBlockEl.classList.add('block-new-appear');
                
                // Insert at the beginning
                container.insertBefore(newBlockEl, container.firstChild);
                
                // Add click handler
                newBlockEl.addEventListener('click', (e) => {
                    const blockNumber = e.target.closest('.block-summary').dataset.blockNumber;
                    this.showBlockDetail(blockNumber);
                });
                
                // Trigger animation after a brief delay
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        newBlockEl.classList.add('visible');
                    });
                });
            }
        }
        
        // Remove excess blocks from the bottom if we exceed the page size
        const allBlocks = container.querySelectorAll('.block-summary');
        if (allBlocks.length > this.pageSize) {
            const blocksToRemove = Array.from(allBlocks).slice(this.pageSize);
            blocksToRemove.forEach(block => {
                block.classList.add('block-fade-out');
                
                setTimeout(() => {
                    if (block.parentNode) {
                        block.remove();
                    }
                }, 300);
            });
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

    adjustPageForNewPageSize(newPageSize) {
        // Calculate the current block range being viewed
        const currentStartBlock = Math.max(1, this.totalBlocks - (this.currentPage * this.pageSize) - (this.pageSize - 1));
        
        // Calculate what page that start block would be on with the new page size
        const blocksFromEnd = this.totalBlocks - currentStartBlock + 1;
        const newCurrentPage = Math.floor((blocksFromEnd - 1) / newPageSize);
        
        this.pageSize = newPageSize;
        this.currentPage = newCurrentPage;
    }

    changeNetwork(network) {
        this.currentNetwork = network;
        this.rpcClient.setEndpoint(AggregatorRPCClient.getNetworkEndpoint(network));
        
        // Reset to first page when changing networks
        this.currentPage = 0;
        
        // Reset current block to trigger proper polling
        this.currentBlock = null;
        
        // Update URL and reload data
        this.updateURL({
            page: this.currentPage,
            pageSize: this.pageSize
        });
        
        this.loadLatestBlock();
        this.loadBlocks();
        
        // Restart polling with new network
        this.updatePolling();
    }

    setAutoRefresh(enabled) {
        this.autoRefresh = enabled;
        this.updatePolling();
        this.updateRefreshButtonState();
        
        // Update URL to reflect the change
        this.updateURL({
            page: this.currentPage,
            pageSize: this.pageSize
        });
    }

    setIncludeEmpty(enabled) {
        this.includeEmpty = enabled;
        
        // Reload blocks with new filter
        this.loadBlocks();
        
        // Update URL to reflect the change
        this.updateURL({
            page: this.currentPage,
            pageSize: this.pageSize
        });
    }

    updateRefreshButtonState() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            if (this.autoRefresh) {
                refreshBtn.disabled = true;
                refreshBtn.style.opacity = '0.5';
                refreshBtn.style.cursor = 'not-allowed';
                refreshBtn.title = 'Disable auto-refresh to enable manual refresh';
                refreshBtn.setAttribute('disabled', 'true');
            } else {
                refreshBtn.disabled = false;
                refreshBtn.style.opacity = '1';
                refreshBtn.style.cursor = 'pointer';
                refreshBtn.title = 'Refresh latest block and blocks list';
                refreshBtn.removeAttribute('disabled');
            }
        }
    }

    updatePolling() {
        // Clear existing interval
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        // Start polling if auto-refresh is enabled
        if (this.autoRefresh) {
            this.pollingInterval = setInterval(() => {
                this.checkForNewBlocks();
            }, 1000); // 1 second interval
        }
    }

    async checkForNewBlocks() {
        try {
            // Only poll if we're in the main blocks view (not block detail or proof view)
            const isInBlockDetailView = !document.getElementById('blockDetail').classList.contains('hidden');
            const isInProofView = document.querySelector('.modal-overlay') !== null;
            
            if (isInBlockDetailView || isInProofView) {
                return; // Don't auto-refresh when viewing block details or proofs
            }
            
            const heightResult = await this.rpcClient.getBlockHeight();
            const newHeight = parseInt(heightResult.blockNumber);
            
            // If we have a new block, update the display
            if (this.currentBlock !== null && newHeight > this.currentBlock) {
                this.showSpinner(); // Show spinner when new blocks are found
                this.currentBlock = newHeight;
                document.getElementById('currentHeight').textContent = newHeight;
                
                // If we're on the first page (latest blocks), refresh the blocks list
                if (this.currentPage === 0) {
                    this.loadBlocks();
                } else {
                    this.hideSpinner(); // Hide spinner if not refreshing blocks list
                }
            } else if (this.currentBlock === null) {
                // First time loading
                this.currentBlock = newHeight;
                document.getElementById('currentHeight').textContent = newHeight;
            }
        } catch (error) {
            // Silently handle polling errors to avoid spam
            console.warn('Polling error:', error.message);
        }
    }

    goToFrontpage() {
        // Reset to default state - latest page with default settings
        this.currentPage = 0;
        this.pageSize = 10;
        document.getElementById('pageSize').value = '10';
        
        // Show the main blocks view
        this.showBlockList();
        this.loadBlocks();
    }

    async loadBlockSummary(blockNumber) {
        try {
            const block = await this.rpcClient.getBlock(blockNumber);
            
            // Optimization: if previousBlockHash equals rootHash, block is definitely empty
            const isDefinitelyEmpty = block.previousBlockHash === block.rootHash;
            
            let commitments = [];
            if (!isDefinitelyEmpty) {
                commitments = await this.rpcClient.getBlockCommitments(blockNumber).catch(() => []);
            }
            
            const timestamp = new Date(parseInt(block.timestamp) * 1000).toLocaleString();
            const commitmentCount = commitments.length;
            const isEmpty = isDefinitelyEmpty || commitmentCount === 0;
            
            const html = `
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
            
            return { html, isEmpty, blockNumber };
        } catch (error) {
            const html = `
                <div class="block-summary error" data-block-number="${blockNumber}">
                    <div class="block-number">Block #${blockNumber}</div>
                    <div class="block-info">Error loading block</div>
                </div>
            `;
            return { html, isEmpty: true, blockNumber };
        }
    }

    async showBlockDetail(blockNumber, updateURL = true) {
        try {
            
            const block = await this.rpcClient.getBlock(blockNumber);
            
            // Optimization: if previousBlockHash equals rootHash, block is definitely empty
            const isDefinitelyEmpty = block.previousBlockHash === block.rootHash;
            
            let commitments = null;
            if (!isDefinitelyEmpty) {
                commitments = await this.rpcClient.getBlockCommitments(blockNumber).catch(() => null);
            } else {
                commitments = [];
            }

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
    // Force update button state after everything is loaded
    setTimeout(() => {
        blockExplorer.updateRefreshButtonState();
    }, 100);
});