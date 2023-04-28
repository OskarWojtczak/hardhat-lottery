const { ethers, getNamedAccounts, network } = require("hardhat")
const { assert, expect } = require("chai")
const { developmentChains } =require("../../helper-hardhat-config")


developmentChains.includes(network.name) 
    ? describe.skip 
    : describe("Raffle Staging Tests", async function () {
        let raffle, raffleEntranceFee, deployer
        
        //deploy Raffle and VRFCoordinator contracts
        beforeEach(async function () {
            deployer = (await getNamedAccounts()).deployer
            //returns new connection to Raffle contract with deployer
            raffle = await ethers.getContract("Raffle", deployer)
            raffleEntranceFee = await raffle.getEntranceFee()
        })

        describe("fullfillRandomWords", function () {
            it("works with live Chainlink Keepers and Chainlink VRF. random winner selected", async function () {
                const startingTimeStamp = await raffle.getLatestTimestamp()
                const accounts = await ethers.getSigners()
                //setup listener for "WinnerPicked" event before raffle is entered
                await new Promise(async (resolve, reject) => {
                    raffle.once("WinnerPicked", async () => {
                        console.log("WinnerPicked event fired!")
                        try {
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const winnerEndingBalance = await accounts[0].getBalance()
                            const endingTimeStamp = await raffle.getLatestTimestamp()
                            //check if player array has been reset
                            await expect(raffle.getPlayer(0)).to.be.reverted
                            //check if recentwinner is deployer/only participant
                            assert.equal(recentWinner.toString(), accounts[0].address)
                            //check that winner receives funds(in raffle of size 1)
                            assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(raffleEntranceFee).toString())
                            //check that new timestamp has been assigned and is in the future of old timeStamp
                            assert(endingTimeStamp > startingTimeStamp)
                            //Check that raffle has been reopened, is OPEN/"0"
                            assert.equal(raffleState, 0)
                            resolve()
                        } catch (error) {  
                            console.log(error)
                            reject(error)
                        }
                    })
                    //entering raffle
                    //now that listener is listening we can emit event to be caught and trigger try/catch
                    const tx = await raffle.enterRaffle({ value: raffleEntranceFee})
                    //we await the tx to complete so that we avoid gasFee being a factor in our final calc
                    //since once the tx completes the "starting balance" should be exactly 0.1 less than the final balance
                    await tx.wait(1)
                    const winnerStartingBalance = await accounts[0].getBalance()
                })
            })
        })
    })