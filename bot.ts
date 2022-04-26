const makeWaSocket = require('@adiwajshing/baileys').default
const { getLinkPreview, getPreviewFromContent } = require("link-preview-js");
const { delay, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@adiwajshing/baileys')
const P = require('pino')
const { unlink, existsSync, mkdirSync, readFileSync } = require('fs')
var axios = require('axios');
const Path = './Sessions/'
const Auth = '_auth_info.json'
const { get } = require("https");


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

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        const msg = messages[0]
        const jid = msg.key.remoteJid
        const username = msg.pushName;
        await sock.sendReadReceipt(msg.key.remoteJid, msg.key.participant, [msg.key.id])
        const regexp = new RegExp(/meu ovo/i);
        console.log(`participant =========== ${msg.key.participant}`)
        
        if(GroupCheck(jid)){
            if(msg.message){
                if(msg.message.conversation){
                    if(msg.message.conversation.toLowerCase() === 'contato_teste'){
                        const vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n'+ 'FN:ARAGÃO MEU OVO\n' + 'ORG:Meu OVO;\n' + 'TEL;type=CELL;type=VOICE;waid=000000000000:+00 00000 00000\n' + 'END:VCARD'
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
                        const data_img = await getLinkPreview("qualquer coisa https://www.google.com")
                        console.log(data_img)
                        const image = await axios.get(data_img.images[0], {responseType: 'arraybuffer'})
                        let raw = Buffer.from(image.data, 'binary').toString('base64')
                        console.log(raw)
                        const link_text = {
                            forward: {
                                key: { fromMe: true },
                                message: {
                                    extendedTextMessage: {
                                        text: 'qualquer coisa https://www.google.com',
                                        matchedText: data_img.url,
                                        canonicalUrl: data_img.url,
                                        title: data_img.title,
                                        description: data_img.description,
                                        jpegThumbnail: raw // readFileSync('./assets/python.png')
                                    }
                                }
                            }
                            // forward: {
                            //     key: { fromMe: true },
                            //     message: {
                            //         extendedTextMessage: {
                            //             text: text_msg,
                            //             matchedText: data_img.url,
                            //             canonicalUrl: data_img.url,
                            //             title: data_img.title,
                            //             description: data_img.description,
                            //             jpegThumbnail: data_img.images[0]
                            //         }
                            //     }
                            //     }
                        }
                        // getLinkPreview(text_msg)
                        //     .then((data) => console.debug(`\n\n\n\nDATA ======  ${data} ======== DATA\n\n\n\n`));
                        SendMessage(jid, link_text)
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
                    else if(msg.message.templateButtonReplyMessage.selectedId === 'botao-sim'){
                            SendMessage(jid, { text: `MEU PAU {}`})
                                .then(result => console.log('RESULT: ', result))
                                    .catch(err => console.log('ERROR: ', err))
                    }
                    else if(msg.message.templateButtonReplyMessage.selectedId === 'botao-nao'){
                        SendMessage(jid, { text: `MEU PAU {}`})
                            .then(result => console.log('RESULT: ', result))
                                .catch(err => console.log('ERROR: ', err))
                    }
                    else{
                        console.log("PASS")
                    }
                }
            }
        }
        
    })
    sock.ev.on('messages.update', m => console.log(m))
	sock.ev.on('message-receipt.update', m => console.log(m))
	sock.ev.on('presence.update', m => console.log(m))
	sock.ev.on('chats.update', m => console.log(m))
	sock.ev.on('contacts.upsert', m => console.log(m))
}

Connection()
