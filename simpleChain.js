/* ===== SHA256 with Crypto-js ===============================
|  Learn more: Crypto-js: https://github.com/brix/crypto-js  |
|  =========================================================*/

const SHA256 = require('crypto-js/sha256');
const level = require('level');

const chainDB = './chaindata';
const db = level(chainDB);
const DB_HEIGHT = "CHAIN_HEIGHT";
const INIT_CHAIN_HEIGHT = parseInt(0);


/* ===== Block Class ==============================
|  Class with a constructor for block 			   |
|  ===============================================*/

class Block {
    constructor(data) {
        this.hash = "";
        this.height = INIT_CHAIN_HEIGHT;
        this.body = data;
        this.time = 0;
        this.previousBlockHash = "";
    }
}

class CheckRetValue {
    constructor(height, check) {
        this.height = height;
        this.check = check;
    }
}

// Add data to levelDB with key/value pair
function addLevelDBData(key, value) {
    db.put(key, value, function (err) {
        if (err) return console.log('Block ' + key + ' submission failed', err);
    });
    db.put(DB_HEIGHT, key, function (err) {
        if (err) return console.log('DB_HEIGHT ' + key + ' failed. NOT increased', err);
    });
}

// Get data from levelDB with key
function getLevelDBData(key) {
    return new Promise(function (resolve, reject) {
        db.get(key, function (err, value) {
            if (err) {
                console.log('Block ' + key + ' not found!', err);
                reject(err);
            }
            resolve(value);
        });
    });
}

function addFailBlock(blockchain, newBlock) {

    return new Promise((resolve) => {
        blockchain.getBlockHeight().then(height => {

            newBlock.height = height;
            const previousHeight = newBlock.height - 1;

            newBlock.time = new Date().getTime().toString().slice(0, -3);
            newBlock.previousBlockHash = "11111";
            newBlock.hash = "4711"
            const jsonBlock = JSON.stringify(newBlock).toString();
            console.log(jsonBlock);
            addLevelDBData(newBlock.height, jsonBlock);
            resolve(newBlock);

        });
    });

}

/* ===== Blockchain Class ==========================
|  Class with a constructor for new blockchain 		|
|  ================================================*/

class Blockchain {
    constructor() {
        this.getBlockHeight().then(height => {

            if (height == 0) {
                console.log("INIT GENESIS BLOCK");
                let genesis = new Block("First block in the chain - Genesis block");
                genesis.time = new Date().getTime().toString().slice(0, -3);
                genesis.hash = SHA256(JSON.stringify(genesis)).toString();
                console.log(genesis);
                addLevelDBData(genesis.height, JSON.stringify(genesis).toString());
            }
        });

    }

    // Add new block
    addBlock(newBlock) {

        return new Promise((resolve, reject) => {
            this.getBlockHeight().then(height => {

                newBlock.height = height;
                const previousHeight = newBlock.height - 1;

                newBlock.time = new Date().getTime().toString().slice(0, -3);
                if (newBlock.height > 0) {
                    this.getBlock(previousHeight).then(lastBlock => {
                        const previousBlock = JSON.parse(lastBlock);
                        newBlock.previousBlockHash = previousBlock.hash;
                        newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
                        const jsonBlock = JSON.stringify(newBlock).toString();
                        console.log(jsonBlock);
                        addLevelDBData(newBlock.height, jsonBlock);
                        resolve(newBlock);
                    }).catch((error) => {
                        console.log(error);
                        reject(error);
                    });
                } else {
                    reject("No Genesis Block set !");
                }
            });
        });

    }

// Get block height
    /* getBlockHeight() {

         return new Promise((resolve, reject) => {
             let currentHeight = 0;
             db.createReadStream().on('data', function (data) {
                 currentHeight++;
             }).on('error', function (err) {
                 return console.log('Unable to get block height', err);
                 reject(err);
             }).on('close', function () {
                 console.log('Found block height ' + currentHeight);
                 resolve(currentHeight);
             });
         })
     } */

// New Version suggestion of Coach
    getBlockHeight() {

        return new Promise(function (resolve) {
            db.get(DB_HEIGHT, function (err, value) {
                if (err) {
                    db.put(DB_HEIGHT, INIT_CHAIN_HEIGHT, function (err) {
                        if (err) return console.log('DB_HEIGHT ' + key + ' failed. NOT increased', err);
                    });
                    resolve(INIT_CHAIN_HEIGHT);
                } else {
                    const retValue = parseInt(value) + 1;
                    resolve(retValue);
                }
            });
        });

    }

// Get data from levelDB with key
    getBlock(key) {
        return new Promise(function (resolve, reject) {
            db.get(key, function (err, value) {
                if (err) {
                    console.log('Block ' + key + ' not found!', err);
                    reject(err);
                } else {
                    // console.log("getLevelDB DataValue: " + value);
                    resolve(value);
                }
            });
        });
    }

// validate block
    validateBlock(blockHeight) {
        return new Promise((resolve, reject) => {

            this.getBlock(blockHeight).then((block) => {
                let blockObj = JSON.parse(block);
                const blockHash = blockObj.hash;
                blockObj.hash = '';
                const validBlockHash = SHA256(JSON.stringify(blockObj)).toString();
                if (blockHash === validBlockHash) {
                    console.log('Block # ' + blockHeight + ' valid hash:\n' + blockHash);
                    resolve(new CheckRetValue(blockHeight, true));
                } else {
                    console.log('Block #' + blockHeight + ' invalid hash:\n' + blockHash + '<>' + validBlockHash);
                    resolve(new CheckRetValue(blockHeight, false));
                }
            }).catch((err) => {
                console.log('Error in getBlock at ValidateBlock() with Block ' + err);
                resolve(new CheckRetValue(blockHeight, false));
            });

        });
    }

