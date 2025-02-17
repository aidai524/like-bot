import { Keypair } from '@solana/web3.js';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { generateSignatureAndGetToken } from './auth';
import { likeConfig } from '../src/config/like.config';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.stg.dumpdump.fun/api/v1';
const API_ORIGIN = process.env.API_ORIGIN || 'https://stage.flipn.fun';
const API_REFERER = process.env.API_REFERER || 'https://stage.flipn.fun/';

interface WalletInfo {
  timestamp: string;
  publicKey: string;
  privateKey: string;
}

export class LikeBot {
  private keypair: Keypair;
  private authToken: string | null = null;
  private logStream: fs.WriteStream;
  private readonly logFile: string;
  private readonly walletsFile: string;

  constructor() {
    // 创建 logs 和 wallets 目录
    const logsDir = path.join(process.cwd(), 'logs');
    const walletsDir = path.join(process.cwd(), 'wallets');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.mkdirSync(walletsDir, { recursive: true });

    // 设置日志文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(logsDir, `like-bot-${timestamp}.log`);
    this.walletsFile = path.join(walletsDir, 'wallets.json');
    
    // 创建日志流
    this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });

    // 初始化一个新钱包，但不保存
    this.keypair = Keypair.generate();
    
    this.log('Bot initialized');
  }

  // 生成指定数量的钱包
  generateWallets(count: number): WalletInfo[] {
    const wallets: WalletInfo[] = [];
    
    for (let i = 0; i < count; i++) {
      const keypair = Keypair.generate();
      const walletInfo = {
        timestamp: new Date().toISOString(),
        publicKey: keypair.publicKey.toBase58(),
        privateKey: Buffer.from(keypair.secretKey).toString('base64')
      };
      wallets.push(walletInfo);
      this.log(`Generated wallet ${i + 1}/${count}: ${walletInfo.publicKey}`);
    }

    // 保存所有钱包信息
    this.saveWalletInfoBatch(wallets);

    return wallets;
  }

  private saveWalletInfoBatch(wallets: WalletInfo[]) {
    let existingWallets = [];
    if (fs.existsSync(this.walletsFile)) {
      const content = fs.readFileSync(this.walletsFile, 'utf8');
      existingWallets = content ? JSON.parse(content) : [];
    }

    const allWallets = [...existingWallets, ...wallets];
    fs.writeFileSync(this.walletsFile, JSON.stringify(allWallets, null, 2));
    this.log(`Saved ${wallets.length} new wallets to ${this.walletsFile}`);
  }

  // 设置当前使用的钱包
  setKeypair(keypair: Keypair) {
    this.keypair = keypair;
    this.authToken = null; // 重置 token，因为钱包变了
    this.log('Switched to wallet: ' + keypair.publicKey.toBase58());
  }

  log(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    // 同时输出到控制台和文件
    console.log(message);
    this.logStream.write(logMessage);
  }

  private async ensureAuthToken(): Promise<string> {
    if (!this.authToken) {
      this.authToken = await generateSignatureAndGetToken(this.keypair);
    }
    if (!this.authToken) throw new Error('Failed to get auth token');
    return this.authToken;
  }

  // 获取项目列表
  async getProjects(targetToken: string) {
    try {
      this.log('\n=== Getting Projects ===');
      this.log('Target Token: ' + targetToken);

      // 确保有有效的认证 token
      const authToken = await this.ensureAuthToken();
      this.log('Auth Token: ' + authToken);
      
      const url = `${API_BASE_URL}/project?address=${encodeURIComponent(targetToken)}`;
      this.log('Request URL: ' + url);
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': authToken,
        'Origin': API_ORIGIN,
        'Referer': API_REFERER
      };
      
      this.log('Request Headers: ' + JSON.stringify(headers, null, 2));
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      this.log('Response Status: ' + response.status);
      this.log('Response Headers: ' + JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

      const responseText = await response.text();
      this.log('Response Body: ' + responseText);

      const data = JSON.parse(responseText);
      this.log('Parsed Response: ' + JSON.stringify(data, null, 2));

      if (data.code === 0 && Array.isArray(data.data)) {
        this.log(`Found ${data.data.length} projects`);
        return data.data;
      } else {
        this.log('Invalid response format: ' + JSON.stringify(data));
        return [];
      }
    } catch (error) {
      this.log('Failed to get projects: ' + error);
      return [];
    }
  }

  // 执行点赞
  async like(projectId: string) {
    try {
      this.log('\n=== Liking Project ===');
      this.log('Project ID: ' + projectId);
      
      // 确保有有效的token
      const token = await this.ensureAuthToken();
      this.log('Auth Token: ' + token);
      
      const url = `${API_BASE_URL}/project/like`;
      const body = JSON.stringify({ id: projectId });
      
      this.log('Request URL: ' + url);
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': token,
        'Origin': API_ORIGIN,
        'Referer': API_REFERER
      };
      
      this.log('Request Headers: ' + JSON.stringify(headers, null, 2));
      this.log('Request Body: ' + body);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body
      });

      this.log('Response Status: ' + response.status);
      this.log('Response Headers: ' + JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

      // 先获取原始响应文本
      const responseText = await response.text();
      this.log('Response Body: ' + responseText);

      try {
        // 尝试解析JSON
        const result = JSON.parse(responseText);
        this.log('Parsed Response: ' + JSON.stringify(result, null, 2));
        return result;
      } catch (parseError) {
        this.log('Failed to parse response as JSON: ' + parseError);
        throw new Error(`Invalid response: ${responseText}`);
      }
    } catch (error) {
      this.log(`Failed to like ${projectId}: ${error}`);
      throw error;
    }
  }

  // 批量执行点赞
  async batchLike(targetTokens: string[], config: BatchLikeConfig) {
    this.log('\n=== Starting Batch Like ===');
    this.log(`Target Tokens (${targetTokens.length}): ${JSON.stringify(targetTokens)}`);
    
    for (const targetToken of targetTokens) {
      this.log('\n=== Processing Token ===');
      this.log('Current Token: ' + targetToken);
      
      try {
        // 获取项目列表
        const projects = await this.getProjects(targetToken);
        if (!projects || !Array.isArray(projects)) {
          this.log('No projects found for token: ' + targetToken);
          continue;
        }

        this.log(`Found ${projects.length} projects for token ${targetToken}`);
        this.log('Projects: ' + JSON.stringify(projects, null, 2));

        // 对每个项目进行点赞
        for (const project of projects) {
          this.log('\n=== Processing Project ===');
          this.log('Project: ' + JSON.stringify(project, null, 2));
          
          try {
            if (!project.id) {
              this.log('Project missing id: ' + JSON.stringify(project));
              continue;
            }
            
            await this.like(project.id);
            
            // 计算点赞间的延迟时间
            let likeDelay = 0;
            if (config.likeDelay.fixed) {
              likeDelay = config.likeDelay.fixed;
            } else if (config.likeDelay.random) {
              const { min, max } = config.likeDelay.random;
              likeDelay = min + Math.random() * (max - min);
            }
            
            if (likeDelay > 0) {
              this.log(`Waiting ${likeDelay}ms before next like...`);
              await new Promise(resolve => setTimeout(resolve, likeDelay));
            }
          } catch (error) {
            this.log(`Failed to like project ${project.id}: ${error}`);
          }
        }
      } catch (error) {
        this.log(`Failed to process token ${targetToken}: ${error}`);
      }
    }
  }

  // 关闭日志流
  close() {
    this.logStream.end();
  }
}

