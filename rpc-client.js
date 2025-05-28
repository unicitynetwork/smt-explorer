class AlphabillRPCClient {
    constructor(endpoint = 'https://aggregator-test.mainnet.alphabill.org') {
        this.endpoint = endpoint;
        this.requestId = 1;
    }

    async makeRequest(method, params = {}) {
        const request = {
            jsonrpc: '2.0',
            method: method,
            params: params,
            id: this.requestId++
        };

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`RPC error: ${data.error.message || 'Unknown error'}`);
            }

            return data.result;
        } catch (error) {
            console.error('RPC request failed:', error);
            throw error;
        }
    }

    async getBlockHeight() {
        return await this.makeRequest('get_block_height');
    }

    async getBlock(blockNumber) {
        return await this.makeRequest('get_block', { blockNumber: blockNumber.toString() });
    }

    async getLatestBlock() {
        return await this.makeRequest('get_block', { blockNumber: 'latest' });
    }

    async getBlockCommitments(blockNumber) {
        return await this.makeRequest('get_block_commitments', { blockNumber: blockNumber.toString() });
    }

    async getInclusionProof(requestId) {
        return await this.makeRequest('get_inclusion_proof', { requestId });
    }

    async getNoDeletionProof() {
        return await this.makeRequest('get_no_deletion_proof');
    }
}