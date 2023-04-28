const { deployments, ethers, getNamedAccounts, network } = require("hardhat")
const { assert, expect } = require("chai")
const { developmentChains, networkConfig } =require("../../helper-hardhat-config")

!developmentChains.includes(network.name) 
    ? describe.skip 
    : describe("Raffle Unit Tests", async function () {
        let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
        const chainId = network.config.chainId
        
        //deploy Raffle and VRFCoordinator contracts
        beforeEach(async function () {
            deployer = (await getNamedAccounts()).deployer
            //run deploy scripts with the "all" tag
            await deployments.fixture(["all"])
            //returns new connection to Raffle contract with deployer
            raffle = await ethers.getContract("Raffle", deployer)
            //returns new connection to VRFCoordinator contract with deployer
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            raffleEntranceFee = await raffle.getEntranceFee()
            interval = await raffle.getInterval()
        })

        describe("constructor", function() {
            it("initialises the raffle correctly", async function () {
                const raffleState = await raffle.getRaffleState()
                const entranceFee = await raffle.getEntranceFee()
                assert.equal(raffleState.toString(), "0")
                assert.equal(interval.toString(), networkConfig[chainId]["interval"])
                assert.equal(entranceFee.toString(), networkConfig[chainId]["entranceFee"])
            })
        })

        describe("enterRaffle", function () {

            it("reverts when entrance fee is not met", async function () {
                await expect(raffle.enterRaffle()).to.be.revertedWith(
                    "Raffle__NotEnoughETHEntered"
                )
            })

            it("Records players to player array", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                const playerFromContract = await raffle.getPlayer(0)
                assert.equal(playerFromContract, deployer)
            })
            
            it("Emits event on enter", async function () {
                //checking for event emission
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEnter")
            })

            it("Doesn't allow entry when raffle is calculating", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                //making sure time interval requirement is met in checkUpkeep function
                //moved time along by our assigned time interval and force mined a block
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                //Now we call performUpkeep, retending to be a Chainlink keeper
                await raffle.performUpkeep([])
                //now raffle should be in a CALCULATING state and entering the raffle should not be possible
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith("Raffle__NotOpen")
            })
        })

        describe("checkUpkeep", function () {
            it("returns false if no ETH has been sent", async function () {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                assert(!upkeepNeeded)
            })
            it("returns false if raffle isn't open", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                await raffle.performUpkeep([])
                const raffleState = await raffle.getRaffleState()
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                assert.equal(raffleState.toString(), "1")
                assert.equal(upkeepNeeded, false)
            })
        })

        describe("performUpkeep", function () {
            it("Can only run if upkeepNeeded is true", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const tx = await raffle.performUpkeep([])
                assert(tx)
            })

            it("revert with error if upkeepNeeded is false", async function () {
                await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded")
            })

            it("updates raffle state, emits an event and calls vrfcoordinator", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const txResponse = await raffle.performUpkeep([])
                const txReceipt = await txResponse.wait(1)
                //get requestId from event emited from performUpkeep stored in txReceipt
                const requestId = txReceipt.events[1].args.requestId
                const raffleState = await raffle.getRaffleState()
                assert(requestId.toNumber() > 0)
                assert(raffleState.toString() == "1")

            })
        })

        describe("fulfillRandomWords", function () {
            beforeEach(async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
            })
            
            it("can only be called after performUpkeep", async function () {
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request")
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request")
            })

            it("Picks winner, resets raffle, pays winner", async function () {
                //add additional raffle entries
                const additionalEntrants = 3 
                const startingIndex = 1
                const accounts = await ethers.getSigners()
                for (let i = startingIndex; i < startingIndex + additionalEntrants; i++) { // i = 2; i < 5; i=i+1
                    // Returns a new instance of the Raffle contract connected to player
                    const connectedRaffle = raffle.connect(accounts[i])
                    await connectedRaffle.enterRaffle({ value: raffleEntranceFee })
                }
                // stores starting timestamp (before event is emitted)
                const startingTimeStamp = await raffle.getLatestTimestamp() 

                await new Promise(async (resolve, reject) => {
                    raffle.once("WinnerPicked", async () => { // event listener for WinnerPicked
                        console.log("WinnerPicked event fired!")
                        // assert throws an error if it fails, so we need to wrap
                        // it in a try/catch so that the promise returns event
                        // if it fails.
                        try {
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const winnerBalance = await accounts[1].getBalance()
                            const endingTimeStamp = await raffle.getLatestTimestamp()
                            await expect(raffle.getPlayer(0)).to.be.reverted
                            // Comparisons to check ending values are correct:
                            assert.equal(recentWinner.toString(), accounts[1].address)
                            assert.equal(raffleState, 0)
                            assert.equal(
                                winnerBalance.toString(), 
                                startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrants) + raffleEntranceFee )
                                    .add(
                                        raffleEntranceFee
                                            .mul(additionalEntrants)
                                            .add(raffleEntranceFee)
                                    )
                                    .toString()
                            )
                            assert(endingTimeStamp > startingTimeStamp)
                            resolve() // if try passes, resolves the promise 
                        } catch (e) { 
                            reject(e) // if try fails, rejects the promise
                        }
                    })

                    // Pretends random number was drawn kicking off the event by mocking the chainlink keepers and vrf coordinator
                    const tx = await raffle.performUpkeep([])
                    const txReceipt = await tx.wait(1)
                    const startingBalance = await accounts[1].getBalance()
                    await vrfCoordinatorV2Mock.fulfillRandomWords( txReceipt.events[1].args.requestId, raffle.address )
                  })
            })
        })
})