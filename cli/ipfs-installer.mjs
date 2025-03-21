import os from 'os';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

console.log('IPFS Installer Script - Starting...');

class IPFSInstaller {
    constructor() {
        console.log('Initializing IPFS Installer...');
        console.log('Platform:', os.platform());
        console.log('Architecture:', os.arch());
        console.log('Home Directory:', os.homedir());
        
        this.platform = os.platform();
        this.arch = os.arch();
        this.homeDir = os.homedir();
        this.ipfsPath = this.getIPFSPath();
        
        console.log('IPFS Installation Path:', this.ipfsPath);
    }

    getIPFSPath() {
        switch (this.platform) {
            case 'win32':
                return path.join(this.homeDir, '.ipfs', 'ipfs.exe');
            default:
                return path.join('/usr/local/bin', 'ipfs');
        }
    }

    async isIPFSInstalled() {
        try {
            console.log('Checking if IPFS is already installed...');
            const result = await execAsync('ipfs --version');
            console.log('IPFS version check result:', result.stdout);
            return true;
        } catch (error) {
            console.log('IPFS is not installed:', error.message);
            return false;
        }
    }

    async initializeIPFS() {
        try {
            console.log('Initializing IPFS daemon...');
            const result = await execAsync('ipfs init');
            console.log('IPFS initialization output:', result.stdout);
            console.log('IPFS initialized successfully!');
        } catch (error) {
            if (!error.message.includes('already initialized')) {
                console.error('Error initializing IPFS:', error.message);
                throw error;
            } else {
                console.log('IPFS is already initialized');
            }
        }
    }

    async getLatestVersion() {
        try {
            console.log('Fetching latest IPFS version...');
            return new Promise((resolve, reject) => {
                const request = https.get('https://api.github.com/repos/ipfs/kubo/releases/latest', {
                    headers: { 'User-Agent': 'IPFS-Installer' }
                }, (response) => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`Failed to fetch version: HTTP ${response.statusCode}`));
                        return;
                    }

                    let data = '';
                    response.on('data', chunk => data += chunk);
                    response.on('end', () => {
                        try {
                            const release = JSON.parse(data);
                            console.log('Latest version found:', release.tag_name);
                            resolve(release.tag_name);
                        } catch (error) {
                            reject(new Error('Failed to parse version data: ' + error.message));
                        }
                    });
                });

                request.on('error', (error) => {
                    reject(new Error('Failed to fetch version: ' + error.message));
                });