    validatePreviousBlockHash(blockHeight, chainHeight) {
        return new Promise((resolve, reject) => {

            this.getBlock(blockHeight).then((block) => {
                let blockObj = JSON.parse(block);
                const blockHash = blockObj.hash;
                const nextHeight = blockHeight + 1;
                if (nextHeight < chainHeight) {

                    this.getBlock(nextHeight).then(nextBlock => {
                        let nextBlockObj = JSON.parse(nextBlock);
                        const previousBlockHash = nextBlockObj.previousBlockHash;
                        if (blockHash === previousBlockHash) {
                            console.log('Block # ' + blockHeight + ' valid previous hash:\n' + blockHash)
                            resolve(new CheckRetValue(blockHeight, true));
                        } else {
                            console.log('Block #' + blockHeight + ' invalid previous hash:\n' + blockHash + '<>'
                                + previousBlockHash);
                            resolve(new CheckRetValue(blockHeight, false));
                        }
                    }).catch((err) => {
                        console.log('Error in getBlock at validatePreviousBlockHash() with next Block ' + err);
                        resolve(new CheckRetValue(blockHeight, false));
                    });

                } else {
                    console.log('Last Block, no check for previousBlockHash possible!');
                    resolve(new CheckRetValue(blockHeight, true));
                }
            }).catch((err) => {
                console.log('Error in getBlock at validatePreviousBlockHash() with Block ' + err);
                resolve(new CheckRetValue(blockHeight, false));
            });


        });

    }

// Validate blockchain
    validateChain() {

        this.getBlockHeight().then(height => {

            let chainPromises = [];
            let errorLog = [];

            for (let i = 0; i < height; i++) {
                chainPromises.push(this.validateBlock(i));
                chainPromises.push(this.validatePreviousBlockHash(i, height));
            }

            Promise.all(chainPromises).then((results) => {

                for (let i in results) {
                    const result = results[i];
                    if (!Boolean(result.check)) {
                        const errorHeight = parseInt(result.height);
                        console.log("push error " + errorHeight);
                        errorLog.push(errorHeight);
                    }
                }

                // remove duplicate errors Block
                // e.g. validate Block false and validatePreviousBlockHash is false
                const uniqueErrorLogs = [...new Set(errorLog)];
                if (uniqueErrorLogs.length > 0) {
                    console.log('Block errors = ' + uniqueErrorLogs.length);
                    console.log('Blocks: ' + uniqueErrorLogs);
                } else {
                    console.log('No errors detected');
                }

            });
        });
    }
}


console.log("====================================================================");
console.log("TEST RUN");
console.log("====================================================================");

let blockchain = new Blockchain();

const LOOP_START = INIT_CHAIN_HEIGHT + 1;
const LOOP_END = 10;
const TIMEOUT_MS = 5000;

console.log("====================================================================");
console.log("ADD and check Blocks !");
console.log("====================================================================");
(function theLoop(i) {
    setTimeout(function () {
        let newBlock = new Block("Test Block " + i);

        console.log(" TEST RUN TRY ADD Block " + i + " - " + newBlock.body);
        blockchain.addBlock(newBlock).then(addBlock => {
            console.log(" TEST RUN Block #" + addBlock.height + " - " + addBlock.time + " added !");
            blockchain.validateBlock(addBlock.height).then(result => {
                if (result.check) {
                    console.log(Date.now + " TEST RUN Block #" + addBlock.height + " - " + addBlock.time + " is valid !");
                } else {
                    console.log(Date.now + "TEST RUN Block #" + addBlock.height + " - " + addBlock.time + " is not valid !");
                }

                i++;
                // End of ADD Section
                if (i < LOOP_END) {
                    theLoop(i);
                } else {
                    checkManipulteChain(blockchain);
                }
            });
        });

    }, TIMEOUT_MS);
})(LOOP_START);


/*
UNCOMMENT this to TEST BLOCK with wrong HASH and previous HASH.
PLEASE COMMENT the function theLoop for this test.


console.log("====================================================================");
console.log("ADD and Check FAIL Blocks !");
console.log("====================================================================");
(function theFailLoop(i) {
    setTimeout(function () {
        let newBlock = new Block("Test FAIL Block " + i);

        console.log(" TEST RUN TRY ADD FAIL Block " + i + " - " + newBlock.body);
        addFailBlock(blockchain, newBlock).then(addBlock => {
            console.log(" TEST RUN Block #" + addBlock.height + " - " + addBlock.time + " added !");

            i++;
            // End of ADD Section
            if (i < 5) {
                theFailLoop(i);
            } else {
                console.log("====================================================================");
                console.log("Validate FAIL Chain");
                console.log("====================================================================");
                console.log("Validate Chain");
                blockchain.validateChain();
            }
        });

    }, TIMEOUT_MS);
})(1);
*/

