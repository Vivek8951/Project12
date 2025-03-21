import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import tar from 'tar';
import extract from 'extract-zip';
import which from 'which';
import chalk from 'chalk';

const execAsync = promisify(exec);

const GITHUB_API = 'https://api.github.com/repos/ipfs/kubo/releases/latest';
const INSTALL_PATHS = {
  win32: path.join(os.homedir(), 'AppData', 'Local', 'IPFS'),
  darwin: '/usr/local/bin',
  linux: '/usr/local/bin'
};

const MAX_RETRIES = 3;
const TIMEOUT = 30000; // 30 seconds

async function retry(fn, retries = MAX_RETRIES, delay = 2000) {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    console.log(chalk.yellow(`Retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`));
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 1.5);
  }
}

async function checkIPFSInstalled() {
  try {
    // First try to find ipfs in PATH
    const ipfsPath = await which('ipfs');
    
    // Verify the binary is actually executable
    try {
      const { stdout } = await execAsync('ipfs --version');
      console.log(chalk.green(`✓ IPFS is already installed at ${ipfsPath}`));
      console.log(chalk.green(`  Version: ${stdout.trim()}`));
      return true;
    } catch (error) {
      console.log(chalk.yellow('IPFS binary found but not executable. Will attempt reinstallation.'));
      return false;
    }
  } catch {
    // Check if IPFS exists in the default installation path
    const platform = os.platform();
    const installPath = INSTALL_PATHS[platform];
    const binaryName = platform === 'win32' ? 'ipfs.exe' : 'ipfs';
    const expectedPath = path.join(installPath, binaryName);
    
    try {
      await fs.access(expectedPath);
      console.log(chalk.yellow(`IPFS binary found at ${expectedPath} but not in PATH. Will attempt to fix PATH.`));
      return false;
    } catch {
      return false;
    }
  }
}

async function getLatestVersion() {
  return retry(async () => {
    try {
      const response = await axios.get(GITHUB_API, {
        timeout: TIMEOUT,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ipfs-installer'
        }
      });
      return response.data.tag_name;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timed out. Please check your internet connection.');
      }
      throw error;
    }
  });
}

