const { network, ethers } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const FUND_AMOUNT = ethers.utils.parseEther("1")

module.exports = async function ({ getNamedAccounts, deployments}) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock

    if (developmentChains.includes(network.name)) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        //getting a subscriptionID for local network
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        //event emitted from creatSubscription() which contains subscriptionId
        subscriptionId = transactionReceipt.events[0].args.subId
        //need to fund subscription
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }
    log("-----------------------------------------------------------")

    const args = [
        vrfCoordinatorV2Address, 
        networkConfig[chainId]["entranceFee"],
        networkConfig[chainId]["gasLane"], 
        subscriptionId, 
        networkConfig[chainId]["callbackGasLimit"],
        networkConfig[chainId]["interval"],  
        ]
    //console.log(args)
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(raffle.address, args)
    } else {
        //gives us access to performUkeep() when testing
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), raffle.address)
    }
    log("-----------------------------------------------------------")
}

module.exports.tags = ["all", "raffle"]