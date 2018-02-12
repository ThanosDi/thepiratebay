(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['exports', 'babel-runtime/core-js/promise', 'babel-runtime/regenerator', 'babel-runtime/helpers/asyncToGenerator', 'cheerio', 'isomorphic-fetch', 'url-parse', './PirateBay'], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require('babel-runtime/core-js/promise'), require('babel-runtime/regenerator'), require('babel-runtime/helpers/asyncToGenerator'), require('cheerio'), require('isomorphic-fetch'), require('url-parse'), require('./PirateBay'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.promise, global.regenerator, global.asyncToGenerator, global.cheerio, global.isomorphicFetch, global.urlParse, global.PirateBay);
    global.Parser = mod.exports;
  }
})(this, function (exports, _promise, _regenerator, _asyncToGenerator2, _cheerio, _isomorphicFetch, _urlParse, _PirateBay) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.getProxyList = undefined;
  exports._parseTorrentIsVIP = _parseTorrentIsVIP;
  exports._parseTorrentIsTrusted = _parseTorrentIsTrusted;
  exports.isTorrentVerified = isTorrentVerified;
  exports.parsePage = parsePage;
  exports.parseResults = parseResults;
  exports.parseTvShow = parseTvShow;
  exports.parseTorrentPage = parseTorrentPage;
  exports.parseTvShows = parseTvShows;
  exports.parseCategories = parseCategories;
  exports.parseCommentsPage = parseCommentsPage;

  var _promise2 = _interopRequireDefault(_promise);

  var _regenerator2 = _interopRequireDefault(_regenerator);

  var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

  var _cheerio2 = _interopRequireDefault(_cheerio);

  var _isomorphicFetch2 = _interopRequireDefault(_isomorphicFetch);

  var _urlParse2 = _interopRequireDefault(_urlParse);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  /* eslint promise/no-promise-in-callback: 0, max-len: [2, 200] */

  /**
   * Parse all pages
   * 
   */
  var maxConcurrentRequests = 10;

  function _parseTorrentIsVIP(element) {
    return element.find('img[title="VIP"]').attr('title') === 'VIP';
  }

  function _parseTorrentIsTrusted(element) {
    return element.find('img[title="Trusted"]').attr('title') === 'Trusted';
  }

  function isTorrentVerified(element) {
    return _parseTorrentIsVIP(element) || _parseTorrentIsTrusted(element);
  }

  var getProxyList = exports.getProxyList = function () {
    var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee() {
      var result, noDups, jsonStrResp, jsonResp, response, $, newLinks, links, compare;
      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              result = [];
              noDups = [];
              _context.next = 4;
              return (0, _isomorphicFetch2.default)('https://thepiratebay-proxylist.org/api/v1/proxies').then(function (res) {
                return res.text();
              });

            case 4:
              jsonStrResp = _context.sent;
              jsonResp = false;

              if (jsonStrResp) try {
                jsonResp = JSON.parse(jsonStrResp);
              } catch (e) {}

              if (jsonResp && jsonResp.proxies && jsonResp.proxies.length) {
                result = result.concat(jsonResp.proxies);
                jsonResp.proxies.forEach(function (el) {
                  noDups.push(el.domain);
                });
              }

              _context.next = 10;
              return (0, _isomorphicFetch2.default)('https://proxybay.one/').then(function (res) {
                return res.text();
              });

            case 10:
              response = _context.sent;
              $ = _cheerio2.default.load(response);
              newLinks = [];
              links = $(".speed").each(function () {
                if (parseFloat($(this).text())) {
                  var pUrl = $(this).parents('tr').find('.site a').attr('href');
                  var newLink = {
                    domain: pUrl.replace(/https?:\/\//i, ''),
                    country: $(this).parents('tr').find('.country img').attr('title').toUpperCase(),
                    secure: !!pUrl.startsWith('https://'),
                    speed: parseFloat($(this).text())
                  };
                  if (noDups.indexOf(newLink.domain) == -1) {
                    noDups.push(newLink.domain);
                    newLinks.push(newLink);
                  }
                }
              });


              if (newLinks && newLinks.length) result = result.concat(newLinks);

              if (result && result.length) {
                compare = function compare(a, b) {
                  if (a.speed < b.speed) return -1;
                  if (a.speed > b.speed) return 1;
                  return 0;
                };

                result.sort(compare);
              }

              return _context.abrupt('return', result);

            case 17:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, this);
    }));

    return function getProxyList() {
      return _ref.apply(this, arguments);
    };
  }();

  function parsePage(url, parseCallback) {
    var filter = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var method = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'GET';

    var _this = this;

    var formData = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
    var proxyUrls = arguments[5];

    var attempt = function () {
      var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2(error) {
        var options, requests, abandonFailedResponses, race;
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                if (error) console.log(error);

                if (!proxyUrls || !proxyUrls.length) proxyUrls = ['https://thepiratebay.org', 'https://pirateproxy.sh', 'https://thepiratebay.freeproxy.fun'];

                //  ^ 'https://thepbay.ga' also works, but sometimes has no results

                if (url.includes('/top/')) proxyUrls.splice(0, 1);

                options = {
                  mode: 'no-cors',
                  method: method,
                  body: formData
                };
                requests = proxyUrls.map(function (_url) {
                  return { domain: _url, href: new _urlParse2.default(url).set('hostname', new _urlParse2.default(_url).hostname).href };
                }).map(function (_url) {
                  return (
                    // $FlowFixMe - To avoid unnessary object type conversion, https://github.com/facebook/flow/issues/1606
                    (0, _isomorphicFetch2.default)(_url.href, options).then(function (response) {
                      return response.text();
                    }).then(function (body) {
                      return body.includes('502: Bad gateway') || body.includes('403 Forbidden') || body.includes('Database maintenance') || body.includes('Origin DNS error') ? _promise2.default.reject('Database maintenance, Cloudflare DNS error, 403 or 502 error') : _promise2.default.resolve({ from: _url.domain, body: body });
                    })
                  );
                });

                abandonFailedResponses = function abandonFailedResponses(index) {
                  var p = requests.splice(index, 1)[0];
                  p.catch(function () {});
                };

                race = function race() {
                  if (requests.length < 1) {
                    return _promise2.default.reject('None of the proxy requests were successful');
                  }
                  var indexedRequests = requests.map(function (p, index) {
                    return p.catch(function () {
                      throw index;
                    });
                  });
                  return _promise2.default.race(indexedRequests).catch(function (index) {
                    abandonFailedResponses(index);
                    return race(requests);
                  });
                };

                return _context2.abrupt('return', race(requests));

              case 8:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, _this);
      }));

      return function attempt(_x4) {
        return _ref2.apply(this, arguments);
      };
    }();

    return attempt().catch(function () {
      return attempt('Failed, retrying');
    }).then(function (response) {
      return parseCallback(response, filter);
    });
  }

  function parseResults() {
    var resultsObj = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var filter = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    if (resultsObj.body) {
      var resultsHTML = resultsObj.body;
      var resultsFrom = resultsObj.from;
    }
    var $ = _cheerio2.default.load(resultsHTML);
    var rawResults = $('table#searchResult tr:has(a.detLink)');

    var results = rawResults.map(function getRawResults() {
      var name = $(this).find('a.detLink').text();
      var uploadDate = $(this).find('font').text().match(/Uploaded\s(?:<b>)?(.+?)(?:<\/b>)?,/)[1];
      var size = $(this).find('font').text().match(/Size (.+?),/)[1];

      var seeders = $(this).find('td[align="right"]').first().text();
      var leechers = $(this).find('td[align="right"]').next().text();
      var relativeLink = $(this).find('div.detName a').attr('href');
      var link = _PirateBay.baseUrl + relativeLink;
      var partId = /^\/torrent\/(\d+)/.exec(relativeLink);
      var id = false;
      if (partId) {
        id = String(parseInt(partId[1], 10));
      }
      //    const id: string = String(parseInt(/^\/torrent\/(\d+)/.exec(relativeLink)[1], 10));
      var magnetLink = $(this).find('a[title="Download this torrent using magnet"]').attr('href');
      var uploader = $(this).find('font .detDesc').text();
      var uploaderLink = _PirateBay.baseUrl + $(this).find('font a').attr('href');
      var verified = isTorrentVerified($(this));

      var category = {
        id: $(this).find('center a').first().attr('href').match(/\/browse\/(\d+)/)[1],
        name: $(this).find('center a').first().text()
      };

      var subcategory = {
        id: $(this).find('center a').last().attr('href').match(/\/browse\/(\d+)/)[1],
        name: $(this).find('center a').last().text()
      };

      return {
        id: id,
        name: name,
        size: size,
        link: link,
        category: category,
        seeders: seeders,
        leechers: leechers,
        uploadDate: uploadDate,
        magnetLink: magnetLink,
        subcategory: subcategory,
        uploader: uploader,
        verified: verified,
        uploaderLink: uploaderLink
      };
    });

    var parsedResultsArray = results.get().filter(function (result) {
      return !result.uploaderLink.includes('undefined');
    });

    return filter.verified === true ? { from: resultsFrom, results: parsedResultsArray.filter(function (result) {
        return result.verified === true;
      }) } : { from: resultsFrom, results: parsedResultsArray };
  }

  function parseTvShow(tvShowPage) {
    var _this2 = this;

    var $ = _cheerio2.default.load(tvShowPage);
    var seasons = $('dt a').map(function () {
      return $(_this2).text();
    }).get();
    var rawLinks = $('dd');

    var torrents = rawLinks.map(function (element) {
      return $(_this2).find('a').map(function () {
        return {
          title: element.text(),
          link: _PirateBay.baseUrl + element.attr('href'),
          id: element.attr('href').match(/\/torrent\/(\d+)/)[1]
        };
      }).get();
    });

    return seasons.map(function (season, index) {
      return {
        title: season,
        torrents: torrents[index]
      };
    });
  }

  function parseTorrentPage(torrentPage) {
    var $ = _cheerio2.default.load(torrentPage);
    var name = $('#title').text().trim();

    var size = $('dt:contains(Size:) + dd').text().trim();
    var uploadDate = $('dt:contains(Uploaded:) + dd').text().trim();
    var uploader = $('dt:contains(By:) + dd').text().trim();
    var uploaderLink = _PirateBay.baseUrl + $('dt:contains(By:) + dd a').attr('href');
    var seeders = $('dt:contains(Seeders:) + dd').text().trim();
    var leechers = $('dt:contains(Leechers:) + dd').text().trim();
    var id = $('input[name=id]').attr('value');
    var link = _PirateBay.baseUrl + '/torrent/' + id;
    var magnetLink = $('a[title="Get this torrent"]').attr('href');
    var description = $('div.nfo').text().trim();

    return {
      category: '',
      name: name,
      size: size,
      seeders: seeders,
      leechers: leechers,
      uploadDate: uploadDate,
      magnetLink: magnetLink,
      link: link,
      id: id,
      description: description,
      uploader: uploader,
      uploaderLink: uploaderLink
    };
  }

  function parseTvShows(tvShowsPage) {
    var $ = _cheerio2.default.load(tvShowsPage);
    var rawTitles = $('dt a');
    var series = rawTitles.map(function (element) {
      return {
        title: element.text(),
        id: element.attr('href').match(/\/tv\/(\d+)/)[1]
      };
    }).get();

    var rawSeasons = $('dd');
    var seasons = rawSeasons.map(function (element) {
      return element.find('a').text().match(/S\d+/g);
    });

    return series.map(function (s, index) {
      return {
        title: s.title,
        id: s.id,
        seasons: seasons[index]
      };
    });
  }

  function parseCategories(categoriesHTML) {
    var $ = _cheerio2.default.load(categoriesHTML);
    var categoriesContainer = $('select#category optgroup');
    var currentCategoryId = 0;

    var categories = categoriesContainer.map(function getElements() {
      currentCategoryId += 100;

      var category = {
        name: $(this).attr('label'),
        id: '' + currentCategoryId,
        subcategories: []
      };

      $(this).find('option').each(function getSubcategory() {
        var subcategory = {
          id: $(this).attr('value'),
          name: $(this).text()
        };

        return category.subcategories.push(subcategory);
      });

      return category;
    });

    return categories.get();
  }

  function parseCommentsPage(commentsHTML) {
    var $ = _cheerio2.default.load(commentsHTML);

    var comments = $.root().contents().map(function getRawComments() {
      var comment = $(this).find('div.comment').text().trim();
      var user = $(this).find('a').text().trim();

      return {
        user: user,
        comment: comment
      };
    });

    return comments.get();
  }
});