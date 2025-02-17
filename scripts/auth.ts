import { Keypair } from '@solana/web3.js';
import dotenv from 'dotenv';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import axios from 'axios';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.stg.dumpdump.fun/api/v1';
const API_ORIGIN = process.env.API_ORIGIN || 'https://stage.flipn.fun';
const API_REFERER = process.env.API_REFERER || 'https://stage.flipn.fun/';

// 生成签名并获取token的函数
export async function generateSignatureAndGetToken(keypair: Keypair) {
    // 1. 构造消息
    const timestamp = Date.now();
    const message = `login FlipN,time:${timestamp}`;
    const encodedMessage = new TextEncoder().encode(message);

    // 2. 使用nacl生成签名
    const signature = nacl.sign.detached(encodedMessage, keypair.secretKey);
    const signatureBase64 = Buffer.from(signature).toString('base64');

    // 3. 获取钱包地址
    const address = keypair.publicKey.toString();

    // 4. 打印请求详细信息
    console.log('\n=== Request Details ===');
    console.log('Wallet Address:', address);
    console.log('Message:', message);
    console.log('Signature:', signatureBase64);
    console.log('Timestamp:', timestamp);

    // 5. 生成并打印 curl 命令
    console.log('\n=== CURL Command ===');
    console.log(`curl -X GET '${API_BASE_URL}/account/token?address=${encodeURIComponent(address)}&signature=${encodeURIComponent(signatureBase64)}&time=${encodeURIComponent(timestamp)}' \
      -H 'Content-Type: application/json' \
      -H 'Origin: ${API_ORIGIN}' \
      -H 'Referer: ${API_REFERER}'`);

    // 6. 打印 URL 编码后的版本
    console.log('\n=== URL Encoded Version ===');
    const url = `${API_BASE_URL}/account/token?address=${encodeURIComponent(address)}&signature=${encodeURIComponent(signatureBase64)}&time=${encodeURIComponent(timestamp)}`;
    console.log(url);
    console.log();
    
    try {
        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
                'Origin': API_ORIGIN,
                'Referer': API_REFERER
            }
        });
        
        console.log('\n=== Response ===');
        console.log('Token:', response.data.data);
        
        return response.data.data;
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error getting token:', error.message);
        } else if (axios.isAxiosError(error) && error.response) {
            console.error('Error getting token:', error.response.data);
        } else {
            console.error('An unknown error occurred');
        }
        throw error;
    }
}

// 创建 keypair 的工具函数
export function createKeypairFromPrivateKey(base58PrivateKey: string): Keypair {
    try {
        const privateKeyBytes = bs58.decode(base58PrivateKey);
        return Keypair.fromSecretKey(privateKeyBytes);
    } catch (error) {
        console.error('Error creating keypair:', error);
        throw error;
    }
}

// 如果直接运行这个文件，则执行示例代码
if (require.main === module) {
    const base58PrivateKey = process.env.WALLET_PRIVATE_KEY;

    if (!base58PrivateKey) {
        console.error('Error: WALLET_PRIVATE_KEY not found in environment variables');
        process.exit(1);
    }

    try {
        const keypair = createKeypairFromPrivateKey(base58PrivateKey);
        generateSignatureAndGetToken(keypair).catch(console.error);
    } catch (error) {
        console.error('Error processing Solana private key:', error);
        process.exit(1);
    }
}
