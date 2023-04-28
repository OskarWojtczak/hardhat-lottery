const { developmentChains } = require("../helper-hardhat-config")
const { network } = require("hardhat")

const BASE_FEE = ethers.utils.parseEther("0.25") //0.25 is the premium. unlike pricefeeds, which are sponsored by organisations which allow other people to read from them(for free). no one is running this for us so we need to ay for the requests
const GAS_PRICE_LINK = 1e9 //effectively link per gas. ensures chainlink doesnt go bankrupt should the price of gas increase too drastically

module.exports = async function({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    //const chainId = network.config.chainId

    if(developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...")
        //deploying mock vrfcoordinator on local test network
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: [ BASE_FEE, GAS_PRICE_LINK ],
        })
        log("Mocks Deployed!")
        log("-----------------------------------------------------------")
        log("You are deploying to a local network, you'll need a local network running to interact")
        log("Please run `yarn hardhat console --network localhost` to interact with the deployed smart contracts")
        log("-----------------------------------------------------------")
    }

}

module.exports.tags = ["all", "mocks"]