// 延迟配置
interface DelayConfig {
  // 固定延迟时间（毫秒）
  fixed?: number;
  // 随机延迟范围（毫秒）
  random?: {
    min: number;
    max: number;
  };
}

// 批量点赞配置
interface BatchLikeConfig {
  // 要生成的钱包数量
  walletCount: number;
  // 要点赞的目标 token 列表
  targetTokens: string[];
  // 钱包之间的延迟
  walletDelay: DelayConfig;
  // 点赞操作之间的延迟
  likeDelay: DelayConfig;
  // 添加这个字段
  existingWallets?: WalletInfo[];
}

// 执行批量点赞
async function batchLikeWithMultipleWallets(config: BatchLikeConfig) {
  const bot = new LikeBot();
  
  try {
    // 使用现有钱包或生成新钱包
    const wallets = config.existingWallets || bot.generateWallets(config.walletCount);
    bot.log(`Using ${wallets.length} ${config.existingWallets ? 'existing' : 'new'} wallets`);

    // 为每个钱包执行点赞操作
    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      bot.log(`\n=== Processing wallet ${i + 1}/${wallets.length}: ${wallet.publicKey} ===`);
      
      // 从 Base64 转换为 Uint8Array
      const secretKey = Buffer.from(wallet.privateKey, 'base64');
      bot.setKeypair(Keypair.fromSecretKey(secretKey));

      // 执行点赞
      await bot.batchLike(config.targetTokens, config);

      // 计算钱包间的延迟时间
      let walletDelay = 0;
      if (config.walletDelay.fixed) {
        walletDelay = config.walletDelay.fixed;
      } else if (config.walletDelay.random) {
        const { min, max } = config.walletDelay.random;
        walletDelay = min + Math.random() * (max - min);
      }
      
      if (walletDelay > 0) {
        bot.log(`Waiting ${walletDelay}ms before next wallet...`);
        await new Promise(resolve => setTimeout(resolve, walletDelay));
      }
    }
  } catch (error) {
    bot.log(`Error in batch like: ${error}`);
  } finally {
    bot.close();
  }
}

// 修改 main 函数
async function main() {
    // 获取钱包数量和使用模式
    const walletCount = parseInt(process.argv[2]) || 3;
    const useExistingWallets = process.argv[3] === 'existing';
    
    let wallets: WalletInfo[] = [];
    const bot = new LikeBot();

    if (useExistingWallets) {
        try {
            // 从 wallets.json 读取现有钱包
            const walletsFile = path.join(process.cwd(), 'wallets', 'wallets.json');
            if (fs.existsSync(walletsFile)) {
                const existingWallets = JSON.parse(fs.readFileSync(walletsFile, 'utf8'));
                // 只使用前20个钱包
                wallets = existingWallets.slice(0, 20);
                console.log(`Using ${wallets.length} existing wallets from wallets.json`);
            } else {
                console.error('wallets.json not found. Please generate wallets first.');
                process.exit(1);
            }
        } catch (error) {
            console.error('Error reading wallets.json:', error);
            process.exit(1);
        }
    }

    const config: BatchLikeConfig = {
        walletCount,
        targetTokens: likeConfig.targetTokens,
        walletDelay: {
            random: likeConfig.delays.wallet
        },
        likeDelay: {
            fixed: likeConfig.delays.like.fixed
        },
        existingWallets: useExistingWallets ? wallets : undefined
    };

    console.log(`Starting like bot with ${useExistingWallets ? 'existing' : 'new'} wallets`);
    console.log('Target tokens:', config.targetTokens);
    
    await batchLikeWithMultipleWallets(config);
}

// 修改执行判断
if (require.main === module) {
    if (process.argv.length < 3) {
        console.log('Usage: npm run like <wallet_count> [existing]');
        console.log('Examples:');
        console.log('  npm run like 1000          # Generate and use new wallets');
        console.log('  npm run like 20 existing   # Use existing wallets from wallets.json');
        process.exit(1);
    }
    main().catch(console.error);
}