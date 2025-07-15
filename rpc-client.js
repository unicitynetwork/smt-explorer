class AggregatorRPCClient {
    constructor(endpoint = 'https://aggregator-test.mainnet.unicity.network', aggregatorType = 'ts') {
        this.endpoint = endpoint;
        this.requestId = 1;
        this.aggregatorType = aggregatorType; // 'ts' or 'go'
    }

    setEndpoint(endpoint, aggregatorType = 'ts') {
        this.endpoint = endpoint;
        this.aggregatorType = aggregatorType;
    }

    static getNetworkEndpoint(network, aggregatorType = 'ts') {
        const endpoints = {
            'ts': {
                'local': 'http://localhost:3000',
                'testnet': 'https://aggregator-test.mainnet.unicity.network/',
                'mainnet': 'https://aggregator.mainnet.unicity.network/'
            },
            'go': {
                'goggregator': 'https://goggregator-test.unicity.network/'
            }
        };
        
        if (aggregatorType === 'go') {
            return endpoints.go.goggregator;
        }
        
        return endpoints.ts[network] || endpoints.ts['testnet'];
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
        
        // Handle different response structures
        if (this.aggregatorType === 'go') {
            // Go aggregator returns block wrapped in a 'block' field
            if (result && result.block) {
                // Normalize the Go block structure to match TS structure
                const goBlock = result.block;
                
                // Helper function to decode double-encoded hex strings
                const decodeDoubleHex = (hexStr) => {
                    if (!hexStr) return null;
                    try {
                        // Convert pairs of hex characters to their ASCII values
                        let decoded = '';
                        for (let i = 0; i < hexStr.length; i += 2) {
                            const hex = hexStr.substr(i, 2);
                            decoded += String.fromCharCode(parseInt(hex, 16));
                        }
                        return decoded;
                    } catch (e) {
                        return hexStr; // Return as-is if decoding fails
                    }
                };
                
                return {
                    index: goBlock.index,
                    chainId: goBlock.chainId === 'unicity' ? 1 : goBlock.chainId, // Convert string to number for consistency
                    version: parseFloat(goBlock.version) || 1,
                    forkId: goBlock.forkId === 'mainnet' ? 1 : goBlock.forkId,
                    timestamp: Math.floor(parseInt(goBlock.createdAt) / 1000).toString(), // Convert milliseconds to seconds
                    rootHash: decodeDoubleHex(goBlock.rootHash),
                    previousBlockHash: decodeDoubleHex(goBlock.previousBlockHash),
                    noDeletionProofHash: decodeDoubleHex(goBlock.noDeletionProofHash) || null,
                    unicityCertificate: goBlock.unicityCertificate // Go block includes certificate
                };
            }
            return result;
        }
        
        // TS aggregator returns block directly
        return result;
    }

    async getLatestBlock() {
        return await this.makeRequest('get_block', { blockNumber: 'latest' });
    }

    async getBlockCommitments(blockNumber) {
        const result = await this.makeRequest('get_block_commitments', { blockNumber: blockNumber.toString() });
        
        // Handle different response structures
        if (this.aggregatorType === 'go') {
            // Go aggregator returns commitments wrapped in a 'commitments' field
            if (result && result.commitments) {
                return result.commitments;
            }
            return [];
        }
        
        // TS aggregator returns commitments directly as an array
        return result || [];
    }

    async getInclusionProof(requestId) {
        return await this.makeRequest('get_inclusion_proof', { requestId });
    }

    async getNoDeletionProof() {
        return await this.makeRequest('get_no_deletion_proof');
    }
}