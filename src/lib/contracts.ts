import { ethers } from 'ethers';

// ABI for the Alpha AI Storage Contract
const STORAGE_CONTRACT_ABI = [
  "function purchaseStorage(address provider, uint256 storageAmount) payable",
  "function getStorageBalance(address user, address provider) view returns (uint256)",
  "event StoragePurchased(address indexed user, address indexed provider, uint256 amount)"
];

// Contract addresses (replace with actual deployed contract addresses)
export const STORAGE_CONTRACT_ADDRESS = '0x3fe2A019178e6b1DDe022CACE349DA34C573f94a';
export const AAI_TOKEN_ADDRESS = '0xd5F6a56c8B273854fbd135239FcbcC2B8142585a';

// Storage contract interface
export class StorageContract {
  private contract: ethers.Contract;
  private signer: ethers.Signer;

  constructor(provider: ethers.BrowserProvider) {
    this.initializeContract(provider);
  }

  private async initializeContract(provider: ethers.BrowserProvider) {
    try {
      this.signer = await provider.getSigner();
      this.contract = new ethers.Contract(
        STORAGE_CONTRACT_ADDRESS,
        STORAGE_CONTRACT_ABI,
        this.signer
      );
    } catch (error) {
      console.error('Error initializing contract:', error);
      throw error;
    }
  }

  async purchaseStorage(providerAddress: string, storageAmount: number, pricePerGB: number) {
    try {
      // Calculate total cost in AAI tokens
      const totalCost = ethers.parseEther((storageAmount * pricePerGB).toString());
      
      // Get AAI token contract instance
      const aaiToken = new ethers.Contract(
        AAI_TOKEN_ADDRESS,
        ['function approve(address spender, uint256 amount)', 'function balanceOf(address owner) view returns (uint256)'],
        this.signer
      );
      
      // Check user's AAI token balance
      const signerAddress = await this.signer.getAddress();
      const balance = await aaiToken.balanceOf(signerAddress);
      if (balance < totalCost) {
        throw new Error('Insufficient AAI token balance');
      }

      // Approve AAI token spending
git add      const approveTx = await aaiToken.approve(STORAGE_CONTRACT_ADDRESS, totalCost);
      await approveTx.wait();

      // Purchase storage
      const tx = await this.contract.purchaseStorage(
        providerAddress,
        ethers.parseUnits(storageAmount.toString(), 'gwei'),
        { gasLimit: 300000 }
      );
      
      const receipt = await tx.wait();
      return receipt;
    } catch (error) {
      console.error('Error purchasing storage:', error);
      throw error instanceof Error ? error : new Error('Failed to purchase storage');
    }
  }

  async getStorageBalance(userAddress: string, providerAddress: string): Promise<number> {
    try {
      const balance = await this.contract.getStorageBalance(userAddress, providerAddress);
      return ethers.utils.formatUnits(balance, 'gwei');
    } catch (error) {
      console.error('Error getting storage balance:', error);
      throw error;
    }
  }
}