async function getDownloadUrl(version) {
  const platform = os.platform();
  const arch = os.arch() === 'x64' ? 'amd64' : os.arch();
  
  const versionNumber = version.startsWith('v') ? version : `v${version}`;
  
  switch (platform) {
    case 'win32':
      return `https://github.com/ipfs/kubo/releases/download/${versionNumber}/kubo_${versionNumber}_windows-${arch}.zip`;
    case 'darwin':
      return `https://github.com/ipfs/kubo/releases/download/${versionNumber}/kubo_${versionNumber}_darwin-${arch}.tar.gz`;
    case 'linux':
      return `https://github.com/ipfs/kubo/releases/download/${versionNumber}/kubo_${versionNumber}_linux-${arch}.tar.gz`;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

async function installWithPackageManager() {
  const platform = os.platform();
  
  if (platform === 'darwin') {
    try {
      console.log(chalk.blue('Installing IPFS using Homebrew...'));
      execSync('brew install ipfs');
      return true;
    } catch {
      return false;
    }
  }

  if (platform === 'linux') {
    try {
      // Try apt-get
      execSync('which apt-get');
      console.log(chalk.blue('Installing IPFS using apt...'));
      execSync('sudo apt-get update && sudo apt-get install -y ipfs');
      return true;
    } catch {
      try {
        // Try yum
        execSync('which yum');
        console.log(chalk.blue('Installing IPFS using yum...'));
        execSync('sudo yum install -y ipfs');
        return true;
      } catch {
        return false;
      }
    }
  }

  if (platform === 'win32') {
    try {
      console.log(chalk.blue('Installing IPFS using winget...'));
      execSync('winget install IPFS');
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

async function downloadAndInstall(url) {
  const platform = os.platform();
  const tempDir = path.join(os.tmpdir(), 'ipfs-install');
  const installPath = INSTALL_PATHS[platform];

  try {
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    // Download the archive with retry logic
    console.log(chalk.blue('Downloading IPFS...'));
    console.log(chalk.blue(`Download URL: ${url}`));
    
    const downloadFile = async () => {
      try {
        const response = await axios.get(url, {
          timeout: TIMEOUT,
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'ipfs-installer',
            'Accept': 'application/octet-stream'
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          onDownloadProgress: (progressEvent) => {
            const totalSize = progressEvent.total;
            const downloadedSize = progressEvent.loaded;
            const progress = Math.round((downloadedSize / totalSize) * 100);
            const downloadedMB = (downloadedSize / (1024 * 1024)).toFixed(2);
            const totalMB = (totalSize / (1024 * 1024)).toFixed(2);
            process.stdout.write(`\rDownloading: ${progress}% (${downloadedMB}MB / ${totalMB}MB)`);
          }
        });
        return response.data;
      } catch (error) {
        if (error.response && error.response.status === 404) {
          throw new Error(`Download URL not found: ${url}`);
        }
        throw error;
      }
    };

    const fileData = await retry(downloadFile);
    process.stdout.write('\n');
    
    const isZip = url.endsWith('.zip');
    const archivePath = path.join(tempDir, isZip ? 'ipfs.zip' : 'ipfs.tar.gz');
    await fs.writeFile(archivePath, fileData);

    // Extract the archive
    console.log(chalk.blue('Extracting files...'));
    if (isZip) {
      await extract(archivePath, { dir: tempDir });
    } else {
      await tar.extract({
        file: archivePath,
        cwd: tempDir
      });
    }

    // Move binary to install location
    const binaryName = platform === 'win32' ? 'ipfs.exe' : 'ipfs';
    const sourcePath = path.join(tempDir, 'kubo', binaryName);
    const targetPath = path.join(installPath, binaryName);

    // Ensure install directory exists
    await fs.mkdir(installPath, { recursive: true });

    // Verify source binary exists
    try {
      await fs.access(sourcePath);
    } catch (error) {
      throw new Error(`IPFS binary not found in extracted files: ${sourcePath}`);
    }

    // Copy binary and set permissions
    await fs.copyFile(sourcePath, targetPath);
    await fs.chmod(targetPath, 0o755);

    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true });

    if (platform === 'win32') {
      // Update only User PATH on Windows due to potential system restrictions
      console.log(chalk.blue('Updating Windows User PATH...'));
      try {
        // Get current User PATH
        const currentUserPath = execSync('powershell -Command "[Environment]::GetEnvironmentVariable(\'PATH\', \'User\')"').toString().trim();
        
        // Check if path already exists in User PATH
        if (!currentUserPath.split(';').includes(installPath)) {
          // Add new path to User PATH
          const newPath = currentUserPath + (currentUserPath ? ';' : '') + installPath;
          execSync(`powershell -Command "[Environment]::SetEnvironmentVariable(\'PATH\', \'${newPath}\', \'User\')"`);      
          console.log(chalk.green('✓ Added IPFS to user PATH'));
        } else {
          console.log(chalk.green('✓ IPFS path already in user PATH'));
        }
        
        // Update current process PATH
        const newProcessPath = process.env.PATH + ';' + installPath;
        process.env.PATH = newProcessPath;
        
        // Verify PATH update and binary accessibility
        try {
          const ipfsVersion = execSync('ipfs --version', { env: { ...process.env, PATH: newProcessPath } }).toString();
          console.log(chalk.green(`✓ IPFS binary is accessible (${ipfsVersion.trim()})`));
        } catch (error) {
          console.log(chalk.yellow('\nPlease try the following:'));
          console.log(chalk.yellow('1. Open a new terminal window'));
          console.log(chalk.yellow(`2. Verify IPFS is in your User PATH: ${installPath}`));
          console.log(chalk.yellow('3. Try running: ipfs --version'));
          throw new Error('IPFS binary not accessible after PATH update');
        }
      } catch (error) {
        console.error(chalk.red('Failed to update PATH:'), error.message);
        console.log(chalk.yellow(`\nPlease manually add ${installPath} to your User PATH:`));
        console.log(chalk.yellow('1. Press Win + X and select "System"'));
        console.log(chalk.yellow('2. Click "Advanced system settings"'));
        console.log(chalk.yellow('3. Click "Environment Variables"'));
        console.log(chalk.yellow('4. Under "User variables", edit "Path"'));
        console.log(chalk.yellow(`5. Add "${installPath}" to the list`));
        console.log(chalk.yellow('6. Click OK and restart your terminal'));
        throw new Error('PATH update failed');
      }
    }

    // Final verification
    try {
      const { stdout } = await execAsync('ipfs --version');
      console.log(chalk.green(`✓ IPFS ${stdout.trim()} installed successfully`));
    } catch (error) {
      console.log(chalk.yellow('Warning: IPFS installation completed but verification failed.'));
      console.log(chalk.yellow('Please try the following:'));
      console.log(chalk.yellow('1. Open a new terminal window'));
      console.log(chalk.yellow(`2. Verify IPFS is in your PATH: ${installPath}`));
      console.log(chalk.yellow('3. Try running: ipfs --version'));
      throw new Error('Installation verification failed');
    }
  } catch (error) {
    console.error(chalk.red('Error during installation:'), error.message);
    throw error;
  }
}

async function main() {
  try {
    if (await checkIPFSInstalled()) {
      return;
    }

    console.log(chalk.blue('Checking package manager installation...'));
    if (await installWithPackageManager()) {
      return;
    }

    console.log(chalk.blue('Installing from binary...'));
    const version = await getLatestVersion();
    const downloadUrl = await getDownloadUrl(version);
    await downloadAndInstall(downloadUrl);

    // Verify installation
    
    if (await checkIPFSInstalled()) {
      console.log(chalk.green('✓ IPFS installation verified successfully!'));
    } else {
      throw new Error('Installation verification failed');
    }
  } catch (error) {
    console.error(chalk.red('Installation failed:'), error);
    process.exit(1);
  }
}

main();
