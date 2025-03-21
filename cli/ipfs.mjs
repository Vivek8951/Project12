import { exec } from 'child_process';
import { promisify } from 'util';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import tar from 'tar';
import which from 'which';
import path from 'path';
import os from 'os';
import ora from 'ora';

const execAsync = promisify(exec);

const IPFS_VERSION = '0.17.0';
const IPFS_DOWNLOAD_BASE = `https://dist.ipfs.tech/kubo/v${IPFS_VERSION}/kubo_v${IPFS_VERSION}_`;

// Get OS-specific download URL and installation path
export const getOSSpecifics = () => {
  const platform = os.platform();
  const arch = os.arch();
  
  let downloadUrl;
  let installPath;
  
  switch(platform) {
    case 'win32':
      downloadUrl = `${IPFS_DOWNLOAD_BASE}windows-${arch === 'x64' ? 'amd64' : arch}.zip`;
      installPath = 'C:\\Program Files\\kubo';
      break;
    case 'darwin':
      downloadUrl = `${IPFS_DOWNLOAD_BASE}darwin-${arch === 'x64' ? 'amd64' : arch}.tar.gz`;
      installPath = '/usr/local/bin';
      break;
    default: // Linux
      downloadUrl = `${IPFS_DOWNLOAD_BASE}linux-${arch === 'x64' ? 'amd64' : arch}.tar.gz`;
      installPath = '/usr/local/bin';
  }
  
  return { downloadUrl, installPath };
};

// Check if IPFS is installed
export async function checkIpfsInstalled() {
  try {
    await which('ipfs');
    return true;
  } catch {
    return false;
  }
}

// Download and install IPFS
export async function installIpfs() {
  const spinner = ora('Installing IPFS...').start();
  const { downloadUrl, installPath } = getOSSpecifics();

  try {
    // Create temp directory
    const tempDir = path.join(os.tmpdir(), 'ipfs-install');
    await mkdir(tempDir, { recursive: true });

    // Download IPFS
    spinner.text = 'Downloading IPFS...';
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download IPFS: ${response.statusText}`);
    }

    const fileStream = createWriteStream(path.join(tempDir, 'ipfs.tar.gz'));
    
    try {
      await new Promise((resolve, reject) => {
        const stream = response.body;
        if (!stream) {
          reject(new Error('No response body stream available'));
          return;
        }

        stream.on('error', (error) => {
          fileStream.destroy();
          reject(error);
        });

        fileStream.on('error', (error) => {
          stream.destroy();
          reject(error);
        });

        fileStream.on('finish', () => {
          resolve();
        });

        stream.pipe(fileStream);
      });
    } catch (error) {
      throw new Error(`Failed to download IPFS: ${error.message}`);
    }

    // Extract IPFS
    spinner.text = 'Extracting IPFS...';
    await tar.x({
      file: path.join(tempDir, 'ipfs.tar.gz'),
      cwd: tempDir
    });

    // Move binary to installation path
    spinner.text = 'Installing IPFS binary...';
    await execAsync(`sudo mv ${path.join(tempDir, 'kubo/ipfs')} ${installPath}`);
    
    spinner.succeed('IPFS installed successfully!');
    return true;
  } catch (error) {
    spinner.fail(`Failed to install IPFS: ${error.message}`);
    return false;
  }
}

// Initialize IPFS if not already initialized
export async function initializeIpfs() {
  const spinner = ora('Initializing IPFS...').start();
  try {
    await execAsync('ipfs init');
    spinner.succeed('IPFS initialized successfully!');
    return true;
  } catch (error) {
    if (!error.message.includes('already')) {
      spinner.fail(`Failed to initialize IPFS: ${error.message}`);
      return false;
    }
    spinner.info('IPFS already initialized');
    return true;
  }
}

// Start IPFS daemon
export async function startIpfsDaemon() {
  const spinner = ora('Starting IPFS daemon...').start();
  try {
    // Check if daemon is already running
    try {
      await execAsync('ipfs swarm peers');
      spinner.info('IPFS daemon is already running');
      return true;
    } catch {
      // Daemon is not running, start it
      const daemon = exec('ipfs daemon');
      
      return new Promise((resolve) => {
        daemon.stdout.on('data', (data) => {
          if (data.includes('Daemon is ready')) {
            spinner.succeed('IPFS daemon started successfully!');
            resolve(true);
          }
        });
      });
    }
  } catch (error) {
    spinner.fail(`Failed to start IPFS daemon: ${error.message}`);
    return false;
  }
}

// Configure IPFS settings
export async function configureIpfs(storageDir) {
  try {
    // Create storage directory
    const providerStorageDir = path.join(storageDir, 'alpha-ai-storage');
    await mkdir(providerStorageDir, { recursive: true });
    
    // Configure IPFS to use custom storage location
    await execAsync('ipfs config --json Datastore.StorageMax "\"100GB\""');
    await execAsync('ipfs config --json Datastore.StorageGCWatermark 90');
    await execAsync('ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin "[\"*\"]"');
    await execAsync('ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods "[\"PUT\", \"POST\", \"GET\"]"');
    return true;
  } catch (error) {
    console.error('Failed to configure IPFS:', error.message);
    return false;
  }
}

// Main function to handle IPFS setup and startup
export async function main() {
  try {
    // Check if IPFS is installed
    const ipfsInstalled = await checkIpfsInstalled();
    if (!ipfsInstalled) {
      console.log('IPFS not found. Installing...');
      const installed = await installIpfs();
      if (!installed) {
        throw new Error('Failed to install IPFS');
      }
    }

    // Initialize IPFS
    const initialized = await initializeIpfs();
    if (!initialized) {
      throw new Error('Failed to initialize IPFS');
    }

    // Start IPFS daemon
    const daemonStarted = await startIpfsDaemon();
    if (!daemonStarted) {
      throw new Error('Failed to start IPFS daemon');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  main();
}