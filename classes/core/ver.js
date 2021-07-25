
const axios = require('axios');

class Ver {
    constructor(endPoint){
        this.endPoint = endPoint;
    }

    async log(ver,nsEnabled,odEnabled,sEnabled,rEnabled,pEnabled) {
        axios
            .post(this.endPoint, {
                "version" : ver,
                "nsEnabled" : nsEnabled,
                "odEnabled" : odEnabled,
                "sEnabled" : sEnabled,
                "rEnabled" : rEnabled,
                "pEnabled" : pEnabled
            })
            .then(res => {
                console.log('=======================================================');
                //console.log(res)
            })
            .catch(error => {
                // console.error(error)
            })
    }
}
module.exports = Ver;