const fs = require('fs');
const iconv = require('iconv-lite');
const request = require('request');
const cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('comics.db');

const rootURL = 'http://www.comicbus.com';

var crawl = function() {};

crawl.prototype.all = function(callback) {
    db.serialize(function() {
        db.run('DROP TABLE IF EXISTS comics');

        db.run('CREATE TABLE comics(' +
               'TITLE TEXT NOT NULL,' +
               'LINK  TEXT NOT NULL)');
    });

    request({
        url: rootURL + '/comic/all.html',
        encoding: null
    }, function(err, response, body) {
        if (err || response.statusCode != 200) {
            return callback(err, null);
        }

        var str = iconv.decode(new Buffer(body), 'big5');

        var $ = cheerio.load(str, {
            decodeEntities: false
        });

        var element =
            $('table')['2'] // table
            .children[1] // tr
            .children[5] // td
            .children[3] // table
            .children; // tr

        var list = [];

        var trCount = 0;
        for (var i=4; i<element.length; ++i) {
            if (element[i].name != 'tr') {
                continue;
            }

            if (trCount++ % 2) {
                continue;
            }
            // tr.td.table.trs
            var trs = element[i].children[0].children[3].children;
            for (var j=1; j<trs.length - 1; ++j) {
                var tds = trs[j].children;
                for (var k=1; k<tds.length - 1; ++k) {
                    if (tds[k].children[0]) {
                        var a = tds[k].children[0];

                        var title = a.children[0].data;
                        var index = title.indexOf('&#');
                        while (index != -1) {
                            title = title.substring(0, index) +
                                    String.fromCharCode(parseInt(title.substring(index+2, index+7))) +
                                    title.substring(index+8, title.length)
                            index = title.indexOf('&#');
                        }

                        list.push(title);
                        list.push(a.attribs.href);
                    }
                }
            }
        }

        db.serialize(function() {
            console.log(list.length / 2);

            var hop = 100;
            for (var i=0; i<list.length; i+=hop) {
                var slice = list.slice(i, Math.min(i+hop, list.length));
                var sql = prepareSQL(slice);
                db.run(sql, slice);
            }

            db.all('SELECT * FROM comics', function(error, res) {
                console.log(res.length + ' comics are in db');
                return callback(error, res);
            });
        });
    });
};

crawl.prototype.newestOf = function(link, callback) {
    request({
        url: rootURL + link,
        encoding: null
    }, function(err, response, body) {
        if (err || response.statusCode != 200) {
            return callback(err, null);
        }

        var str = iconv.decode(new Buffer(body), 'big5');

        var $ = cheerio.load(str, {
            decodeEntities: false
        });

        var element =
            $('table')['2'] // table
            .children[1] // tr
            .children[1] // td
            .children[0] // table
            .children[1] // tr
            .children[3] // td
            .children[2] // table
            .children[1] // tr
            .children[1] // td
            .children[0] // table
            .children[9] // tr
            .children[3] // td
            .children[0] // a
            .children[0] // tag
            .children[0] // b
            .children[0]; // text

        var num = element.data.split('-')[1];

        var id = link.substring(res.LINK.lastIndexOf('/') + 1, res.LINK.length);
        var viewLink = 'http://v.comicbus.com/online/comic-' + id + '?ch=' + num;

        return callback(null, num, viewLink);
    });
}

function prepareSQL(list) {
    var sql = 'INSERT INTO comics SELECT ? AS TITLE, ? AS LINK ';

    for (var i=2; i<list.length; i+=2) {
        sql += 'UNION SELECT ?, ? ';
    }

    return sql;
}

module.exports = new crawl();