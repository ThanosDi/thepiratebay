/**
 * Parse all pages
 * @flow
 */
import cheerio from 'cheerio';
import fetch from 'node-fetch';
import UrlParse from 'url-parse';
import { baseUrl } from './PirateBay';


/* eslint promise/no-promise-in-callback: 0, max-len: [2, 200] */

const maxConcurrentRequests = 10;

type resultType = {
  id: string,
  name: string,
  size: string,
  link: string,
  category: string,
  seeders: string,
  leechers: string,
  uploadDate: string,
  magnetLink: string,
  subcategory?: string,
  uploader: string,
  verified?: string,
  uploaderLink: string
};

export function _parseTorrentIsVIP(element: Object): bool {
  return element
    .find('img[title="VIP"]')
    .attr('title') === 'VIP';
}

export function _parseTorrentIsTrusted(element: Object): bool {
  return element
    .find('img[title="Trusted"]')
    .attr('title') === 'Trusted';
}

export function isTorrentVerified(element: Object): bool {
  return _parseTorrentIsVIP(element) || _parseTorrentIsTrusted(element);
}

export async function getProxyList(): Promise<Array<string>> {

  var result = []
  var noDups = []

  const jsonStrResp = await fetch('https://thepiratebay-proxylist.org/api/v1/proxies').then(res => res.text());

  var jsonResp = false
  if (jsonStrResp)
	  try {
		  jsonResp = JSON.parse(jsonStrResp)
	  } catch(e) {}

  if (jsonResp && jsonResp.proxies && jsonResp.proxies.length) {
      result = result.concat(jsonResp.proxies)
	  jsonResp.proxies.forEach((el) => { noDups.push(el.domain) })
  }

  const response = await fetch('https://proxybay.one/').then(res => res.text());
  const $ = cheerio.load(response);

  var newLinks = []

  const links = $(".speed").each(function() {
	if (parseFloat($(this).text())) {
		const pUrl = $(this).parents('tr').find('.site a').attr('href')
		var newLink = {
			domain: pUrl.replace(/https?:\/\//i,''),
			country: $(this).parents('tr').find('.country img').attr('title').toUpperCase(),
			secure: !!pUrl.startsWith('https://'),
			speed: parseFloat($(this).text())
		}
		if (noDups.indexOf(newLink.domain) == -1) {
			noDups.push(newLink.domain)
			newLinks.push(newLink)
		}
	}
  })

  if (newLinks && newLinks.length)
  	result = result.concat(newLinks)

  if (result && result.length) {
	function compare(a,b) {
	  if (a.speed < b.speed) return -1
	  if (a.speed > b.speed) return 1
	  return 0
	}

	result.sort(compare);
  }

  return result;
}

type parseResultType = Array<resultType> | resultType;
type parseCallbackType = (resultsHTML: string, filter: Object) => parseResultType;

export function parsePage(url: string, parseCallback: parseCallbackType, filter: Object = {}, method: string = 'GET', formData: Object = {}, proxyUrls): Promise<parseResultType> {
  const attempt = async error => {
    if (error) console.log(error);

    if (!proxyUrls || !proxyUrls.length)
		proxyUrls = [
      'https://thepiratebay.org',
      'https://pirateproxy.sh',
      'https://thepiratebay.freeproxy.fun'
    ];

    //  ^ 'https://thepbay.ga' also works, but sometimes has no results

//    if (url.includes('/top/'))
//      proxyUrls.splice(0, 1);

    const options = {
      mode: 'no-cors',
      method,
//      body: formData,
      timeout: 15000
    };

    const requests = proxyUrls
      .map(_url => { return { domain: _url, href: (new UrlParse(url)).set('hostname', new UrlParse(_url).hostname).href } })
      .map(_url =>
        // $FlowFixMe - To avoid unnessary object type conversion, https://github.com/facebook/flow/issues/1606
        fetch(_url.href, options)
          .then(response => response.text())
          .then(body => (
            body.includes('502: Bad gateway') ||
            body.includes('403 Forbidden') ||
            body.includes('Database maintenance') ||
            body.includes('Origin DNS error') ||
            !body.includes('<title>The Pirate Bay')
              ? Promise.reject('Database maintenance, Cloudflare DNS error, 403 or 502 error')
              : Promise.resolve({from: _url.domain, body: body})
        )
      ));

    const abandonFailedResponses = index => {
      const p = requests.splice(index, 1)[0];
      p.catch(() => {});
    };

    const race = () => {
      if (requests.length < 1) {
        return Promise.reject('None of the proxy requests were successful');
      }
      const indexedRequests = requests.map((p, index) => p.catch(() => {
        throw index;
      }));
      return Promise.race(indexedRequests).catch(index => {
        abandonFailedResponses(index);
        return race(requests);
      });
    };
    return race(requests);
  };

  return attempt()
    .catch(() => attempt('Failed, retrying'))
    .then(response => parseCallback(response, filter));
}

export function parseResults(resultsObj: Object = {}, filter: Object = {}): Array<resultType> {
	if (resultsObj.body) {
		var resultsHTML = resultsObj.body
		var resultsFrom = resultsObj.from
	}
  const $ = cheerio.load(resultsHTML);
  const rawResults = $('#SearchResults table#searchResult tr:has(a.detLink)');

  const results = rawResults.map(function getRawResults() {
    const name: string = $(this).find('a.detLink').text();
    const uploadDate: string = $(this).find('font').text().match(/Uploaded\s(?:<b>)?(.+?)(?:<\/b>)?,/)[1];
    const size: string = $(this).find('font').text().match(/Size (.+?),/)[1];

    const seeders: string = $(this).find('td[align="right"]').first().text();
    const leechers: string = $(this).find('td[align="right"]').next().text();
    const relativeLink: string = $(this).find('div.detName a').attr('href');
    const link: string = baseUrl + relativeLink;
    var partId = /^\/torrent\/(\d+)/.exec(relativeLink)
    var id = false
    if (partId) {
      id = String(parseInt(partId[1], 10));
    }
//    const id: string = String(parseInt(/^\/torrent\/(\d+)/.exec(relativeLink)[1], 10));
    const magnetLink: string = $(this).find('a[title="PirateBay Proxy :Download this torrent using magnet"]').attr('href');
    const uploader: string = $(this).find('font .detDesc').text();
    const uploaderLink: string = baseUrl + $(this).find('font a').attr('href');
    const verified: bool = isTorrentVerified($(this));

    // const category = {
    //   id: $(this)
    //         .find('center a')
    //         .first()
    //         .attr('href')
    //         .match(/\/browse\/(\d+)/)[1],
    //   name: $(this).find('center a').first().text()
    // };
	//
    // const subcategory = {
    //   id: $(this)
    //         .find('center a')
    //         .last()
    //         .attr('href')
    //         .match(/\/browse\/(\d+)/)[1],
    //   name: $(this).find('center a').last().text()
    // };

    return {
      id,
      name,
      size,
      link,
      // category,
      seeders,
      leechers,
      uploadDate,
      magnetLink,
      // subcategory,
      uploader,
      verified,
      uploaderLink
    };
  });

  const parsedResultsArray =
    results
      .get()
      .filter(result => !result.uploaderLink.includes('undefined'));

  return filter.verified === true
     ? { from: resultsFrom, results: parsedResultsArray.filter(result => result.verified === true) }
     : { from: resultsFrom, results: parsedResultsArray };
}

type parseTvShowType = {
  title: string,
  torrents: Array<{
    title: string,
    link: string,
    id: string
  }>
};

export function parseTvShow(tvShowPage: string): Promise<Array<parseTvShowType>> {
  const $ = cheerio.load(tvShowPage);
  const seasons = $('dt a').map(() => $(this).text()).get();
  const rawLinks = $('dd');

  const torrents = rawLinks.map(element =>
    $(this).find('a').map(() => ({
      title: element.text(),
      link: baseUrl + element.attr('href'),
      id: element.attr('href').match(/\/torrent\/(\d+)/)[1]
    }))
    .get()
  );

  return seasons.map((season, index) => ({
    title: season,
    torrents: torrents[index]
  }));
}

export function parseTorrentPage(torrentPage: string): resultType {
  const $ = cheerio.load(torrentPage);
  const name = $('#title').text().trim();

  const size = $('dt:contains(Size:) + dd').text().trim();
  const uploadDate = $('dt:contains(Uploaded:) + dd').text().trim();
  const uploader = $('dt:contains(By:) + dd').text().trim();
  const uploaderLink = baseUrl + $('dt:contains(By:) + dd a').attr('href');
  const seeders = $('dt:contains(Seeders:) + dd').text().trim();
  const leechers = $('dt:contains(Leechers:) + dd').text().trim();
  const id = $('input[name=id]').attr('value');
  const link = `${baseUrl}/torrent/${id}`;
  const magnetLink = $('a[title="Get this torrent"]').attr('href');
  const description = $('div.nfo').text().trim();

  return {
    category: '',
    name,
    size,
    seeders,
    leechers,
    uploadDate,
    magnetLink,
    link,
    id,
    description,
    uploader,
    uploaderLink
  };
}

export function parseTvShows(tvShowsPage: string): Promise<resultType> {
  const $ = cheerio.load(tvShowsPage);
  const rawTitles = $('dt a');
  const series = rawTitles.map((element) => ({
    title: element.text(),
    id: element.attr('href').match(/\/tv\/(\d+)/)[1]
  }))
  .get();

  const rawSeasons = $('dd');
  const seasons = rawSeasons.map(element =>
    element.find('a').text().match(/S\d+/g)
  );

  return series.map((s, index) => ({
    title: s.title,
    id: s.id,
    seasons: seasons[index]
  }));
}

export function parseCategories(categoriesHTML: string): Array<resultType> {
  const $ = cheerio.load(categoriesHTML);
  const categoriesContainer = $('select#category optgroup');
  let currentCategoryId = 0;

  const categories = categoriesContainer.map(function getElements() {
    currentCategoryId += 100;

    const category = {
      name: $(this).attr('label'),
      id: `${currentCategoryId}`,
      subcategories: []
    };

    $(this).find('option').each(function getSubcategory() {
      const subcategory = {
        id: $(this).attr('value'),
        name: $(this).text()
      };

      return category.subcategories.push(subcategory);
    });

    return category;
  });

  return categories.get();
}

type parseCommentsPageType = {
  user: string,
  comment: string
};

export function parseCommentsPage(commentsHTML: string): Array<parseCommentsPageType> {
  const $ = cheerio.load(commentsHTML);

  const comments = $.root().contents().map(function getRawComments() {
    const comment = $(this).find('div.comment').text().trim();
    const user = $(this).find('a').text().trim();

    return {
      user,
      comment
    };
  });

  return comments.get();
}
