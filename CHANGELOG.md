# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.3] - 2025-01-29

### Changed
- Version bump for npm release

## [1.2.0] - 2025-01-25

### Added
- **Multi-Wallet Support for Tron**: Extended TronLink adapter to support all TronWeb-compatible wallets
  - Now supports TronLink, TokenPocket, and other wallets that provide TronWeb interface
  - Improved wallet detection to check for both `window.tronWeb` and `window.tronLink.tronWeb`
  - Enhanced event listener setup with better fallback mechanisms

### Changed
- **TronLink Adapter**: Renamed to TronWeb adapter internally while maintaining backward compatibility
  - Updated adapter name from "TronLink" to "TronWeb" to reflect broader wallet support
  - Improved error messages to guide users to install any TronWeb-compatible wallet
  - Enhanced event listener setup with polling fallback for wallets without event support

### Technical Details
- Modified `getBrowserProvider()` to prioritize `window.tronWeb` (universal) over `window.tronLink.tronWeb` (TronLink-specific)
- Updated wallet detection logic in `detector.ts` to be more inclusive
- Improved event listener setup with better error handling and polling fallback
- Updated wallet metadata to reflect TronWeb compatibility

## [1.1.6] - 2025-01-25

### Changed
- Version bump for npm release

## [1.1.5] - 2025-01-25

### Changed
- Version bump for npm release

## [1.1.3] - 2025-10-29

### Changed
- **Documentation**: Improved internationalization and code readability
  - Fixed incorrect dates in CHANGELOG.md
  - Translated QUICKSTART.md from Chinese to English
  - Replaced Chinese comments in core files with English
  - Enhanced developer experience for international users

### Technical Details
- Updated MetaMask adapter comments to English
- Updated wallet manager comments to English
- Updated detector comments to English
- Updated chain-info comments to English
- Improved code maintainability and accessibility

## [1.1.2] - 2025-10-29

### Fixed
- **Connection Flow**: Fixed `switchChain` method to work during connection process
  - Removed `ensureConnected()` check from `switchChain` method
  - Allows chain switching during wallet connection without connection state validation
  - Resolves "Wallet metamask is not connected" error during initial connection

### Technical Details
- Modified `switchChain` method to skip connection state validation
- This allows the method to be called during the connection process when wallet state is still `CONNECTING`

## [1.1.1] - 2025-10-29

### Fixed
- **Multi-Wallet Support**: Fixed MetaMask adapter to support all `window.ethereum` wallets, not just MetaMask
  - Removed `isMetaMask` check in `getBrowserProvider()` method
  - Now supports TP Wallet, Trust Wallet, Coinbase Wallet, and other EIP-1193 compatible wallets
  - Updated wallet detection logic to be more inclusive

### Technical Details
- Changed `w.ethereum && w.ethereum.isMetaMask ? w.ethereum : undefined` to `w.ethereum ? w.ethereum : undefined`
- This allows any wallet that implements the EIP-1193 standard to work with the MetaMask adapter

## [1.1.0] - 2024-12-19

### Added
- Enhanced MetaMask adapter with custom RPC node support
- Improved BSC Testnet RPC configuration with multiple fallback nodes
- Better error handling for RPC connection issues

### Changed
- MetaMask adapter now uses configured RPC nodes for read operations instead of MetaMask internal RPC
- Updated BSC Testnet (chainId: 97) RPC nodes to more reliable endpoints
- Separated read and write operations: reads use custom RPC, writes use MetaMask provider

### Fixed
- Resolved "missing trie node" RPC errors by using reliable external RPC nodes
- Improved connection stability for BSC Testnet
- Better fallback mechanism for RPC failures

### Technical Details
- MetaMask adapter's `publicClient` now uses `http(primaryRpcUrl)` instead of `custom(provider)`
- Added multiple BSC Testnet RPC endpoints for better reliability
- Maintained MetaMask provider for signing operations to ensure security

## [1.0.2] - Previous version

### Features
- Initial release with multi-chain wallet support
- EVM and Tron ecosystem support
- MetaMask, TronLink, and WalletConnect integration
