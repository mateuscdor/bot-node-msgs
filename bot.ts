const makeWaSocket = require('@adiwajshing/baileys').default
const { getLinkPreview, getPreviewFromContent } = require("link-preview-js");
const { delay, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@adiwajshing/baileys')
const P = require('pino')
const { unlink, existsSync, mkdirSync, readFileSync } = require('fs')
var axios = require('axios');
const Path = './Sessions/'
const Auth = '_auth_info.json'
const { get } = require("https");

const express = require('express');
const { body, validationResult } = require('express-validator');
const app = express();

const http = require('http');
const server = http.createServer(app);

const port = process.env.PORT || 8000;

app.use(express.json());
app.use(express.urlencoded({
extended: true
}));
app.use("/", express.static(__dirname + "/"))


const BTNS = [
    { index: 1, quickReplyButton: {id: 'botao-1', displayText: 'CONTINUAR'} },
    { index: 2, quickReplyButton: {id: 'botao-2', displayText: 'SAIR'} },
    { index: 3, quickReplyButton: {displayText: 'This is a reply, just like normal buttons!', id: 'botao-1'}}
]

const BTNSQ = [
    { index: 1, quickReplyButton: {id: 'botao-sim', displayText: 'SIM'} },
    { index: 2, quickReplyButton: {id: 'botao-nao', displayText: 'NÃO'} }
]


const GroupCheck = (jid) => {
    const regexp = new RegExp(/^\d{18}@g.us$/)
    return regexp.test(jid)
}

const LinkCheck = (message) => {
    const link_regexp = new RegExp(/(([a-z]+:\/\/)?(([a-z0-9\-]+\.)+([a-z]{2}|aero|arpa|biz|com|coop|edu|gov|info|int|jobs|mil|museum|name|nato|net|org|pro|travel|local|internal))(:[0-9]{1,5})?(\/[a-z0-9_\-\.~]+)*(\/([a-z0-9_\-\.]*)(\?[a-z0-9+_\-\.%=&amp;]*)?)?(#[a-zA-Z0-9!$&'()*+.=-_~:@/?]*)?)(\s+|$)/gi)
    return link_regexp.exec(message)
}

const urlToBuffer = (url) => {
    return new Promise((resolve, reject) => {
        const data = [];
        get(url, (res) => {
        res
            .on("data", (chunk) => {
            data.push(chunk);
            })
            .on("end", () => {
            resolve(Buffer.concat(data));
            })
            .on("error", (err) => {
            reject(err);
            });
        });
    });
}
const Update = (sock) => {
    sock.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log('Qrcode: ', qr);
        };
        if (connection === 'close') {
            const Reconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
            if (Reconnect) Connection()
            console.log(`CONEXÃO FECHADA! RAZÃO: ` + DisconnectReason.loggedOut.toString());
            if (Reconnect === false) {
                const removeAuth = Path + Auth
                unlink(removeAuth, err => {
                    if (err) throw err
                })
            }
        }
        if (connection === 'open') {
            console.log('BOT ONLINE - CONECTADO')
        }
    })
}

const Connection = async () => {
    const { version, isLatest } = await fetchLatestBaileysVersion()
    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)
    if (!existsSync(Path)) {
        mkdirSync(Path, { recursive: true });
    }
    const { saveState, state } = useSingleFileAuthState(Path + Auth)
    const config = {
        auth: state,
        logger: P({ level: 'error' }),
        printQRInTerminal: true,
        version,
        connectTimeoutMs: 60_000,
        async getMessage(key) {
            return { conversation: 'botzg' };
        },
    }
    const sock = makeWaSocket(config);
    Update(sock.ev);
    sock.ev.on('creds.update', saveState);

    const SendMessage = async (jid, msg) => {
        await sock.presenceSubscribe(jid)
        await delay(1500)
        await sock.sendPresenceUpdate('composing', jid)
        await delay(1000)
        await sock.sendPresenceUpdate('paused', jid)
        return await sock.sendMessage(jid, msg)
    }

    const SendText = async (jid, msg) => {
        if (LinkCheck(msg)){
            const data_img = await getLinkPreview(msg)
            const image = await axios.get(data_img.images[0], {responseType: 'arraybuffer'})
            const forms = {
                forward: {
                    key: { fromMe: true },
                    message: {
                        extendedTextMessage: {
                            text: msg,
                            matchedText: LinkCheck(msg)[0],
                            canonicalUrl: data_img.url,
                            title: data_img.title,
                            description: data_img.description,
                            jpegThumbnail: Buffer.from(image.data, 'binary').toString('base64') //readFileSync('./assets/python.png')
                        }
                    }
                }
            }
            return await SendMessage(jid, forms)
        }
        return await SendMessage(jid, {text: msg})
    }

    app.post(
        '/send-text', 
        body('number').notEmpty(),
        body('message').notEmpty(),
        async (req, res) => {
            const errors = validationResult(req).formatWith(({ msg }) => { return msg })
            if (!errors.isEmpty()) {
                return res.status(422).json({
                    status: false,
                    message: errors.mapped()
                });
            }
            const number = req.body.number.toString();
            const numberDDI = number.substr(0, 2);
            const numberDDD = number.substr(2, 2);
            const numberUser = number.substr(-8, 8);
            const message = req.body.message;
            console.log(number)

            if (numberDDI !== "55") {
                if(parseInt(number) > 13){
                    const jid = `${number}@g.us`
                    SendText(jid, message)
                    .then(result => {
                        console.log(`RESULT send-text: ${result}`)
                        res.status(200).json({
                            status: true,
                            message: 'Mensagem enviada',
                            response: result
                        });
                    }).catch(err => {
                            console.log(`ERROR send-text: ${err}`)
                            res.status(500).json({
                                status: false,
                                message: 'Mensagem não enviada',
                                response: err.text
                            });
                        })
                }
                else {
                    const jid = `${number}@c.us`
                    SendText(jid, message)
                        .then(result => {
                            console.log(`RESULT send-text: ${result}`)
                            res.status(200).json({
                                status: true,
                                message: 'Mensagem enviada',
                                response: result
                            });
                        }).catch(err => {
                                console.log(`ERROR send-text: ${err}`)
                                res.status(500).json({
                                    status: false,
                                    message: 'Mensagem não enviada',
                                    response: err.text
                                });
                            })
                }
            }
            else if (numberDDI === "55" && parseInt(numberDDD) <= 30){
                const jid = `55${numberDDD}9${numberUser}@c.us`
                SendText(jid, message)
                    .then(result => {
                        console.log(`RESULT send-text: ${result}`)
                        res.status(200).json({
                            status: true,
                            message: 'Mensagem enviada',
                            response: result
                        });
                    }).catch(err => {
                            console.log(`ERROR send-text: ${err}`)
                            res.status(500).json({
                                status: false,
                                message: 'Mensagem não enviada',
                                response: err.text
                            });
                        })
            }
            else if(numberDDI === "55" && parseInt(numberDDD) > 30){
                const jid = `55${numberDDD}${numberUser}@c.us`
                SendText(jid, message)
                    .then(result => {
                        console.log(`RESULT send-text: ${result}`)
                        res.status(200).json({
                            status: true,
                            message: 'Mensagem enviada',
                            response: result
                        });
                    }).catch(err => {
                            console.log(`ERROR send-text: ${err}`)
                            res.status(500).json({
                                status: false,
                                message: 'Mensagem não enviada',
                                response: err.text
                            });
                        })
            }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        const msg = messages[0]
        const jid = msg.key.remoteJid
        const username = msg.pushName;
        const fromMe = msg.key.fromMe
        await sock.sendReadReceipt(msg.key.remoteJid, msg.key.participant, [msg.key.id])
        const regexp = new RegExp(/meu ovo/i);
        // console.log(`participant =========== ${msg.key.participant}`)
        if(msg.message.templateButtonReplyMessage){
            if(msg.message.templateButtonReplyMessage.selectedId === 'botao-sim'){
                SendText(jid, `ISSO MESMO`)
                    .then(result => console.log('RESULT: ', result))
                        .catch(err => console.log('ERROR: ', err))
            }
            else if(msg.message.templateButtonReplyMessage.selectedId === 'botao-nao'){
                SendText(jid, `MEU PAU`)
                    .then(result => console.log('RESULT: ', result))
                        .catch(err => console.log('ERROR: ', err))
            }
        }
        
        if(!msg || !msg.message || !msg.message.conversation){
            console.log("NULO")
        }
        else if(!GroupCheck(jid) && !fromMe && jid !== 'status@broadcast'){

        }
        else if(GroupCheck(jid)){
            console.log(`JID: ${jid}`)
            if(msg.message.conversation.toLowerCase() === 'contato_teste'){
                const vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n'+ 'FN:AAAAAA MEU OVO\n' + 'ORG:Meu OVO;\n' + 'TEL;type=CELL;type=VOICE;waid=000000000000:+00 00000 00000\n' + 'END:VCARD'
                const contact = { 
                    contacts: { 
                        displayName: 'MEU OVO', 
                        contacts: [{ vcard }] 
                    }
                }
                SendMessage(jid, contact)
                    .then(result => console.log('RESULT: ', result))
                        .catch(err => console.log('ERROR: ', err))
            }
            else if(msg.message.conversation.toLowerCase() === 'link_teste'){
                const text = "qualquer coisa https://www.facebook.com"
                SendText(jid, text)
                    .then(result => console.log('RESULT: ', result))
                        .catch(err => console.log('ERROR: ', err))
            }
            else if(regexp.test(msg.message.conversation.toLowerCase())){
                for (let index = 0; index < 5; index++) {
                    SendMessage(jid, { text: `ELE MESMO`, templateButtons: BTNSQ})
                        .then(result => console.log('RESULT: ', result))
                            .catch(err => console.log('ERROR: ', err))
                    await delay(1000)
                }
            }
        }
        
    })
    // sock.ev.on('messages.update', m => console.log(m))
	// sock.ev.on('message-receipt.update', m => console.log(m))
	// sock.ev.on('presence.update', m => console.log(m))
	// sock.ev.on('chats.update', m => console.log(m))
	// sock.ev.on('contacts.upsert', m => console.log(m))
    server.listen(port, function() {
        console.log('App running on *: ' + port);
    });
}

Connection()
