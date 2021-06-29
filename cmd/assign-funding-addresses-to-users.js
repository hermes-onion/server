require('dotenv').config({
    path: `${__dirname}/../.env`
});

const Winter = require('../server/wallet-interface');
const UsersModel = require('../model/users');

(async ()=>{
    let Users = await UsersModel.findAll({
        attributes: [
            'id', 'username', 'winter_account'
        ]
    })
    console.log('got users')

    for await (const User of Users) {
        User.update({
            funding_address: await Winter.getAccountAddress(User.winter_account),
        })

        console.log('updated funding_address for user '+ User.username)
    }
})();
