const pg = require('pg');
let axios = require('axios');
let express = require('express');
const http = require('http');
const path = require('path');
let request = require('request'); // 'Request' library
let cors = require('cors');
let querystring = require('querystring');
let cookieParser = require('cookie-parser');
const env = require('./env.json');
const dbConnection = require('./db.json');
let client_id = env.client_id;
let client_secret = env.client_secret
let redirect_uri = 'http://localhost:3000/callback'; // Your redirect uri
let searchUrl = 'https://api.spotify.com/v1/search';
let attributesUrl = 'https://api.spotify.com/v1/audio-features/';
let recommendUrl = 'https://api.spotify.com/v1/recommendations';
let userIdUrl = 'https://api.spotify.com/v1/me';
let playlistUrl = 'https://api.spotify.com/v1/users/';
let addSongUrl = 'https://api.spotify.com/v1/playlists/';

// creates new connection pool
const Pool = pg.Pool;
const pool = new Pool(dbConnection);
pool.connect().then(function () {
    console.log('Connected!');
});

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
let generateRandomString = function(length) {
  let text = '';
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

let stateKey = 'spotify_auth_state';

const app = express();

let port = process.env.PORT || 3000;
let hostname = 'localhost';

app.use(express.json());
app.use(express.static(__dirname + '/dist/spotify-app'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  let state = generateRandomString(16);
  res.cookie(stateKey, state);
  // your application requests authorization
  let scope = 'user-read-private user-read-email playlist-modify-public playlist-modify-private playlist-read-collaborative playlist-read-private';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  let code = req.query.code || null;
  let state = req.query.state || null;
  let storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    let authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        let access_token = body.access_token;
        let refresh_token = body.refresh_token;
        let spotify_tokens = {
          access_token : access_token,
          refresh_token : refresh_token
        };
        res.cookie('spotify_tokens', spotify_tokens);
        /*
        let options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          console.log(body);
        });
        */
        res.redirect('/');
        // we can also pass the token to the browser to make requests from there
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  let refresh_token = req.query.refresh_token;
  let authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      let access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

// Finds top 5 songs of search text
app.get('/search', (req,res) => {
    let access_token = req.cookies['spotify_tokens'] ? req.cookies['spotify_tokens']['access_token'] : null;
    if (access_token === null) {
      res.redirect('/login');
    }

    let searchStr = req.query.search
    let url = searchUrl + `?q=${searchStr}`+'&type=track&market=US&limit=5';

    axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + access_token
      }
    }).then(function (response) {
        let tracksData = response.data.tracks;

        pool.query(
          `TRUNCATE TABLE spotifytracks RESTART IDENTITY;`
        ).then(function () {
          console.log('Deleted data from spotifytracks');
        }).then(function () {
          let tracksArr = [];

          for (let i = 0; i < tracksData.items.length; i++) {
            let songName = tracksData.items[i].name;
            let artist = tracksData.items[i].artists[0].name;
            let id = tracksData.items[i].id;

            pool.query(
              `INSERT INTO spotifytracks(song, artist, songid)
              VALUES($1, $2, $3)
              RETURNING *`,
              [songName, artist, id]
            ).then(function () {
              console.log('Stored track into db');
            }).catch(function (error) {
              console.log(error);
            });

            let trackObj = {'name': songName, 'artist': artist};
            tracksArr.push(trackObj);
          }

          let body = {'tracks': tracksArr};
          res.status(200).json(body);
        });

    }).catch(function (error) {
        console.log(error)
    });
});

// Generates playlist by attributes of selected song
app.get('/playlist', (req, res) => {
    let access_token = req.cookies['spotify_tokens'] ? req.cookies['spotify_tokens']['access_token'] : null;
    if (access_token === null) {
      res.redirect('/login');
    }

    let selectedSong = decodeURIComponent(req.query.song);
    let artistName = decodeURIComponent(req.query.artist);

    pool.query('SELECT songid FROM spotifytracks WHERE song = $1 AND artist = $2', [selectedSong, artistName]).then(function (response) {
      let songArr = response.rows;
      return songArr[0].songid;
    }).then(function(response) {
      let songid = response;

      let aurl = attributesUrl + songid;
      let rurl = recommendUrl;

      axios.get(aurl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + access_token
        }
      }).then(function (response) {
          let songAttributes = response.data;
          let key = songAttributes.key;
          let mode = songAttributes.mode;
          let acousticness = songAttributes.acousticness;
          let danceability = songAttributes.danceability;
          let energy = songAttributes.energy;
          let instrumentalness = songAttributes.instrumentalness;
          let liveness = songAttributes.liveness;
          let loudness = songAttributes.loudness;
          let speechiness = songAttributes.speechiness;
          let valence = songAttributes.valence;
          let tempo = songAttributes.tempo;
          let time_signature = songAttributes.time_signature;
          rurl += `?limit=10&market=US&seed_tracks=${songid}&target_acousticness=${acousticness}&target_danceability=${danceability}&target_energy=${energy}&target_instrumentalness=${instrumentalness}&target_key=${key}&target_liveness=${liveness}&target_loudness=${loudness}&target_mode=${mode}&target_speechiness=${speechiness}&target_tempo=${tempo}&target_time_signature=${time_signature}&target_valence=${valence}`

          axios.get(rurl, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + access_token
            }
          }).then(function (response) {
            let songsList = response.data.tracks;
            let playlist = [];
            for (let i = 0; i < songsList.length; i++) {
              playlist.push("spotify:track:" + songsList[i].id);
            }

            axios.get(userIdUrl, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + access_token
              }
            }).then(function(response) {
              let userId = response.data.id;
              let purl = playlistUrl + userId + '/playlists';

              axios.post(purl,
                {
                  'name': `Playlist for ${selectedSong}`
                },{
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + access_token
                }
              }).then(function(response) {
                let playlistId = response.data.id;
                let trackurl = addSongUrl + playlistId + '/tracks';

                axios.post(trackurl,
                  {
                    'uris': playlist
                  },{
                  headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + access_token
                  }
                }).then(function() {
                    console.log(`Generated playlist for ${selectedSong}`);
                    let playlistIdObject = {'playlistId': playlistId};
                    res.json(playlistIdObject);
                });

              });

            }).catch(function (error) {
                console.log(error)
            });


          }).catch(function (error) {
                console.log(error)
          });
      }).catch(function (error) {
          console.log(error)
      });

    }).catch(e => console.error(e.stack));
});

const server = http.createServer(app)

server.listen(port, hostname, () => {
    console.log(`Listening at: http://${hostname}:${port}`);
});
