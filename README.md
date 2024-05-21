# Vybify

Project was made in 2020. Transfered from Gitlabs to Github.

This project is intented to provide additional functionality beyond the default Spotify suggestions.
Specifically, this application will take the name of a provided song and generate a playlist of songs with a similar mood, tempo and key.

This project was created with [Angular CLI](https://github.com/angular/angular-cli) version 10.0.5.

## Building this project

You will need a postgres database with a table called "spotifytracks" that can be created using the following:
`CREATE TABLE spotifytracks(
    id SERIAL PRIMARY KEY,
    song VARCHAR(100),
    artist VARCHAR(100),
    songID VARCHAR(100)
);`

You will also need two files, db.json and env.json

db.json should include a json object with the keys user, host, database, and password with the appropriate values for the postgres database
as well as `"port": 5432`

{
    "user": "postgres",
    "host": "localhost",
    "database": "spotifytracks",
    "password": "YOUR PASSWORD HERE",
    "port": 5432
}

env.json will need the the keys client_id and client_secret which will both need the appropriate values from a registered Spotify application.
These can be created by registering an application from a Spotify Developer account.

{
    "client_id": "YOUR CLIENT ID HERE",
    "client_secret": "YOUR CLIENT SECRET HERE"
}

You will also need to add `http://localhost:3000/callback` to the Redirect URIs in the Spotify Developer Application settings.
This can be found on the developer dashboard: https://developer.spotify.com/dashboard

Run `npm install` in the spotify-web-app folder to install all dependencies in the package.json.
Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running this project

To run this project, run server.js with NodeJS and navigate to localhost:3000
If requests fail to appear, click the "Login" button to sign in with Spotify and recieve a token.