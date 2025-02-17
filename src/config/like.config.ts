import dotenv from 'dotenv';

dotenv.config();

// 从环境变量读取并处理目标列表
const targetTokens = (process.env.TARGET_LIST || '').split(',').filter(token => token.trim());

export const likeConfig = {
    // 从环境变量读取目标token列表
    targetTokens,
    // 延迟配置
    delays: {
        wallet: {
            min: 50,  // 钱包间最小延迟(ms)
            max: 100  // 钱包间最大延迟(ms)
        },
        like: {
            fixed: 100  // 每次点赞的固定延迟(ms)
        }
    }
}; 