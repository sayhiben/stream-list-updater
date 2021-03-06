const {promisify} = require('util')
const fetch = require('node-fetch')
const {GoogleSpreadsheet} = require('google-spreadsheet')

const sleep = module.exports.sleep = promisify(setTimeout)

module.exports.doWithRetry = async function doWithRetry(func) {
  let result
  let tries = 0
  while (tries < 2) {
    try {
      return await func()
    } catch (err) {
      if (err.response && err.response.status === 429) {
        console.log('ratelimited. waiting 10s...')
        await sleep(10000)
        tries++
        continue
      } else {
        throw err
      }
    }
  }
  return await func()
}

const getStreamType = module.exports.getStreamType = function getStreamType(urlStr) {
  let url
  try {
    url = new URL(urlStr)
  } catch (err) {
    console.warn('invalid url', urlStr)
    return
  }

  let {host} = url
  host = host.replace(/^www\./, '')

  if (host === 'youtube.com' || host === 'youtu.be') {
    return 'YouTube'
  } else if (host === 'facebook.com' || host === 'm.facebook.com') {
    return 'Facebook'
  } else if (host === 'twitch.tv') {
    return 'Twitch'
  } else if (host === 'periscope.tv' || host === 'pscp.tv') {
    return 'Periscope'
  } else if (host === 'instagram.com') {
    return 'Instagram'
  }
}

module.exports.getLinkInfo = async function getLinkInfo(url) {
  const streamType = getStreamType(url)
  if (streamType === 'Twitch') {
    const channelName = url.split('twitch.tv/')[1]
    const embed = `https://player.twitch.tv/?channel=${channelName}&parent=twitch.tv`
    return {streamType, channelName, embed}
  } else if (streamType === 'YouTube') {
    const videoID = url.startsWith('https://youtu.be') ? url.split('youtu.be/')[1] : url.split('v=')[1]
    const embed = `https://www.youtube.com/embed/${videoID}?autoplay=1`
    return {streamType, videoID, embed}
  } else if (streamType === 'Facebook') {
    let resp = await fetch(url, {redirect: 'manual'})
    while (resp.status === 302) {
      const dest = resp.headers.get('location')
      if (dest.startsWith('https://www.facebook.com/login.php')) {
        break
      }
      resp = await fetch(dest, {redirect: 'manual'})
    }
    const normalizedURL = resp.url
    const embed = `https://www.facebook.com/plugins/video.php?href=${normalizedURL}`
    return {streamType, embed, normalizedURL}
  }
  return {streamType}
}

module.exports.getSheetTab = async function getSheetTab(creds, sheetID, tabName) {
  const doc = new GoogleSpreadsheet(sheetID)
  await doc.useServiceAccountAuth(creds)
  await doc.loadInfo()
  const sheet = Object.values(doc.sheetsById).find(s => s.title === tabName)
  await sheet.loadHeaderRow()
  return sheet
}
