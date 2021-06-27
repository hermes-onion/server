require('dotenv').config({
    path: `${__dirname}/../.env`
});

const Winter = require('../server/wallet-interface');
const UsersModel = require('../model/users');

(async ()=>{
    let Users = await UsersModel.findAll({
        attributes: [
            'id', 'username'
        ]
    })
    console.log('got users')

    for await (const User of Users) {
        User.update({
            winter_account: await Winter.makeAccount(User.username),
        })

        console.log('made acc for user'+ User.username)
    }
})();
