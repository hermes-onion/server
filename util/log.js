/**
* Logs output to console or other logging engines based on environment
* 
* @param {any} output
*/
module.exports = (...output)=>{
    if(process.env.ENV === "dev") {
        console.log(...output)
    }
}