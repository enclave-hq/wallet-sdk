# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
