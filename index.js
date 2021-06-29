/*
*   all import
*/
const Express = require('express')
const Dotenv = require('dotenv'); Dotenv.config()
const Compress = require('compression')
const {sHttp, DB} = require('./server');
const {serverDown} = require('./middleware');
const tofaInit = require('tofa-server-js').init;

/*
*   all config
*/
(async ()=>{

    try {
        await DB.authenticate()
    } catch(e) {
        console.log("Could not connect to DB!", e)
    }

    tofaInit(process.env.TOR_SOCKS_HOST)

    process.env.NODE_ENV = 'production'

    const App = Express()
        App.disable('x-powered-by')
        App.disable('etag')
        App.use(serverDown)
        App.use(Compress())
        App.use('/', require('./route'))

        // handles errors
        App.use((err, req, res,next)=>{
            res.status(500).send("Error occurred. Please try again later.")
            console.log(err)
        })

        // App.use((req, res,next)=>{
        //     res.status(404).send("Not found.")
        // })

    const Server = sHttp(App)

    const {winter} = require('./server')
    // console.log(
    //     await winter.getWalletOfAccount( 4 )
    // )

    // once config is done, we can put our servers online
    Server.listen(process.env.LISTEN_PORT, ()=>{
        console.log(`Listening on :${process.env.LISTEN_PORT}`)
    }) 


})();

