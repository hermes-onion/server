//process.env.DEBUG="*"

const ProxyAgent = require('socks-proxy-agent')
const IO = require('socket.io-client')
const {totp} = require('otplib')
const log = require('../util/log')
const getXmrUsd = require('../util/getXmrUsd')
const UsersModel = require('../model/users')

totp.options = {
    digits: parseInt(process.env.TOTP_DIGITS),
    step: parseInt(process.env.TOTP_PERIOD),
}

// generates TOTP token
let token = ''
const generateTokenLoop = function(){
    token = totp.generate(Buffer.from(process.env.TOTP_SECRET, 'base64'))
    
    setTimeout(()=>{
        generateTokenLoop()
    }, process.env.TOTP_PERIOD)
}
generateTokenLoop()

// http agent used by IoClient
const Agent = new ProxyAgent(`socks://${process.env.TOR_SOCKS_HOST}`)

// Socketio client
const IoClient = new IO(`ws://${process.env.WINTER_HOST}`, {
    agent: Agent,
    extraHeaders: {
        authorization: `Bearer ${token }`
    },
    transports: ["websocket"],
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    pingInterval: 1000*5,
    pingTimeout: 1000*10,
})

console.log(`Winter connecting ${process.env.WINTER_HOST}...`)

IoClient.on('connect', async ()=>{
    console.log('Winter connected!')
})

IoClient.on('disconnect', ()=>{
    console.log('Winter disconnected!')
})

IoClient.on('error', (data)=>{
    console.log('Winter error', data)
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
        balance: User.balance + (await getXmrUsd() * (json['balance']['_d'][1] / 100000)),
        tx_list: User.tx_list.concat([json.txId]),
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
     * Retrieves the wallet address of an account from index
     * 
     * @param {int} account_index
     * @returns {Promise}
     */
    static getWalletOfAccount(account_index){
        return new Promise((accept, reject)=>{
            try {
                log('retrieving address...')

                IoClient.emit('get-address-of-account', account_index)
                IoClient.once('get-address-of-account-res', json=>{
                    if(json.success) {
                        log('address retrieved')
                        accept(json.address)
                    }
                    else throw new Error('winter error occurred')
                })

            } catch(e) {
                log(`could not retrieve address`)
                reject(e)
            }
        })
    }

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

                IoClient.emit('make-account', label)
                IoClient.once('make-account-res', json=>{
                    if(json.success) {
                        log(`account created, index: ${json.index}`)
                        accept(json.index)
                    }
                    else throw new Error('winter error occurred')
                })
            } catch(e) {
                log(`could not create account`)
                reject(e)
            }
        })
    }
}

module.exports = Winter