const Op = require('sequelize').Op
const {UsersModel, SentMessagesModel, TicketsModel} = require('../model')
const { DB } = require('../server')
const {t, redir, deleteUser} = require('../util')

module.exports = {

    /*
    *   shows all users paginated
    */
    async showUsers(req, res, next){
        try {
            let page = req.query.page === undefined || req.query.page < 2 ? 1 : parseInt(req.query.page)
            let nr = req.query.nr === undefined || req.query.nr < 1 ? 20 : parseInt(req.query.nr)

            const {username, suspended} = req.query
            let where = {}

            // If a lookup has been performed
            if(username !== undefined || suspended !== undefined)
            {
                where = [
                    {
                        username: {
                            [Op.like]: `%${username}%`
                        }
                    },
                    { suspended: suspended }
                ]
            }

            res.send(
                t('dash/admin/showUsers', {
                    Users: await UsersModel.findAll({
                        where,
                        order:[ ['id', 'DESC'] ],
                        limit: nr,
                        offset: page*nr-nr
                    }),

                    UsersCount: await UsersModel.count({
                        where,
                        order:[ ['id', 'DESC'] ],
                        limit: nr,
                        offset: page*nr-nr
                    }),
                    page, nr, username, suspended,
                    prev_loc:req.session.location_prev, 

                    User: {id: req.session.user_id},
                })
            )
        }catch(e){ next(e) }
    },


    /*
    *   shows all sent messages paginated
    */
    async showSentMessages (req, res, next) {
        try {
            let page = req.query.page === undefined || req.query.page < 2 ? 1 : parseInt(req.query.page)
            let nr = req.query.nr === undefined || req.query.nr < 1 ? 20 : parseInt(req.query.nr)

            const {user, sender, receipt,text} = req.query
            let where = {}

            // If a lookup has been performed
            if(user !== undefined || 
                sender !== undefined || 
                receipt !== undefined ||
                text !== undefined)
            {
                where = [
                    { sender: { [Op.like]: `%${sender}%` } },
                    { receipt: { [Op.like]: `%${receipt}%` } },
                    { text: { [Op.like]: `%${text}%` } },
                ]

                if(user !== undefined && user !== '') {
                    where.push({  "$user.username$": { [Op.like]: `%${user}%` } },)
                }
            }

            res.send(
                t('dash/admin/sentMessages', {
                    SentMessages: await SentMessagesModel.findAll({
                        where,
                        order:[ ['id', 'DESC'] ],
                        limit: nr,
                        offset: page*nr-nr,
                        include:[
                            {model:UsersModel, as: "user"}
                        ]
                    }),
                    MessagesCount: await SentMessagesModel.count({
                        where,
                        order:[ ['id', 'DESC'] ],
                        limit: nr,
                        offset: page*nr-nr,
                        include:[
                            {model:UsersModel, as: "user"}
                        ]
                    }),
                    page, nr, user, sender, receipt,text,
                    prev_loc:req.session.location_prev, 

                    User: {id: req.session.user_id},
                })
            )
        }catch(e){ next(e)}
    },

    /*
    *   swaps a user suspension (ban) state
    */
    async swapBanState(req, res, next) {
        try {
            const User = await UsersModel.findOne({
                where: { id: req.params.user_id },
                attributes: ['id', 'suspended'],
            })

            await User.update({
                suspended: !User.suspended
            })

            // Delete all related sessions from database
            if(User.suspended) {
                await DB.query(`
                    UPDATE sessions SET data = JSON_REMOVE(data, "$.user_id")
                    WHERE JSON_CONTAINS(data, "${User.id}", "$.user_id");
                `)
            }

            redir(res, req.session.location_prev)

        } catch(e){ next(e)}
    },

    /*
    *   returns all tickets from network
    */
    async getTickets(req, res){
        try {
           res.send( t('dash/tickets', {
               User: {id: req.session.user_id},
               tickets: await TicketsModel.findAll({
                order: [
                    [ 'closed', 'asc' ],
                    ['id', 'asc'],
                ]
            })
           })) 
        }catch(e){ next(e)}
    },

    /*
    *   delete account and all affiliated data
    */
    async delAccount(req, res, next){
        try {
            await deleteUser(req.params.user_id)

            redir(res, `/dash/admin/users`)
        }catch(e){ next(e)}
    },

    /**
     * Shows account deletion confirmation page for any user
     * 
     * @param {*} req 
     * @param {*} res 
     * @param {*} next 
     */
    async showDelAccount(req, res, next){
        try {
            res.send( t('dash/admin/showUsers/del-account', {
               User: {id: req.session.user_id},
               user_to_delete: req.params.user_id,
            }) )
        } catch(e){ next(e)}
    }
}
