# MetaMask 和钱包限制

本文档记录 MetaMask 和其他钱包的已知限制和行为。

## 🚫 限制列表

### 1. **无法编程断开连接**

**问题**：网站无法通过代码请求断开 MetaMask 的连接权限。

**影响**：
- SDK 的 `disconnect()` 方法只能清理内部状态
- 用户仍然在 MetaMask 的 "Connected Sites" 列表中看到该网站
- 下次用户访问网站时，MetaMask 仍然会自动连接

**解决方案**：
- 用户必须手动在 MetaMask 中断开：
  1. 打开 MetaMask
  2. 点击右上角三个点 → "Connected sites"
  3. 找到网站并点击 "Disconnect"

**替代方案**：
- SDK 清理内部状态后，不再发起任何钱包请求
- 提示用户手动断开连接

---

### 2. **无法检测切换到未连接账户**

**问题**：当用户在 MetaMask 中切换到未连接的账户时，不会触发任何事件。

**原因**：`eth_accounts` 和 `accountsChanged` 只返回**已授权**的账户列表。

**影响**：
- SDK 无法自动检测用户切换到新账户
- 网站仍然显示旧账户

**解决方案**：
- 建议用户先手动断开连接
- 切换到新账户后
- 重新点击"Connect"按钮
- MetaMask 会请求新账户的授权

---

### 3. **账户列表限制**

**问题**：MetaMask 只返回当前选中的一个账户，无法获取所有已连接的账户列表。

**影响**：
- 无法在界面中显示所有已授权的账户
- 用户必须在 MetaMask 中切换账户

**历史**：早期 MetaMask 会返回所有账户，但出于隐私考虑，现在只返回当前选中的账户。

---

### 4. **链切换限制**

**问题**：只能切换到 MetaMask 已知的链，无法切换到完全自定义的链。

**解决方案**：
- 使用 `wallet_addEthereumChain` 先添加链
- 然后使用 `wallet_switchEthereumChain` 切换

---

## ✅ 支持的功能

1. ✅ 连接钱包（`eth_requestAccounts`）
2. ✅ 在已连接账户之间切换（自动检测）
3. ✅ 切换链（`wallet_switchEthereumChain`）
4. ✅ 添加链（`wallet_addEthereumChain`）
5. ✅ 签名消息（`personal_sign`, `eth_signTypedData_v4`）
6. ✅ 发送交易（`eth_sendTransaction`）
7. ✅ 读取合约（`eth_call`）
8. ✅ 写入合约（`eth_sendTransaction`）

---

## 📚 参考资料

- [MetaMask 文档 - Ethereum Provider API](https://docs.metamask.io/wallet/reference/provider-api/)
- [EIP-1193: Ethereum Provider JavaScript API](https://eips.ethereum.org/EIPS/eip-1193)
- [MetaMask 隐私改进公告](https://medium.com/metamask/breaking-change-no-longer-exposing-user-accounts-to-dapps-by-default-4860c4c7d15b)


