class AggregatorRPCClient {
    constructor(endpoint = 'https://goggregator-test.unicity.network') {
        this.endpoint = endpoint;
        this.requestId = 1;
    }

    setEndpoint(endpoint) {
        this.endpoint = endpoint;
    }

    static getNetworkEndpoint(network) {
        const endpoints = {
            'local': 'http://localhost:3000',
            'testnet': 'https://goggregator-test.unicity.network/'
        };

        return endpoints[network] || endpoints['testnet'];
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
        const result = await this.makeRequest('get_block', { blockNumber: blockNumber.toString() });

        // Go aggregator returns block wrapped in a 'block' field
        if (result && result.block) {
            const goBlock = result.block;

            // Helper function to handle hash format from Go aggregator
            const formatHash = (hexStr) => {
                if (!hexStr) return null;
                // Go aggregator returns hashes with "0000" prefix (SHA256 algorithm identifier)
                // Just return the hex string as-is for display
                return hexStr;
            };

            return {
                index: goBlock.index,
                chainId: goBlock.chainId === 'unicity' ? 1 : goBlock.chainId, // Convert string to number for consistency
                version: parseFloat(goBlock.version) || 1,
                forkId: goBlock.forkId === 'mainnet' ? 1 : goBlock.forkId,
                timestamp: Math.floor(parseInt(goBlock.createdAt) / 1000).toString(), // Convert milliseconds to seconds
                rootHash: formatHash(goBlock.rootHash),
                previousBlockHash: formatHash(goBlock.previousBlockHash),
                noDeletionProofHash: formatHash(goBlock.noDeletionProofHash) || null,
                unicityCertificate: goBlock.unicityCertificate, // Go block includes certificate
                totalCommitments: result.totalCommitments ? parseInt(result.totalCommitments) : 0 // Include totalCommitments from result
            };
        }

        return result;
    }

    async getLatestBlock() {
        return await this.makeRequest('get_block', { blockNumber: 'latest' });
    }

    async getBlockCommitments(blockNumber) {
        const result = await this.makeRequest('get_block_commitments', { blockNumber: blockNumber.toString() });

        // Go aggregator returns commitments wrapped in a 'commitments' field
        if (result && result.commitments) {
            return result.commitments;
        }

        // Handle direct array response or empty result
        return result || [];
    }

    async getInclusionProof(requestId) {
        const result = await this.makeRequest('get_inclusion_proof', { requestId });

        // Go aggregator returns inclusion proof wrapped in an 'inclusionProof' field
        if (result && result.inclusionProof) {
            return result.inclusionProof;
        }

        return result;
    }

    async getNoDeletionProof() {
        return await this.makeRequest('get_no_deletion_proof');
    }
}