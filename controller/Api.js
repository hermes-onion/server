const {sendSMSThread} = require('../util')

module.exports = {

    /*
    *   sends message by token
    */
    sendByToken(req, res)
    {
        sendSMSThread(req._.User, req.body)
        .then(r=>res.send())
        .catch(err=>{
            res.status(422).send({
                message: err
            })
        })
    }

}
