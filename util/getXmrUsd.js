const axios = require('axios')

/**
 * Retrieves the exchange rate of XMRUSD pair.
 * Currently at Bitfinex rate.
 * 
 * @returns {Promise} float
 */
module.exports = async ()=>{
    return new Promise((accept, reject)=>{
        axios.get('https://api.bitfinex.com/v1/pubticker/xmrusd')
        .then(res=>{
            accept(res.data.mid)
        })
        .catch(err=>reject(err))
    })
}