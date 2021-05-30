var http = require("http");

if(process.env.BASEPATH=="/") process.env.BASEPATH="";
const BASEURL = process.env.BASEPATH || "";


var options = {  
    host : "localhost" + BASEURL,
    port : "3000",
    timeout : 2000
};

var request = http.request(options, (res) => {  
    console.log(`STATUS: ${res.statusCode}`);
    if (res.statusCode == 200) {
        process.exit(0);
    }
    else if (res.statusCode == 301) {
        process.exit(0);
    }
    else if (res.statusCode == 302) {
        process.exit(0);
    }
    else {
        process.exit(1);
    }
});

request.on('error', function(err) {  
    console.log('ERROR',err);
    process.exit(1);
});

request.end();  
