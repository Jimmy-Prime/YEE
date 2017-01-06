const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('comics.db');
const crawl = require('./crawler.js');

const errLog = fs.createWriteStream('./error', {
    flags: 'a'
});

var functions = function() {};

functions.prototype.find = function(tokens, senderID, callback) {
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
};

functions.prototype.add = function(tokens, senderID, callback) {
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

functions.prototype.del = function(tokens, senderID, callback) {
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

functions.prototype.list = function(tokens, senderID, callback) {
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

functions.prototype.check = function(tokens, senderID, callback) {
    // YEE CHECK
    if (tokens.length > 2) {
        return callback(null, '不能加參數');
    }

    db.all('SELECT TITLE,NUM FROM subscribes WHERE USER=?', [senderID], function(err, resAll) {
        var counter = resAll.length;
        var message = '';

        resAll.forEach(function(entry) {
            db.get('SELECT LINK FROM comics WHERE TITLE=?', [entry.TITLE], function(err, res) {
                crawl.newestOf(res.LINK, function(err, num, viewLink) {
                    if (num > entry.NUM) {
                        db.run('UPDATE subscribes SET NUM=? WHERE USER=? AND TITLE=?', [num, senderID, entry.TITLE]);

                        message += entry.TITLE + '更新到' + num + '啦\n' + '連結： ' + viewLink + '\n';
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

functions.prototype.updateSubs = function(callback) {
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

// Helper
function getLinksOf(list, callback) {
    Object.keys(list).forEach(function(key) {
        db.get('SELECT LINK FROM comics WHERE TITLE=?', [key], function(err, res) {
            crawl.newestOf(res.LINK, function(err, num, viewLink) {
                list[key].subs.forEach(function(entry) {
                    if (entry.num < num) {
                        db.run('UPDATE subscribes SET NUM=? WHERE USER=? AND TITLE=?', [num, entry.id, key]);

                        var message = key + '更新到' + num + '啦\n' + '連結： ' + viewLink + '\n';
                        callback(null, message, entry.id);
                    }
                });
            });
        });
    });
}

function formatArray(arr, text) {
    var message = text + '： [';

    if (arr.length == 0) {
        message += 'X';
    } else {
        arr.forEach(function(entry) {
            message += ', ' + entry;
        });

        message = message.substring(0, message.length - 2);
    }

    message += ']\n';

    return message;
}

module.exports = new functions();