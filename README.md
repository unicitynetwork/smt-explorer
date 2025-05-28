# Unicity Block Explorer

A modern, browser-based block explorer for the Unicity blockchain. Built with vanilla JavaScript and featuring a beautiful dark night sky theme with real-time updates and multi-network support.

## Features

- 🌟 **Real-time Block Data** - View latest blocks and their details
- ⚡ **Auto-refresh** - Automatic polling for new blocks with 1-second intervals (default enabled)
- 🌐 **Multi-Network Support** - Switch between Devnet, Testnet, and Mainnet
- 🔍 **Block Search** - Search for specific blocks by number
- 📄 **Paginated Navigation** - Browse blocks with customizable page sizes (5-100)
- 🔗 **Commitment Details** - View detailed commitment information with authenticator data
- 🔐 **Inclusion Proofs** - Click on Request IDs to view inclusion proofs
- 🏠 **Quick Navigation** - Click "Block Explorer" title to return to frontpage
- 🔗 **URL State Management** - All settings preserved in URL for easy sharing
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile
- 🎨 **Modern UI** - Dark glassmorphism theme with night sky background

## Live Demo

Visit the live demo: [Unicity Block Explorer](https://unicitynetwork.github.io/smt-explorer)

## Network Support

The explorer supports multiple blockchain networks:

- **Devnet**
- **Testnet** (default)
- **Mainnet**

Switch networks using the dropdown selector in the header. Network selection is preserved in the URL.

### Supported RPC Methods

- `get_block_height` - Get current block number
- `get_block` - Retrieve block information
- `get_block_commitments` - Get all commitments in a block
- `get_inclusion_proof` - Get inclusion proof for a request

## Usage

Simply open `index.html` in any modern web browser. The explorer runs entirely client-side with no server requirements.

### Navigation

- **Header Navigation** 
  - **Network Selector** - Switch between Devnet, Testnet, and Mainnet
  - **Block Explorer Title** - Click to return to frontpage from any view
  - **Search Bar** - Enter block number to navigate directly
- **Latest Block Panel** 
  - Shows current block height with manual refresh button
  - **Auto-refresh Checkbox** - Toggle automatic polling (enabled by default)
- **Blocks List** - Paginated view of recent blocks with commitment indicators
- **Block Details** - Click any block to view detailed information
- **Inclusion Proofs** - Click Request IDs in commitments to view proofs

### Auto-refresh Behavior

- **Main View**: Auto-refresh polls every second and updates the display when new blocks are found
- **Block Details**: Auto-refresh is paused to avoid disrupting detailed examination
- **Inclusion Proof Modal**: Auto-refresh is paused while viewing proofs
- Setting is preserved in URL (`?autoRefresh=false` when disabled)

### Visual Indicators

- 🟢 **Green badges** - Blocks with commitments
- 🔴 **Red badges** - Empty blocks
- 🔵 **Blue text** - Clickable elements (Request IDs, Block Explorer title)
- ✅ **Checkbox** - Auto-refresh status indicator

### URL Parameters

All application state is preserved in URLs for easy sharing:

- `?network=devnet|testnet|mainnet` - Selected network (testnet is default)
- `?page=N` - Current page number
- `?pageSize=5|10|25|50|100` - Number of blocks per page
- `?block=N` - Viewing specific block details
- `?proof=ID` - Viewing inclusion proof modal
- `?autoRefresh=false` - Auto-refresh disabled (enabled by default)

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Styling**: Custom CSS with glassmorphism effects
- **API**: JSON-RPC 2.0 over HTTPS
- **No dependencies** - Pure vanilla implementation

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Any modern browser with ES6+ support

## License

MIT License - see LICENSE file for details