const fbbot = require('facebook-chat-api');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('comics.db');
const functions = require('./functions.js');
const crawl = require('./crawler.js');

const errLog = fs.createWriteStream('./error', {
    flags: 'a'
});

const mesLog = fs.createWriteStream('./mes', {
    flags: 'a'
});

const regYEE = new RegExp('YEE', 'i');

const jobs = [{
    name: 'FIND',
    reg: new RegExp('FIND', 'i'),
    func: functions.find
}, {
    name: 'ADD',
    reg: new RegExp('ADD', 'i'),
    func: functions.add
}, {
    name: 'DEL',
    reg: new RegExp('DEL', 'i'),
    func: functions.del
}, {
    name: 'LIST',
    reg: new RegExp('LIST', 'i'),
    func: functions.list
}, {
    name: 'CHECK',
    reg: new RegExp('CHECK', 'i'),
    func: functions.check
}];

db.serialize(function() {
    db.run('CREATE TABLE IF NOT EXISTS subscribes(' +
        'USER  TEXT NOT NULL,' +
        'TITLE TEXT NOT NULL,' +
        'NUM   REAL NOT NULL)');

    crawl.all(function(err, res) {
        if (err) {
            errLog.write('crawl.all error\n' + err);
        }

        login();
    });
});

function login() {
    fbbot({
        email: 'FB_ACCOUNT',
        password: 'FB_PASSWORD'
    }, function callback(err, api) {
        if (err) {
            errLog.write('login error\n' + err);
            return console.error(err);
        }

        setInterval(function() {
            functions.updateSubs(function(err, message, id) {
                console.log('send update ' + message + ' to ' + id);
                api.sendMessage(message, id);
            });
        }, 24 * 60 * 60 * 1000);

        api.setOptions({
            pageID: 'FB_FAN_PAGE_ID'
        });

        api.listen(function(err, message) {
            mainLoop(err, message, api);
        });
    });
}

function mainLoop(err, message, api) {
    if (err) {
        errLog.write('api.listen error\n' + err);
    }

    console.log(message);
    mesLog.write(JSON.stringify(message) + '\n');
    if (!message.body) {
        return;
    }

    var tokens = message.body.split(' ');

    if (!regYEE.test(tokens[0])) {
        console.log('not matched body: ' + message.body);
    } else {
        if (tokens.length == 1) {
            var chat = '用法\n' +
                'YEE FIND name\n' +
                'YEE ADD [name name ...]\n' +
                'YEE DEL [name name ...]\n' +
                'YEE LIST\n' +
                'YEE CHECK';

            api.sendMessage(chat, message.threadID);
        } else {
            jobs.forEach(function(entry) {
                if (entry.reg.test(tokens[1])) {
                    entry.func(tokens, message.senderID, function(err, res) {
                        if (err) {
                            errLog.write(entry.name + ' error\n' + err);
                            api.sendMessage(err, message.threadID);
                        } else {
                            api.sendMessage(res, message.threadID);
                        }
                    });
                }
            });
        }
    }
}