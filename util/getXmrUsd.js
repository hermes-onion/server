const axios = require('axios')

/**
 * Retrieves the exchange rate of XMRUSD pair.
 * Currently at Binance rate.
 * 
 * @returns {Promise} float
 */
module.exports = async ()=>{
    return new Promise((accept, reject)=>{
        axios.get('https://api.binance.com/api/v3/ticker/price?symbol=XMRUSDT')
        .then(res=>{
            accept(res.data.price)
        })
        .catch(err=>reject(err))
    })
}
