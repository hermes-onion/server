const {  UsersModel } = require('../model')

const messageIsBlacklisted = require('./messageIsBlacklisted')
const sendSMS = require('./sendSMS')
const getDynEnv = require('./getDynEnv')


/**
 * Sends an SMS taking into account all the steps required to fulfil the action
 * 
 * @param {UsersModel} user_id
 * @param {json} body
 */
module.exports = (User, body)=>{
    return new Promise(async (accept, reject)=>{
        try {
            // check if there is enough credit
            if((User.balance - parseFloat(getDynEnv('sms_price'))) < 0) {
                return reject(["insufficient funds"])
            }

            // check if message is blacklisted
            if (await messageIsBlacklisted(body)){
                return reject(["message contains blacklisted phrases"])
            }

            // pass request to the micromodule
            sendSMS({...body, ...{user_id: User.id}})
            .then(async ()=>{
                await User.update({
                    balance: User.balance - parseFloat(getDynEnv('sms_price')),
                })

                accept()
            } )
            .catch(r=> reject(r))
        } catch(e) { reject(e) }
    })
}