                request.setTimeout(10000, () => {
                    request.destroy();
                    reject(new Error('Request timed out after 10 seconds'));
                });
            });
        } catch (error) {
            console.error('Error fetching latest version:', error.message);
            return 'v0.22.0'; // Fallback version
        }
    }

    async downloadIPFS(url, destPath) {
        console.log('Downloading IPFS from:', url);
        return new Promise((resolve, reject) => {
            const fileStream = fs.createWriteStream(destPath);
            
            const request = https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
                    return;
                }

                response.pipe(fileStream);

                let downloadedBytes = 0;
                const totalBytes = parseInt(response.headers['content-length'], 10);

                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    const progress = totalBytes ? 
                        Math.round((downloadedBytes / totalBytes) * 100) : 
                        'unknown';
                    process.stdout.write(`\rDownload progress: ${progress}%`);
                });

                fileStream.on('finish', () => {
                    process.stdout.write('\n');
                    fileStream.close();
                    resolve();
                });

                fileStream.on('error', (error) => {
                    fs.unlink(destPath, () => {}); // Clean up failed download
                    reject(new Error('File stream error: ' + error.message));
                });
            });

            request.on('error', (error) => {
                fs.unlink(destPath, () => {});
                reject(new Error('Download failed: ' + error.message));
            });

            request.setTimeout(300000, () => { // 5 minutes timeout
                request.destroy();
                fs.unlink(destPath, () => {});
                reject(new Error('Download timed out after 5 minutes'));
            });
        });
    }

    async installWithPackageManager() {
        try {
            switch (this.platform) {
                case 'win32':
                    console.log('Installing IPFS using winget...');
                    try {
                        await execAsync('winget --version', { timeout: 5000 });
                        const result = await execAsync(
                            'winget install IPFS.IPFS --accept-source-agreements --accept-package-agreements', 
                            { timeout: 300000 }
                        );
                        console.log('Winget installation output:', result.stdout);
                        return true;
                    } catch (wingetError) {
                        if (wingetError.message.includes('not recognized')) {
                            console.log('Winget is not available on this system');
                        } else if (wingetError.message.includes('timed out')) {
                            console.log('Winget installation timed out after 5 minutes');
                        } else {
                            console.log('Winget installation failed:', wingetError.message);
                        }
                        return false;
                    }
                case 'darwin':
                    console.log('Installing IPFS using Homebrew...');
                    await execAsync('brew install ipfs');
                    return true;
                case 'linux':
                    console.log('Installing IPFS using apt...');
                    await execAsync('sudo apt-get update && sudo apt-get install -y ipfs');
                    return true;
                default:
                    return false;
            }
        } catch (error) {
            console.log('Package manager installation failed:', error.message);
            return false;
        }
    }

    async getDownloadUrl(version) {
        let osType, arch;

        switch (this.platform) {
            case 'win32':
                osType = 'windows';
                break;
            case 'darwin':
                osType = 'macos';
                break;
            default:
                osType = 'linux';
        }

        switch (this.arch) {
            case 'x64':
                arch = 'amd64';
                break;
            case 'arm64':
                arch = 'arm64';
                break;
            default:
                throw new Error('Unsupported architecture: ' + this.arch);
        }

        const baseUrl = 'https://dist.ipfs.tech/kubo';
        return `${baseUrl}/${version}/kubo_${version}_${osType}-${arch}.tar.gz`;
    }

    async install() {
        try {
            // Check if already installed
            if (await this.isIPFSInstalled()) {
                console.log('IPFS is already installed');
                return true;
            }

            // Try package manager first
            if (await this.installWithPackageManager()) {
                console.log('IPFS installed successfully via package manager');
                return true;
            }

            // Manual installation
            console.log('Proceeding with manual installation...');
            const version = await this.getLatestVersion();
            const downloadUrl = await this.getDownloadUrl(version);
            const tempDir = path.join(os.tmpdir(), 'ipfs-install');
            const archivePath = path.join(tempDir, 'ipfs.tar.gz');

            await fs.promises.mkdir(tempDir, { recursive: true });
            await this.downloadIPFS(downloadUrl, archivePath);

            // Extract and install
            console.log('Extracting IPFS...');
            await execAsync(`tar -xzf ${archivePath} -C ${tempDir}`);
            
            console.log('Installing IPFS binary...');
            if (this.platform === 'win32') {
                await fs.promises.mkdir(path.dirname(this.ipfsPath), { recursive: true });
                await fs.promises.copyFile(
                    path.join(tempDir, 'kubo', 'ipfs.exe'),
                    this.ipfsPath
                );
            } else {
                await execAsync(`sudo mv ${path.join(tempDir, 'kubo', 'ipfs')} ${this.ipfsPath}`);
                await execAsync(`sudo chmod +x ${this.ipfsPath}`);
            }

            // Cleanup
            await fs.promises.rm(tempDir, { recursive: true, force: true });

            console.log('IPFS installed successfully!');
            return true;
        } catch (error) {
            console.error('Installation failed:', error.message);
            return false;
        }
    }
}

// Run installer
const installer = new IPFSInstaller();
installer.install().then((success) => {
    if (success) {
        console.log('IPFS installation completed successfully');
        process.exit(0);
    } else {
        console.error('IPFS installation failed');
        process.exit(1);
    }
}).catch((error) => {
    console.error('Fatal error during installation:', error);
    process.exit(1);
});