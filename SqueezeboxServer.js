const jayson = require('jayson/promise')
const Fuse = require('fuse.js')
const {find} = require('lodash')

module.exports = function SqueezeboxServer(props) {
  const {host, port, user, password} = props
  const auth = Buffer.from(`${user}:${password}`).toString('base64')
  const client = jayson.client.https({
    host,
    path: '/jsonrpc.js',
    version: 1,
    headers: {
      Authorization: `Basic ${auth}`,
    },
  })

  const ready = new Promise((resolve) => getPlayers().then(resolve))
  const defaultVolumeIncrement = 15

  let players

  function getPlayers() {
    return client
      .request('slim.request', [null, ['players', 0, 100]], null)
      .then(({result: {players_loop}}) => (players = players_loop))
  }

  function request({playerid, params}) {
    return ready.then(() => client.request('slim.request', [playerid, params], null))
  }

  function search(query, fields, list) {
    var options = {
      shouldSort: true,
      threshold: 0.6,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
      minMatchCharLength: 1,
      keys: fields,
    }

    var fuse = new Fuse(list, options) // "list" is the item array
    return fuse.search(query)
  }

  this.getCurrentPlayer = async () => find(await getPlayers(), 'isplaying')

  this.getPlayerByName = (name) => ready.then(() => search(name, ['name'], players)[0])

  this.play = ({playerid}) =>
    request({
      playerid,
      params: ['play'],
    })

  this.stop = ({playerid} = {}) =>
    ready.then(() =>
      Promise.all(
        (playerid ? [{playerid}] : players).map(({playerid}) =>
          request({
            playerid,
            params: ['stop'],
          })
        )
      )
    )

  this.getArtists = (start = 0, count = 1000, list = []) =>
    new Promise((resolve) =>
      request({playerid: null, params: ['artists', start, count]}).then(
        ({result: {artists_loop, count: totalArtists}}) => {
          list.push(...artists_loop)
          list.length < totalArtists
            ? this.getArtists(start + count, count, list).then((list) => resolve(list))
            : resolve(list)
        }
      )
    )

  this.playArtist = async (player, artistName) => {
    const [artist] = search(artistName, ['artist'], await this.getArtists())
    const {playerid} = player || (await this.getCurrentPlayer()) || {}

    if (playerid && artist) {
      request({playerid, params: ['playlist', 'shuffle', 1]})
      request({playerid, params: ['playlistcontrol', 'cmd:load', 'artist_id:' + artist.id]})
    }
  }

  this.volumeUp = ({playerid}, relativeLevel = defaultVolumeIncrement) =>
    request({playerid, params: ['mixer', 'volume', `+${relativeLevel}`]})

  this.volumeDown = ({playerid}, relativeLevel = defaultVolumeIncrement) =>
    request({playerid, params: ['mixer', 'volume', `-${relativeLevel}`]})

  this.mute = ({playerid}) => request({playerid, params: ['mixer', 'muting', 1]})
  this.unmute = ({playerid}) => request({playerid, params: ['mixer', 'muting', 0]})
}
