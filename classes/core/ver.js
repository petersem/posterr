
const axios = require('axios');
const { promise } = require('ping');

class Ver {
    constructor(endPoint){
        this.endPoint = endPoint;
    }
    
    async log(uuid,ver,nsEnabled,odEnabled,sEnabled,rEnabled,pEnabled,bEnabled) {
        let logzRes = "";
        await axios
            .post(this.endPoint, {
                "version" : ver,
                "nsEnabled" : nsEnabled,
                "odEnabled" : odEnabled,
                "sEnabled" : sEnabled,
                "rEnabled" : rEnabled,
                "pEnabled" : pEnabled,
                "uuid": uuid
            })
            .then(res => {
                console.log("-------------------------------------------------------");
                logzRes = res.data;
                return Promise.resolve(logzRes);
            })
            .catch(error => {
                console.error('Failed checking for updates and alert messages. Please ensure https://logz.nesretep.net/pstr is not blocked.');
            },Promise.resolve(logzRes));
            return Promise.resolve(logzRes);
        }
}

module.exports = Ver;