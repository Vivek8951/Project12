import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, access } from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Dynamic imports for ESM modules
const loadDependencies = async () => {
  const inquirer = await import('inquirer');
  const { providerOperations, miningOperations } = await import('../src/lib/supabase.js');
  return { inquirer: inquirer.default, providerOperations: {
    ...providerOperations,
    async getProviderByAddress(address) {
      const { data, error } = await supabase
        .from('providers')
        .select('*, provider_keys(*)')
        .eq('address', address)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async storePrivateKey(providerId, encryptedKey) {
      const { error } = await supabase
        .from('provider_keys')
        .upsert({
          provider_id: providerId,
          encrypted_private_key: encryptedKey,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
    },
    async addStorageAllocation(address, storageSize, pricePerGb) {
      const { data, error } = await supabase
        .from('providers')
        .insert([
          {
            address: address,
            available_storage: storageSize,
            used_storage: 0,
            is_online: true,
            price_per_gb: pricePerGb,
            total_files: 0,
            reputation: 0
          }
        ]);
      if (error) throw error;
      return data;
    }
  }, miningOperations };
};

// Initialize Supabase client
const supabase = createClient(
  'https://bcrzplbyvjynicxptuix.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjcnpwbGJ5dmp5bmljeHB0dWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0NzA1OTIsImV4cCI6MjA1ODA0NjU5Mn0.Z-RtPx9DzUnZdagxU4FHZBLy6SwZLpeAuxlVxonTbjM'
);

// Initialize dependencies and start the CLI
loadDependencies().then(({ inquirer, providerOperations, miningOperations }) => {
  let privateKey; // Declare privateKey in the proper scope

  // Validate private key
  function validatePrivateKey(key) {
    try {
      // Add 0x prefix if not present
      const formattedKey = key.startsWith('0x') ? key : `0x${key}`;
      const wallet = new ethers.Wallet(formattedKey);
      return wallet.address;
    } catch {
      return false;
    }
  }

  // Main CLI program
  const program = new Command();

  program
    .name('alpha-ai-provider')
    .description('Alpha AI DePIN Storage Provider CLI')
    .version('1.0.0');

  program.command('start')
    .description('Start providing storage')
    .action(async () => {
      console.log(chalk.blue('🚀 Starting Alpha AI Storage Provider...'));

      // Initialize IPFS first
      try {
        // Check if IPFS daemon is already running
        try {
          await execAsync('ipfs swarm peers');
          console.log(chalk.green('✓ IPFS daemon is already running'));
        } catch {
          console.log(chalk.red('Error: IPFS daemon is not running. Please start it using "ipfs daemon" command first.'));
          process.exit(1);
        }

        // Check if provider already exists and get stored private key
        const answers = await inquirer.prompt([
          {
            type: 'password',
            name: 'privateKey',
            message: 'Enter your private key (will be securely stored):',
            validate: (input) => {
              const address = validatePrivateKey(input);
              if (!address) return 'Invalid private key';
              return true;
            }
          },
          {
            type: 'list',
            name: 'storageDir',
            message: 'Select storage directory:',
            choices: async () => {
              try {
                // Get available drives
                const drives = os.platform() === 'win32'
                  ? (await execAsync('wmic logicaldisk get name')).stdout.split('\r\r\n').filter(d => d.trim() && d !== 'Name').map(d => d.trim())
                  : ['/'];

                // Add custom path option
                return [
                  ...drives.map(drive => ({
                    name: `${drive} (Root Directory)`,
                    value: drive
                  })),
                  {
                    name: 'Custom Path',
                    value: 'custom'
                  }
                ];
              } catch (error) {
                console.error(chalk.red('Error getting drive list:', error.message));
                return [{
                  name: 'Custom Path',
                  value: 'custom'
                }];
              }
            }
          },
          {
            type: 'input',
            name: 'customStorageDir',
            message: 'Enter custom storage path:',
            when: (answers) => answers.storageDir === 'custom',
            validate: async (input) => {
              try {
                await access(input);
                return true;
              } catch {
                return 'Invalid directory path. Please enter a valid path.';
              }
            }
          },
          {
            type: 'number',
            name: 'storageSize',
            message: 'Enter storage size to allocate (in GB):',
            validate: (input) => {
              if (isNaN(input) || input <= 0) {
                return 'Please enter a valid storage size greater than 0';
              }
              return true;
            }
          }
        ]);

        // Set private key and storage directory
        privateKey = answers.privateKey;
        const storageDir = answers.storageDir === 'custom' ? answers.customStorageDir : answers.storageDir;
        const storageSize = answers.storageSize * 1024 * 1024 * 1024; // Convert GB to bytes

        // Initialize provider
        const address = validatePrivateKey(privateKey);
        let providerData = await providerOperations.getProviderByAddress(address);

        // Configure storage directory
        const providerStorageDir = path.join(storageDir, 'alpha-ai-storage');
        await mkdir(providerStorageDir, { recursive: true });

        // Store provider data if new
        if (!providerData) {
          try {
            const { data, error } = await supabase
              .from('providers')
              .insert([
                {
                  address: address,
                  available_storage: storageSize,
                  used_storage: 0,
                  is_online: true,
                  price_per_gb: 1,
                  total_files: 0,
                  reputation: 0
                }
              ]);
            
            if (error) throw error;
          } catch (error) {
            throw new Error(`Failed to setup provider: ${error.message}`);
          }
        }

        // Update provider status in Supabase
        await providerOperations.updateProviderStatus(address, true);
        
        // Initialize mining points
        await miningOperations.updateMiningPoints(address, 0);
        
        console.log(chalk.green(`Provider address: ${address}`));
        console.log(chalk.green('Storage provider is now online and ready to accept files!'));
        
        // Keep the process running and update status periodically
        setInterval(async () => {
          try {
            await providerOperations.updateProviderStatus(address, true);
          } catch (error) {
            console.error(chalk.yellow('Failed to update provider status:', error.message));
          }
        }, 60000); // Update every minute
        
        process.stdin.resume();
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
          console.log(chalk.yellow('\nShutting down provider...'));
          try {
            await providerOperations.updateProviderStatus(address, false);
          } catch (error) {
            console.error(chalk.red('Failed to update provider status:', error.message));
          }
          process.exit(0);
        });
      } catch (error) {
        console.error(chalk.red('Error:', error.message));
        process.exit(1);
      }
    });

  program.parse();
}).catch(error => {
  console.error('Failed to initialize dependencies:', error);
  process.exit(1);
});