const login = require('facebook-chat-api');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('comics.db');
const crawl = require('./crawler.js');

const errLog = fs.createWriteStream('./error', {
    flags: 'a'
});

const mesLog = fs.createWriteStream('./mes', {
    flags: 'a'
});

var regYEE = new RegExp('YEE', 'i');

var jobs = [{
    name: 'FIND',
    reg: new RegExp('FIND', 'i'),
    func: doFind
}, {
    name: 'ADD',
    reg: new RegExp('ADD', 'i'),
    func: doAdd
}, {
    name: 'DEL',
    reg: new RegExp('DEL', 'i'),
    func: doDel
}, {
    name: 'LIST',
    reg: new RegExp('LIST', 'i'),
    func: doList
}, {
    name: 'CHECK',
    reg: new RegExp('CHECK', 'i'),
    func: doCheck
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

        mainLoop();
    });
});

function mainLoop() {
    login({
        email: '',
        password: ''
    }, function callback(err, api) {
        if (err) {
            errLog.write('login error\n' + err);
            return console.error(err);
        }

        setInterval(function() {
            updateSubs(function(err, message, id) {
                api.sendMessage(message, id);
            });
        }, 24 * 60 * 60 * 1000);

        api.listen(function callback(err, message) {
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
        });
    });
}

function doFind(tokens, senderID, callback) {
    // YEE FIND NAME
    if (tokens.length < 3) {
        return callback(null, '沒有給參數');
    } else if (tokens.length > 3) {
        return callback(null, '只允許一個關鍵字');
    } else {
        db.all('SELECT * FROM comics', function(err, res) {
            if (err) {
                return callback(err, null);
            }

            var message = '';

            res.forEach(function(entry) {
                if (entry.TITLE.includes(tokens[2])) {
                    message += entry.TITLE + '\n';
                }
            });

            if (message) {
                return callback(null, message);
            } else {
                return callback(null, '沒有包含 \'' + tokens[2] + '\' 的漫畫');
            }

        });
    }
}

function doAdd(tokens, senderID, callback) {
    // YEE ADD NAME2 NAME3 ...
    if (tokens.length == 2) {
        return callback(null, '沒有給參數');
    }

    var temp = tokens.slice(2, tokens.length);
    var failed = [];
    var added = [];
    var duplicated = [];


    db.serialize(function() {
        var counter = tokens.length - 2;

        db.each('SELECT TITLE FROM subscribes WHERE USER=?', [senderID], function(err, res) {
            var index = temp.indexOf(res.TITLE)
            if (index != -1) {
                duplicated.push(res.TITLE);
                counter--;
                temp.splice(index, 1);
            }
        });

        db.all('SELECT * FROM comics', function(err, res) {
            if (err) {
                return callback(err, null);
            }

            temp.forEach(function(entry) {
                var search = res.filter(function(d) {
                    return d.TITLE == entry;
                });

                if (!search.length) {
                    failed.push(entry);
                    counter--;
                } else {
                    crawl.newestOf(search[0].LINK, function(err, res) {
                        if (!err) {
                            added.push(entry + '-' + res);
                            db.run('INSERT INTO subscribes VALUES (?,?,?)', [senderID, entry, res]);

                            counter--;
                            if (counter == 0) {
                                return callback(
                                    null,
                                    formatArray(duplicated, '重複') +
                                    formatArray(added, '成功') +
                                    formatArray(failed, '失敗'));
                            }
                        }
                    });
                }
            });
        });
    });
}

function doDel(tokens, senderID, callback) {
    // YEE DEL NAME2 NAME3 ...
    if (tokens.length == 2) {
        return callback(null, '沒有給參數');
    }

    var waiting = tokens.slice(2, tokens.length);
    var deleted = [];

    waiting.forEach(function(entry) {
        db.run('DELETE FROM subscribes WHERE USER=? AND TITLE=?', [senderID, entry]);
    });

    callback(null, 'DONE');
}

function doList(tokens, senderID, callback) {
    // YEE LIST
    if (tokens.length > 2) {
        return callback(null, '不能加參數');
    }

    db.all('SELECT TITLE,NUM FROM subscribes WHERE USER=?', [senderID], function(err, res) {
        var list = [];

        res.forEach(function(entry) {
            list.push(entry.TITLE + '-' + entry.NUM);
        });

        return callback(null, formatArray(list, '清單'));
    });
}

function doCheck(tokens, senderID, callback) {
    // YEE CHECK
    if (tokens.length > 2) {
        return callback(null, '不能加參數');
    }

    db.all('SELECT TITLE,NUM FROM subscribes WHERE USER=?', [senderID], function(err, resAll) {
        var counter = resAll.length;
        var message = '';

        resAll.forEach(function(entry) {
            db.get('SELECT LINK FROM comics WHERE TITLE=?', [entry.TITLE], function(err, res) {
                crawl.newestOf(res.LINK, function(err, num) {
                    if (num > entry.NUM) {
                        db.run('UPDATE subscribes SET NUM=? WHERE USER=? AND TITLE=?', [num, senderID, entry.TITLE]);

                        message += entry.TITLE + '更新到' + num + '啦\n';

                        var id = res.LINK.substring(res.LINK.lastIndexOf('/') + 1, res.LINK.length);
                        message += '連結： ' + 'http://v.comicbus.com/online/comic-' + id + '?ch=' + num + '\n';
                    }

                    if (--counter == 0) {
                        if (message.length) {
                            return callback(null, message);
                        } else {
                            return callback(null, '沒有更新');
                        }
                    }
                })
            });
        });
    });
}

function updateSubs(callback) {
    crawl.all(function(err, res) {
        if (err) {
            errLog.write('crawl.all error\n' + err);
        }

        db.all('SELECT * FROM subscribes', function(err, res) {
            var list = {};

            res.forEach(function(entry) {
                var obj = list[entry.TITLE];
                if (!obj) {
                    obj = {};
                    obj['subs'] = [];
                    list[entry.TITLE] = obj;
                }

                var sub = {
                    'id': entry.USER,
                    'num': entry.NUM
                };
                obj['subs'].push(sub);
            });

            getLinksOf(list, callback);
        });
    });
}

function getLinksOf(list, callback) {
    Object.keys(list).forEach(function(key) {
        db.get('SELECT LINK FROM comics WHERE TITLE=?', [key], function(err, res) {
            crawl.newestOf(res.LINK, function(err, num) {
                list[key].subs.forEach(function(entry) {
                    if (entry.num < num) {
                        db.run('UPDATE subscribes SET NUM=? WHERE USER=? AND TITLE=?', [num, entry.id, key]);

                        var id = res.LINK.substring(res.LINK.lastIndexOf('/') + 1, res.LINK.length);
                        var message = key + '更新到' + num + '啦\n'
                            + 'http://v.comicbus.com/online/comic-' + id + '?ch=' + num + '\n';
                        callback(null, message, entry.id);
                    }
                });
            });
        });
    });
}

// ------
// HELPER
// ------
function formatArray(arr, text) {
    var message = text + '： [';

    for (var i = 0; i < arr.length; ++i) {
        if (i > 0) {
            message += ', ';
        }

        message += arr[i];
    }

    if (arr.length == 0) {
        message += 'X';
    }

    message += ']\n';

    return message;
}