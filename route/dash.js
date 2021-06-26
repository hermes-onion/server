const {DashController, AuthController} = require('../controller')
const {mustBeAdmin, validateSchema, checkApiThrottle} = require('../middleware')
const { OpenTicketSchema, SendTicketMessage } = require('../schemas')
const apiSendSMS = require('../schemas/apiSendSMS')
const BodyParser = require('body-parser')

/*
*   handles dashboard related operations
*/
module.exports = require('express').Router()
    .get('/', DashController.showFront)

    // account related
    .get('/logout', AuthController.logout)
    .get('/regenerate-api', DashController.regenerateAPI)
    .post('/change-password', DashController.changePassword)
    
    .get('/account-information', DashController.showAccountInformation)
    .get('/account-information/fund', DashController.showFundAccount)
    .get('/account-information/change-password', DashController.showChangePassword)
    .get('/account-information/add-tofa', DashController.showAddTofaPage)
    .get('/account-information/del-account', DashController.showDelAccount)

    .get('/send-demo-sms', DashController.showDemoSMS)
    .get('/api-reference', DashController.showApiReference)
    .get('/sent-messages', DashController.showSentMessages)
    .post('/send-sms',  DashController.sendSMS)

    .post('/del-account', DashController.delAccount)
    .post('/register-2fa', DashController.register2fa)
    .get('/unlink-2fa', DashController.unlink2fa)
    //

    // Tickets related
    .get('/tickets', DashController.getMyTickets)
    .get('/tickets/new', DashController.showMakeTicket)
    .get('/tickets/:ticket_id([0-9]+)', DashController.getTicketData)
    .get('/tickets/:ticket_id([0-9]+)/swap/:state([0-1]{1})', DashController.swapTicketState)
    .post('/tickets', validateSchema(OpenTicketSchema), DashController.openTicket)
    .post('/tickets/:ticket_id([0-9]+)/message', validateSchema(SendTicketMessage), DashController.sendTicketMessage)
    //

    .use('/admin', mustBeAdmin, require('./dash-admin'))

