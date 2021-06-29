//process.env.DEBUG="*"

const ProxyAgent = require('socks-proxy-agent')
const IO = require('socket.io-client')
const log = require('../util/log')
const getXmrUsd = require('../util/getXmrUsd')
const UsersModel = require('../model/users')

// http agent used by IoClient
const Agent = new ProxyAgent(`socks://${process.env.TOR_SOCKS_HOST}`)

// Socketio client
const IoClient = new IO(`ws://${process.env.WINTER_HOST}`, {
    agent: Agent,
    extraHeaders: {
        authorization: `Bearer ${process.env.WINTER_SECRET}`
    },
    transports: ["websocket"],

    /**
     * crap settings. never worked as expected. gave up
     */
    reconnectionDelay: 50,
    reconnectionAttempts: Infinity,
    connectTimeout: 5000,
    pingInterval: 1000*5,
    pingTimeout: 1000*5,
})

console.log(`Winter connecting ${process.env.WINTER_HOST}...`)

IoClient.on('connect', async ()=>{
    console.log('Winter connected!')
})

IoClient.on('disconnect', ()=>{
    console.log('Winter disconnected!')
    IoClient.connect()
})


/**
 * Event in case a TX from an account of a user is confirmed
 */
IoClient.on('tx-confirmed', async json=>{
    log('tx received...', json)

    // get user model for account id
    const User = await UsersModel.findOne({
        where: {winter_account: json['account-index']},
        attributes: ['id', 'tx_list', 'balance'],
    })

    // txid must not be among txs received by user
    if(User.tx_list.includes(json.txId)) {
        log('tx already exists. skipping..')
        return
    }
    
    // finally update balance && tx_list
    await User.update({
        balance: User.balance + (await getXmrUsd() * (json.balance / 1000000000000)),
        tx_list: User.tx_list.concat([json.txId]),
        funding_address: json['new-funding-address'].address
    })
    log('balance && tx list updated!')
})

/**
 * Handles the websocket connection with wallet interface (Winter).
 * 
 * Winter is hosted via Tor on a separate server along with monero-wallet-rpc and monerod.
 */
class Winter {
    /**
     * Creates an account with a custom label and returns it's index
     * 
     * @param {string} label
     * @returns {Promise}
     */
    static makeAccount(label){
        return new Promise((accept, reject)=>{
            try {
                log('making account...')

                const rid = Math.floor(Math.random()*10000)

                IoClient.emit('make-account', {
                    label, rid
                })
                IoClient.once(`make-account-res-${rid}`, json=>{
                    if(json.success) {
                        log(`account created: ${json.account}`)
                        accept(json.account)
                    }
                    else throw new Error('winter error occurred')
                })
            } catch(e) {
                log(`could not create account`)
                reject(e)
            }
        })
    }
    
    /**
     * Returns primary address of account
     * 
     * @param {int} account_index 
     * @returns {Promise}
     */
    static getAccountAddress(account_index){
        return new Promise((accept, reject)=>{
            try {
                log('get address...')

                const rid = Math.floor(Math.random()*10000)

                IoClient.emit('get-account-address', {
                    account_index, rid
                })
                IoClient.once(`get-account-address-res-${rid}`, json=>{
                    if(json.success) {
                        log(`address retrieved`)
                        accept(json.address)
                    }
                    else throw new Error('winter error occurred')
                })
            } catch(e) {
                log(`could not get address`)
                reject(e)
            }
        })
    }
}

module.exports = Winter