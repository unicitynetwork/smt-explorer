# Unicity Block Explorer

A modern, browser-based block explorer for the Unicity blockchain. Built with vanilla JavaScript and featuring a beautiful dark night sky theme.

## Features

- 🌟 **Real-time Block Data** - View latest blocks and their details
- 🔍 **Block Search** - Search for specific blocks by number
- 📄 **Paginated Navigation** - Browse blocks with customizable page sizes (5-100)
- 🔗 **Commitment Details** - View detailed commitment information with authenticator data
- 🔐 **Inclusion Proofs** - Click on Request IDs to view inclusion proofs
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile
- 🎨 **Modern UI** - Dark glassmorphism theme with night sky background

## Live Demo

Visit the live demo: [Unicity Block Explorer](https://your-username.github.io/smt-explorer)

## API Integration

The explorer connects to the Unicity blockchain RPC service at:
```
https://aggregator-test.mainnet.alphabill.org
```

### Supported RPC Methods

- `get_block_height` - Get current block number
- `get_block` - Retrieve block information
- `get_block_commitments` - Get all commitments in a block
- `get_inclusion_proof` - Get inclusion proof for a request

## Usage

Simply open `index.html` in any modern web browser. The explorer runs entirely client-side with no server requirements.

### Navigation

- **Latest Block Panel** - Shows current block height with refresh button
- **Blocks List** - Paginated view of recent blocks with commitment indicators
- **Block Details** - Click any block to view detailed information
- **Inclusion Proofs** - Click Request IDs in commitments to view proofs

### Visual Indicators

- 🟢 **Green badges** - Blocks with commitments
- 🔴 **Red badges** - Empty blocks
- 🔵 **Blue text** - Clickable elements (Request IDs)

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