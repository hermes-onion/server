const {t, redir, ApiKey, deleteUser, log, sendSMSThread} = require('../util')
const { UsersModel, TicketChatModel, TicketsModel, SentMessagesModel, TofaTokens} = require('../model')
const {ChangePasswordSchema, apiSendSMS} = require('../schemas')
const {winter} = require('../server')

const {reg} = require('tofa-server-js')
const {CallForbidden, RequestFailed, CallTimedOut, BadURI, CallRejected} = require('tofa-server-js/src/errors')

const Argon2 = require('argon2')
const getDynEnv = require('../util/getDynEnv')
const getXmrUsd = require('../util/getXmrUsd')

/**
 * reusable method for current controllers set
 * 
 * @param {int} id 
 * @param {bool} getWallet 
 * @param {bool} getBalance 
 * @returns 
 */
const getUser = async (id, getWallet = false, getBalance = false)=>{
    const User = await UsersModel.findOne({
        where: {id},
        include: [{
            model:TofaTokens, 
            as: "tofa_token",
        }],
    })

    if(getWallet) User.winter_address = await winter.getWalletOfAccount(User.winter_account)
    if(getBalance) User.remaining_sms = Math.round(User.balance / getDynEnv('sms_price'))

    return User
}

module.exports = {
    /*
    *   shows the dashboard
    */
    async showFront(req, res, next){
        try {
            let User = await getUser(req.session.user_id, false, true)

            res.send( t('dash/accountInfo', {
                User,
                apiKey: ApiKey.generate(User),
            }) )
        } catch(e){ next (e)}
    },

    /*
    *   shows account information section
    */
    async showAccountInformation(req, res, next){
        try {
            let User = await getUser(req.session.user_id, false, true)
            
            res.send( t('dash/accountInfo', {
                User,
                apiKey: ApiKey.generate(User),
            }) )
        } catch(e){ next(e)}
    },

    /**
     * shows account funding page
     * 
     * @param {*} req 
     * @param {*} res 
     */
    async showFundAccount(req, res, next){
        try {
            let User = await getUser(req.session.user_id, true, true)
            
            res.send( t('dash/accountInfo/fund-account', {
                User,
                xmrusd: await getXmrUsd(),
                smsPrice: getDynEnv('sms_price'),
            }) )
        } catch(e){ next(e)}
    },

    /**
     * shows change password page
     */
    async showChangePassword(req, res, next){
        try {
            res.send( t('dash/accountInfo/change-password', {
               User: {id: req.session.user_id}
            }) )
        } catch(e){ next(e)}
    },

    /**
     * shows change password page
     */
    async showAddTofaPage(req, res, next){
        try {
            res.send( t('dash/accountInfo/add-tofa', {
               User: await getUser(req.session.user_id)
            }) )
        } catch(e){ next(e)}
    },

    /**
     * shows del account page
     */
     async showDelAccount(req, res, next){
        try {
            res.send( t('dash/accountInfo/del-account', {
               User: await getUser(req.session.user_id),
            }) )
        } catch(e){ next(e)}
    },

    /**
     *  Register 2FA with Tofa client
     */
    async register2fa(req, res){
        const routeRedir = "/dash/account-information/add-tofa"
        let User = {}

        try {
            User = await getUser(req.session.user_id)

            // attempt registration
            let auth_token = await reg(req.body.uri, {
                name: "Hermes Project",
                description: `Hermes wants to register with your Tofa Client for account with username "${User.username}"`
            })

            // destroy previous record
            await TofaTokens.destroy({
                where: {
                    user_id: User.id
                }
            })

            // make new record
            await TofaTokens.create({
                user_id: User.id,
                uri: req.body.uri,
                auth_token,
            })

            res.send( t('dash/accountInfo/add-tofa', {
                User,
                errors: ["2FA registered with success!"]
            }) )
        }catch(e){
            let message

            if(e instanceof BadURI)
                message = "Invalid URI! Please retry."
            if(e instanceof CallRejected)
                message = "Client denied registration!"
            if(e instanceof CallForbidden)
                message = "Client is already registered for another service!"
            if(e instanceof RequestFailed || e instanceof CallTimedOut)
                message = "Client is not reachable. Please try again."

            if(message === undefined) console.log(e)

            res.send( t('dash/accountInfo/add-tofa', {
                User,
                errors: [message === undefined ? "'Server error occurred. Please retry.'" : message]
            }) )
        }
    },

    /**
     *  Unlinks Tofa 2FA
     */
    async unlink2fa(req, res, next){
        try {
            // destroy previous record
            await TofaTokens.destroy({
                where: {
                    user_id: req.session.user_id
                }
            })

            res.send( t('dash/accountInfo', {
                User: await getUser(req.session.user_id),
                errors: ["2FA unlinked with success!"],
                apiKey: ApiKey.generate(User),
            }) )
        }catch(e){ next(e)}
    },

    /*
    *   shows the demo SMS page
    */
    async showDemoSMS(req, res, next){
        try {
            let User = await getUser(req.session.user_id)
            
            res.send( t('dash/sendDemoSMS', {
                apiKey: ApiKey.generate(User),
                User
            }) )
        } catch(e){ next(e)}
    },

    /*
    *   shows the api reference
    */
    async showApiReference(req, res, next){
        try {
            let User = await getUser(req.session.user_id)
            
            res.send( t('dash/apiRef', {
                apiKey: ApiKey.generate(User),
                User,
            }) )
        } catch(e){ next(e)}
    },


    /*
    *   regenerates the API key
    */
    async regenerateAPI(req, res){
        try {
            let User = await getUser(req.session.user_id, false, true)

            await User.update({
                apikeysalt: ApiKey.makeSalt()
            })

            res.send( t('dash/accountInfo', {
                apiKey: ApiKey.generate(User),
                User
            }) )
        } catch(e){
            console.log(e)
            res.send( t('dash/accountInfo', {
                apiKey: ApiKey.generate(User),
                User
            }) )
        }
    },

    /*
    *   changes account password
    */
    async changePassword(req, res){

        const routeRedir = "/dash/account-information/change-password"
        let User = {}

        try{
            // verifies req body
            let values = ChangePasswordSchema.validate(req.body)
            if( values.error) throw new Error(values.error.details[0]['message'])

            User = await getUser(req.session.user_id)

            if(await Argon2.verify(User.password, req.body.old_password))
            {
                await User.update({
                    password: await Argon2.hash(req.body.new_password)
                })

                throw new Error("Password changed!")
            }
            else 
                throw new Error("Old password is incorrect") 

       }catch(e){
           console.log(e)

           res.send( t('dash/accountInfo/change-password', {
            apiKey: ApiKey.generate(User),
            User,
            errors: e.message ? e.message : 'Server error occurred!'
        }) )
       }
    },

    /*
    *   retrieves all user's tickets
    */
    async getMyTickets(req, res, next){
        try {
            res.send( t('dash/tickets', {
                User: await getUser(req.session.user_id),
                tickets: await TicketsModel.findAll({
                    where:{ user_id: req.session.user_id },
                    order: [
                        [ 'closed', 'asc' ],
                        ['id', 'asc'],
                    ]
                })
            }) )
        } catch(e){ next(e)}
    },

    /*
    *   retrieve ticket data
    */
    async getTicketData(req, res){
        try {
            where = {}

            // in case it's admin
            if(req.session.user_id === 1)
                where = {id: req.params.ticket_id}
            else 
                where = { 
                    id: req.params.ticket_id, 
                    user_id: req.session.user_id,  
                }

            res.send( t('dash/ticketChat', {
                User: await getUser(req.session.user_id),
                Ticket: await TicketsModel.findOne({
                    where,
                    include:[{
                        model:TicketChatModel, 
                        as: "chat",
                        include: [{
                            model: UsersModel,
                            as: 'user',
                        }]
                    }],
                    order:[
                        [{ model: TicketChatModel, as: 'chat'}, 'id', 'asc']
                    ]
                })
            }) )
        } catch(e){ next(e)}
    },

    /*
    *   opens a new ticket
    */
    async openTicket(req, res, next){
        try {
            // make ticket
            let Ticket = await TicketsModel.create({
                user_id: req.session.user_id,
                topic: req.body.topic,
            })

            // make default message
            await TicketChatModel.create({
                ticket_id: Ticket.id,
                created_by: req.session.user_id,
                message: req.body.message,
            })

            // Done
            redir(res, `/dash/tickets`)
        } catch(e){ next(e)}
    },

    /*
    *   sends a ticket message 
    */
    async sendTicketMessage(req, res, next){
        try {
            where = {}

            // in case it's admin
            if(req.session.user_id === 1)
                where = {id: req.params.ticket_id}
            else 
                where = { 
                    id: req.params.ticket_id, 
                    user_id: req.session.user_id,  
                }

            // attempt to get ticket
            let Ticket = await TicketsModel.findOne({
                where,
            })

            // make message
            await TicketChatModel.create({
                ticket_id: Ticket.id,
                created_by: req.session.user_id,
                message: req.body.message,
            })

            // update seen states
            // attempt to get ticket
            Ticket.update({
                admin_read: req.session.user_id === 1 ? 1 : 0,
                user_read: req.session.user_id === 1 ? 0 : 1,
                closed: 0,
            })

            // Done
            redir(res, `/dash/tickets/${req.params.ticket_id}`)
        } catch(e){ next(e) }
    },

    /*
    *   opens/close ticket
    */
    async swapTicketState(req, res, next){
        try {
            where = {}

            // in case it's admin
            if(req.session.user_id === 1)
                where = {id: req.params.ticket_id}
            else 
                where = { 
                    id: req.params.ticket_id, 
                    user_id: req.session.user_id,  
                }

            // attempt to get ticket
            let Ticket = await TicketsModel.findOne({
                where,
            })
            
            // swap
            Ticket.update({
                closed: parseInt(req.params.state) > 0 ? true : false,
            })

            // Done
            if(req.session.user_id === 1)
                redir(res, `/dash/admin/tickets`)
            else
                redir(res, `/dash/tickets`)
        } catch(e){ next(e)}
    },

    /*
    *   delete account and all affiliated data
    */
    async delAccount(req, res, next){
        try {
            await deleteUser(req.session.user_id)
            delete req.session["user_id"]   // this dumb shit must be deleted manually
                                            // I know why i call it dumb shit

            redir(res, `/`)
        }catch(e){ next(e)}
    },

    /*
    *   shows the sent messages
    */
    async showSentMessages(req, res, next){
        try {
            let page = req.query.page === undefined || req.query.page < 2 ? 1 : parseInt(req.query.page)
            let nr = req.query.nr === undefined || req.query.nr < 1 ? 20 : parseInt(req.query.nr)

            res.send( t('dash/sentMessages', {
                User: await getUser(req.session.user_id),
                SentMessages: await SentMessagesModel.findAll({
                    where: { user_id: req.session.user_id },
                    order: [["id", 'desc']],
                    offset: page*nr-nr,
                    limit: nr,
                }),
                MessagesCount: await SentMessagesModel.count({
                    where: { user_id: req.session.user_id },
                }),
                page, nr,
            }) )
        }catch(e){ next(e)}
    },

    /**
     * Sends SMS
     * 
     * @param {*} req 
     * @param {*} res 
     * @param {*} next 
     */
    async sendSMS(req, res, next){
        try {
            const User = await getUser(req.session.user_id)

            // validate message
            const values = apiSendSMS.validate(req.body)
            if(values.error) {
                return res.send( t('dash/sendDemoSMS', {
                    apiKey: ApiKey.generate(User),
                    User,
                    errors: [values.error.details[0]['message']]
                }) )
            }

            // pass request to the micromodule
            sendSMSThread(User, req.body)
            .then(r=>{
                res.send( t('dash/sendDemoSMS', {
                    apiKey: ApiKey.generate(User),
                    User, 
                    errors: ['Message sent with success!']
                }) )
            })
            .catch(r=>{
                res.send( t('dash/sendDemoSMS', {
                    apiKey: ApiKey.generate(User),
                    User, 
                    errors: r
                }) )
            })
        } catch(e) {next(e)}
    },

    /**
     * Shows make-ticket view
     * 
     * @param {*} req 
     * @param {*} res 
     * @param {*} next 
     */
    async showMakeTicket(req, res, next){
        try {
            res.send( t('dash/tickets/make-ticket', {
                User:{id: req.session.user_id},
            }) )
        } catch(e){ next(e)}
    },
}
