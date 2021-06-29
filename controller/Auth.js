const {AuthSchema} = require('../schemas')
const {t, redir, ApiKey, makeCaptcha, getDynEnv} = require('../util')
const {UsersModel, ApiThrottlesModel} = require('../model')
const {winter} = require('../server')

const Argon2 = require('argon2')
const Captcha = require('svg-captcha')
const {svg2png} = require('svg-png-converter')

module.exports = {
    async loginForm(req, res, next){
        try {
            let C = makeCaptcha()

            req.session.captcha_log = C.text

            res.send(t('login', {
                captcha_log: await svg2png({
                    input: C.svg,
                    format: 'png',
                    encoding: 'base64',
                })
            }))
        } catch(e) {next(e)}
    },

    /*
    *   login user
    */
    async login(req, res, next){
        try {
            // validate request body
            let values = AuthSchema.Login.validate(req.body)
            if(values.error){
                throw new Error(values.error.details[0].message)
            }

            const {username, password, captcha_log} = req.body

            // check if captcha is good
            // checkup only for prod
            if(req.session.captcha_log !== captcha_log && process.env.ENV !== 'dev')
                throw new Error("Invalid recaptcha. Please retry. Note it's case-sensitive!")

            // get user
            let User = await UsersModel.findOne({
                where:{ username},
                attributes:['id', 'username', 'password', 'suspended'],
            })

            if( User && await Argon2.verify(User.password, password) ){
                if(User.suspended) 
                    throw new Error("Account is banned")
                else {
                    req.session.user_id = User.id
                    redir(res, "/")                
                }
            }
            else {
                throw new Error("Invalid username or password.")
            }

        }catch(e){
            let C = makeCaptcha()

            req.session.captcha_log = C.text
    
            res.send(t('login', {
                captcha_log: await svg2png({
                    input: C.svg,
                    format: 'png',
                    encoding: 'base64',
                }),
                errors: e.message,
            }))
        }
    },

    async logout(req, res, next){
        delete req.session["user_id"];
        return redir(res, '/auth/login')
    },

    /**
     * Shows registration form
     * 
     * @param {*} req 
     * @param {*} res 
     */
    async regForm(req, res, next){
        try {
            let C = makeCaptcha(10)
            req.session.captcha_reg = C.text

            res.send(t('register', {
                captcha_reg: await svg2png({
                    input: C.svg,
                    format: 'png',
                    encoding: 'base64',
                })
            }))

        } catch(e){next(e)}

    },

    /*
    *   register user
    */
    async register (req, res){
        try {

        // validate request body
        let values = AuthSchema.Register.validate(req.body)
        if(values.error){
            throw new Error(values.error.details[0].message) 
        }
        
        const {username, password, captcha_reg} = req.body

        // check if captcha is good
        // checkup is for production
        if(req.session.captcha_reg !== captcha_reg && process.env.ENV !== 'dev')
            throw new Error("Invalid recaptcha. Please retry. Note it's &nbsp;<b>case-sensitive</b>.")

        // check if is allowed to register again
        // checkup is for production
        if(req.session.signup_count >= getDynEnv()['max_signup_per_session'] && process.env.ENV !== 'dev')
            throw new Error(`You can only register ${getDynEnv('max_signup_per_session')} time(s).`)

        // check if username is taken
        let User = await UsersModel.findOne({
            where: { username }
        })

        if(User){
            throw new Error("Username has already been taken.")
        } else {
            const account = await winter.makeAccount(username)

            User = await UsersModel.create({
                username,
                password: await Argon2.hash(password),
                apikeysalt: ApiKey.makeSalt(),
                winter_account: account.account_index,
                balance: getDynEnv('default_credit'),
                funding_address: account.address,
            })

            await ApiThrottlesModel.create({
                user_id: User.id,
            })

            req.session.signup_count++

            throw new Error("User created with success! You may now login.")
        }

        }catch(e){
            let C = makeCaptcha(10)
            req.session.captcha_reg = C.text
    
            res.send(t('register', {
                captcha_reg: await svg2png({
                    input: C.svg,
                    format: 'png',
                    encoding: 'base64',
                }),
                errors: e.message,
            }))
        }
    }
}
