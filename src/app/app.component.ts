import { Component } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { DomSanitizer} from "@angular/platform-browser"


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

export class AppComponent {
  title = 'Vybify';
  song: string;
  selectedSong: string;
  songNames: string[];
  playlistLink: string;

  profileUsername= 'User Name';
  website: string;
  constructor (private http: HttpClient, private sanitizer: DomSanitizer) {}
  showStuff = {
    search : true,
    playlist : false
  }

  ngOnInit(){
    this.song = "";
    this.songNames = [];
    this.playlistLink = "";
    console.log("ngInit");
  }
  searchSong(){
    let templist = [];
    if (this.song !== ""){
      fetch(`/search?search=${this.song}`)
      .then(function (response){
        return response.json();
      })
      .then(function (tracks){
        tracks = tracks.tracks;
        for (let i = 0; i < tracks.length; i++){
          let songLayout = tracks[i].name + ' by ' + tracks[i].artist;
          templist.push(songLayout);
        }
      })

      this.songNames = templist;
    }
  }
  generatePlaylist(){
    let id ="";
    if (this.selectedSong !== 'null'){
      let song = this.selectedSong;
      let songArray = song.split(" by ");

      fetch('/playlist?song=' + encodeURIComponent(songArray[0]) + '&artist=' + encodeURIComponent(songArray[1]))
      .then(function (response){
        return response.json();
      }).then(function (response){
        id="https://open.spotify.com/embed/playlist/" + response.playlistId;
        document.getElementById("url").innerHTML = id;
      })

    }

    this.showStuff.search = false;
    this.showStuff.playlist = true;
  }

  logout(){
    this.showStuff.search = false;
    this.showStuff.playlist = false;
  }
  goBack(){
    this.showStuff.search = true;
    this.showStuff.playlist = false;
    window.location.reload();
  }

  getEmbededURL(){
    let link = document.getElementById("url").innerHTML;
    return this.sanitizer.bypassSecurityTrustResourceUrl(link);
  }
}
