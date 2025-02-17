export const likeConfig = {
    // 要点赞的目标token列表
    targetTokens: [
        '2i4Etu3ZPNwmHvzCiTWyurxMnps2ks9FCvBepfQR8rmL',
        'E8zhEunbvTmPsnQLUe9ZLXufSP4FPZuqCvHKvP38zMZm',
        '28dD2ChQSuthK9fxQmbUZUKp45afkPR2HGjDTNJYyetz',
    ],
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