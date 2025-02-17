# Flipn Auto Like

## 错误处理
- 如果遇到 "InstructionMissing" 错误 (Error Code: 0x64)，请确保在发送交易时包含了正确的8字节指令标识符
- 所有指令标识符定义在 `src/constants/instructions.ts` 文件中

## 开发注意事项
- 调用智能合约时需要提供正确的指令标识符
- 建议使用 Anchor 客户端来构建指令 