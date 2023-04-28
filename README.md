# Lottery Smart Contract with Hardhat

This repository contains a Hardhat project that deploys a lottery smart contract to a local development network and to test networks like Sepolia. This contract implements Chainlink VRF and Chainlink Keepers to provide an automated and verifiably fair Lottery for all users. The project includes unit and staging test scripts, as well as a mock contract to simulate Chainlink VRF and Chainlink Keepers for local use.

## Installation

Clone the repository:

```bash
git clone https://github.com/OskarWojtczak/hardhat-lottery.git
```
Install the dependencies:

```bash
cd hardhat-lottery
npm install  //or yarn install
```
Compile the contracts:

```bash
npx hardhat compile //or yarn hardhat compile
```

## Usage

DISCLAIMER: Please do not share your private account key with anybody for any reason! My suggestion, should anyone like to test or deploy this contract is to make a new account that will only ever hold test currency like SepoliaETH.

To run tests or deploy to any test network please ensure to configure and provide (in a .env file or else):
 
1. The RPC url associated with the network
2. An Account Private Key for an account with sufficient test currency. (eg, SepoliaETH)
3. An Etherscan API key to verify the contract on etherscan.io (Optional)

Testnet currency can be obtained here: [https://faucets.chain.link](https://faucets.chain.link)

```bash
import foobar

# Run the unit tests
yarn hardhat test

# Run the staging test
yarn hardhat test --network sepolia

# Deploy contract to local network
yarn hardhat deploy

# Deploy contract to Sepolia network
yarn hardhat deploy --network sepolia
```


## Contract Details

The lottery/raffle smart contract is located in the contracts/Raffle.sol file. It has the following features:

- Players can enter a lottery by sending ETH to the contract.
- Each entry costs 0.1 ETH and represents a chance to win the lottery.
- The contract picks a random winner after some time has passed.
- The winner receives 100% of the total ETH sent to the contract.

## Mock Contract

The mock contract is located in the contracts/test/VRFCoordinatorV2Mock.js file. It can be used to test the code without deploying the actual contract to a network. The mock contract has the same interface as the real contract, but it doesn't interact with the blockchain.

## License

[MIT](https://choosealicense.com/licenses/mit/)
