/*
   Copyright 2014 Nebez Briefkani
   floppybird - main.js

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

var debugmode = false;

var states = Object.freeze({
   SplashScreen: 0,
   GameScreen: 1,
   ScoreScreen: 2,
   TitleScreen: 3,
});
var gameModes = Object.freeze({
   value: 0,
   derivative: 1,
   integral: 2,
   tap: 3,
});

var currentstate,currentGameMode;

var gravity = 0.25;
var velocity = 0;
var position = 180;
var rotation = 0;
var jump = -4.6;
var flyArea = $("#flyarea").height();

var score = 0;
var highscore = 0;

var pipeheight = 90;
var pipewidth = 52;
var pipes = new Array();

var replayclickable = false;

var Line = function(params,derivatives,integrals){
   var obj = {
      pairs: [],
      color: '#ff0000',
      name: 'line',
      dx: (derivatives > 0) ? new Line({name:'d'+(params['name'] || 'line')},derivatives - 1,0) : false,
      int: (integrals > 0) ? new Line({name:'int-'+(params['name'] || 'line')},0,integrals - 1) : false,
      add: function(x,y){
         //include derivative
         if(this.dx)
            this.dx.add(x,y - this.getValue());
         
         //include Integral
         if(this.int)
            this.int.add(x,y + this.int.getValue());
         
         this.pairs.push([x,y]);
         if(y < this.yMin)
            this.yMin = y;
         if(y > this.yMax)
            this.yMax = y;
         
         return this;
      },
      setValue: function(dx,y){
         return this.add(this.getValue(true) + dx, y);
      },
      increment: function(dx,dy){
         if(dy.constructor === this.constructor)
            dy = dy.getValue();
         return this.add(this.getValue(true) + dx, this.getValue() + dy);
      },
      getValue: function(returnX){
         //default returns Y
         if(this.pairs.length === 0)
            return 0; //if there are no values
         return this.pairs[this.pairs.length - 1][returnX ? 0 : 1];
      },
      draw: function(ctx){
         ctx.beginPath();
         
         ctx.strokeStyle = this.color;
         
         function adjustToScreen(value,that){
            //return the position that it should be on the screen
            return (value - that.yMin) / that.yMax * ctx.canvas.height;
         }
         
         if(this.pairs[0])
            ctx.moveTo(this.pairs[0][0],adjustToScreen(this.pairs[0][1],this));
         
         this.pairs.every(function(pair){
            return !ctx.lineTo(pair[0],adjustToScreen(pair[1],this));
         },this);
         ctx.stroke();
         ctx.closePath();
         
         return this;
      },
      printStatus: function(isChild){
         var str = this.name+":"+this.getValue();
         if(this.dx)  str += ', '+ this.dx.printStatus(true);
         if(this.int) str += ', '+this.int.printStatus(true);
         
         if(isChild)
            return str;
         console.log(str);
         return this;
      },
      clear: function(){
         this.pairs = [];
         if(this.dx)
            this.dx.clear();
         if(this.int)
            this.int.clear();
         return this;
      },
      yMin: 0,
      yMax: 0,
   };
   for(var param in params){
      obj[param] = params[param];
   }
   return obj;
};

$('slider').hide();
var inputHistory = new Line({},1),
    yHistory = new Line({}),
    time, inputRange,owner = false,i;
var Settings = {
   updateRate: {
      val: (function(){
         var val = localStorage.updateRate || 45;
         $('#updateRate').val(val);
         return val;
      })(),
      check: function(){
         this.val = $('#updateRate').val() || this.val;
         localStorage.updateRate = this.val + ''; //store it in the localStorage
         return this.val;
      }
   },
   sendFlaps: {
      val: (function(){
         var val = localStorage.sendFlaps ? localStorage.sendFlaps == 'true' : true;
         $("#altTap").prop('checked',val);
         return val;
      })(),
      check: function(){
         this.val = $('#altTap').is(':checked');
         localStorage.sendFlaps = this.val;
         return this.val;
      }
   },
   graphDomainSize: {
      val: (function(){
         var val = localStorage.graphDomainSize || 600;
         $("#graphDomainSize").val(val);
         return val;
      })(),
      check: function(){
         this.val = $('#graphDomainSize').val();
         localStorage.graphDomainSize = this.val;
         return this.val;
      }
   },
   check: function(){
      for(var prop in Settings)
         if(Settings[prop].check !== undefined){
            Settings[prop].check();
         }
      console.log('Updated variables from Settings');
      return true; //success
   }
};
function heavyWeight(input){
   if(input === 0)
      return 0;
   return Math.abs(input)/input;
}


//sounds
var volume = 30;
var soundJump = new buzz.sound("assets/sounds/sfx_wing.ogg");
var soundScore = new buzz.sound("assets/sounds/sfx_point.ogg");
var soundHit = new buzz.sound("assets/sounds/sfx_hit.ogg");
var soundDie = new buzz.sound("assets/sounds/sfx_die.ogg");
var soundSwoosh = new buzz.sound("assets/sounds/sfx_swooshing.ogg");
buzz.all().setVolume(volume);

//loops
var loopGameloop;
var loopPipeloop;

$(document).ready(function() {
   if(window.location.search == "?debug")
      debugmode = true;
   if(window.location.search == "?easy")
      pipeheight = 200;
   if(window.location.search == "?owner")
      owner = true;
      
   if(!owner)
      $("#settings").hide();
      
   $('#slider').hide();
   
   //get the highscore
   var savedscore = getCookie("highscore");
   if(savedscore != "")
      highscore = parseInt(savedscore);
   
   currentstate = states.TitleScreen;
});

function leaveTitleScreen(){
   console.log('Leaving TitleScreen');
   $('#title').fadeOut('slow',showSplash);
}

function getCookie(cname){
   var name = cname + "=";
   var ca = document.cookie.split(';');
   for(var i=0; i<ca.length; i++) 
   {
      var c = ca[i].trim();
      if (c.indexOf(name)==0) return c.substring(name.length,c.length);
   }
   return "";
}

function setCookie(cname,cvalue,exdays){
   var d = new Date();
   d.setTime(d.getTime()+(exdays*24*60*60*1000));
   var expires = "expires="+d.toGMTString();
   document.cookie = cname + "=" + cvalue + "; " + expires;
}

function showSplash(){
   currentstate = states.SplashScreen;
   
   //set the defaults (again)
   velocity = 0;
   position = 180;
   rotation = 0;
   score = 0;
   
   //update the player in preparation for the next game
   $("#player").css({ y: 0, x: 0});
   updatePlayer($("#player"));
   
   soundSwoosh.stop();
   soundSwoosh.play();
   
   //clear out all the pipes if there are any
   $(".pipe").remove();
   pipes = new Array();
   
   //hide the slider
   $('#slider').hide();
   
   //make everything animated again
   $(".animated").css('animation-play-state', 'running');
   $(".animated").css('-webkit-animation-play-state', 'running');
   
   //fade in the splash
   $("#splash").transition({ opacity: 1 }, 2000, 'ease');
}

function startGame(mode){
   if(currentstate !== states.SplashScreen)
      return; //we are already running 
   currentstate = states.GameScreen;
   
   //fade out the splash
   $("#splash").stop();
   $("#splash").transition({ opacity: 0 }, 500, 'ease');
      
   //initially read settings from div
   Settings.check();
   
    //configure game mode
    currentGameMode = mode;
    var slider = $('#slider');
   inputHistory.clear();
   yHistory.clear();
   History.clear();
   time = 0;
   inputRange = [0,1,0]; //[min,max,start]
    switch(currentGameMode){
        case gameModes.value: //function
            pipeheight = owner ? 200 : 70;
            inputRange = [0,flyArea,flyArea/2];
            break;
        case gameModes.derivative:
            pipeheight = 80;
            position = flyArea / 2;
            inputRange = [-300,300,0]
            break;
        case gameModes.integral:
            position = flyArea / 2;
            pipeheight = 100;
            inputRange = [-100,100,0];
            break;
         case gameModes.tap:
            pipeheight = 90;
            inputRange = [Settings.sendFlaps.val ? 0 : -50,100,0];
            playerJump(); //jump from the start!
            break;
         default:
            console.error('Faulty gameMode');
            return;
    }
   slider.attr('min',inputRange[0]).attr('max',inputRange[1]).val(inputRange[2]);
   localStorage.inputRange = JSON.stringify([Math.min(0,inputRange[0] - Math.abs(inputRange[0])/10),Math.max(flyArea,inputRange[1] + Math.abs(inputRange[0])/10)]);
      // ^^^^ always make sure that the flyArea is in the range of the graph
         // but expand it to include the range of the input
         // and add a buffer for asthetics
    if(currentGameMode !== gameModes.tap)
      slider.show();
   
   //update the big score
   setBigScore();
   
   //debug mode?
   if(debugmode)
   {
      //show the bounding boxes
      $(".boundingbox").show();
   }

   //start up our loops
   var updaterate = 1000.0 / 60.0 ; //60 times a second
   loopGameloop = setInterval(gameloop, updaterate);
   loopPipeloop = setInterval(updatePipes, 1400);
}

function updatePlayer(player){
   //rotation
   rotation = Math.min((velocity / 10) * 90, 90);
   
   //apply rotation and position
   $(player).css({ rotate: rotation, top: position });
}

function gameloop() {
   time++;
   var player = $("#player");
   
   var val = parseInt($('#slider').val());
   switch(currentGameMode){
      case gameModes.value:
         inputHistory.setValue(1,flyArea - val);
         position = val;
         i = inputHistory.dx.getValue();
         velocity = 0;
         /*
         if(i === 0 && velocity !== 0)
            velocity -= heavyWeight(velocity);
         else
            velocity = -i;
         console.log("i:",i,"velocity:",velocity);
         */
         break;
      case gameModes.derivative:
         inputHistory.setValue(1,-val);
         position -= inputHistory.dx.getValue();
         position -= heavyWeight(position - flyArea/2) / 2.5;
         velocity = 0;
         /*
         if(owner)
            velocity = -inputHistory.dx.getValue();
         */
         break;
      case gameModes.integral:
         //integral
         position += val / 100 * 3;
         velocity = val / 20;
         inputHistory.setValue(1,-val);
         break;
      case gameModes.tap:
         // update the player speed/position
         if(Settings.sendFlaps.val)
            inputHistory.setValue(1,velocity === jump ? 100 : 0); //if we just jumped, log 100, otherwise, log 0
         else
            inputHistory.setValue(1,-3 * velocity); //consider just logging the velocity
            
         velocity += gravity;
         position += velocity;
         break;
   }
   yHistory.setValue(1,flyArea - position);
   
   if(time % Settings.updateRate.val === 0){
      History.update(); //real time updates
   }
    
   //update the player
   updatePlayer(player);
   
   //create the bounding box
   var box = document.getElementById('player').getBoundingClientRect();
   var origwidth = 34.0;
   var origheight = 24.0;
   
   var boxwidth = origwidth - (Math.sin(Math.abs(rotation) / 90) * 8);
   var boxheight = (origheight + box.height) / 2;
   var boxleft = ((box.width - boxwidth) / 2) + box.left;
   var boxtop = ((box.height - boxheight) / 2) + box.top;
   var boxright = boxleft + boxwidth;
   var boxbottom = boxtop + boxheight;
   
   //if we're in debug mode, draw the bounding box
   if(debugmode){
      var boundingbox = $("#playerbox");
      boundingbox.css('left', boxleft);
      boundingbox.css('top', boxtop);
      boundingbox.css('height', boxheight);
      boundingbox.css('width', boxwidth);
   }
   
   //did we hit the ground?
   if(box.bottom >= $("#land").offset().top){
      playerDead();
      return;
   }
   
   //have they tried to escape through the ceiling? :o
   var ceiling = $("#ceiling");
   if(boxtop <= (ceiling.offset().top + ceiling.height()))
      position = 0;
   
   //we can't go any further without a pipe
   if(pipes[0] == null)
      return;
   
   //determine the bounding box of the next pipes inner area
   var nextpipe = pipes[0];
   var nextpipeupper = nextpipe.children(".pipe_upper");
   
   var pipetop = nextpipeupper.offset().top + nextpipeupper.height();
   var pipeleft = nextpipeupper.offset().left - 2; // for some reason it starts at the inner pipes offset, not the outer pipes.
   var piperight = pipeleft + pipewidth;
   var pipebottom = pipetop + pipeheight;
   
   if(debugmode)
   {
      var boundingbox = $("#pipebox");
      boundingbox.css('left', pipeleft);
      boundingbox.css('top', pipetop);
      boundingbox.css('height', pipeheight);
      boundingbox.css('width', pipewidth);
   }
   
   //have we gotten inside the pipe yet?
   if(boxright > pipeleft){
      //we're within the pipe, have we passed between upper and lower pipes?
      if(boxtop > pipetop && boxbottom < pipebottom)
      {
         //yeah! we're within bounds
         
      }
      else
      {
         //no! we touched the pipe
         playerDead();
         return;
      }
   }
   
   
   //have we passed the imminent danger?
   if(boxleft > piperight){
      //yes, remove it
      pipes.splice(0, 1);
      
      //and score a point
      playerScore();
   }
}

//Handle space bar
$(document).keydown(function(e){
   //space bar!
   if(e.keyCode == 32)
   {
      //in ScoreScreen, hitting space should click the "replay" button. else it's just a regular spacebar hit
      if(currentstate == states.ScoreScreen)
         $("#replay").click();
      else
         screenClick();
   }
});

//Handle mouse down OR touch start
if("ontouchstart" in window)
   $(document).on("touchstart", screenClick);
else
   $(document).on("mousedown", screenClick);

function screenClick(){
   if(currentstate == states.GameScreen){
      playerJump();
   }
   else if(currentstate == states.SplashScreen){
      return; //we can't start the game twice
      startGame();
   }else if(currentstate == states.TitleScreen){
      leaveTitleScreen();
   }
}

function playerJump(){
   if(currentGameMode !== gameModes.tap)
      return; //we only 'jump' while in jumping mode
   velocity = jump;
   //play jump sound
   soundJump.stop();
   soundJump.play();
}

function setBigScore(erase){
   var elemscore = $("#bigscore");
   elemscore.empty();
   
   if(erase)
      return;
   
   var digits = score.toString().split('');
   for(var i = 0; i < digits.length; i++)
      elemscore.append("<img src='assets/font_big_" + digits[i] + ".png' alt='" + digits[i] + "'>");
}

function setSmallScore(){
   var elemscore = $("#currentscore");
   elemscore.empty();
   
   var digits = score.toString().split('');
   for(var i = 0; i < digits.length; i++)
      elemscore.append("<img src='assets/font_small_" + digits[i] + ".png' alt='" + digits[i] + "'>");
}

function setHighScore(){
   var elemscore = $("#highscore");
   elemscore.empty();
   
   var digits = highscore.toString().split('');
   for(var i = 0; i < digits.length; i++)
      elemscore.append("<img src='assets/font_small_" + digits[i] + ".png' alt='" + digits[i] + "'>");
}

function setMedal(){
   var elemmedal = $("#medal");
   elemmedal.empty();
   
   if(score < 10)
      //signal that no medal has been won
      return false;
   
   if(score >= 10)
      medal = "bronze";
   if(score >= 20)
      medal = "silver";
   if(score >= 30)
      medal = "gold";
   if(score >= 40)
      medal = "platinum";
   
   elemmedal.append('<img src="assets/medal_' + medal +'.png" alt="' + medal +'">');
   
   //signal that a medal has been won
   return true;
}

function playerDead(){
   //update the rest of the graph
   History.update();
   
   //hide the slider
   $('#slider').hide();
   
   //stop animating everything!
   $(".animated").css('animation-play-state', 'paused');
   $(".animated").css('-webkit-animation-play-state', 'paused');
   
   //drop the bird to the floor
   var playerbottom = $("#player").position().top + $("#player").width(); //we use width because he'll be rotated 90 deg
   var floor = flyArea;
   var movey = Math.max(0, floor - playerbottom);
   $("#player").transition({ y: movey + 'px', rotate: 90}, 1000, 'easeInOutCubic');
   
   //it's time to change states. as of now we're considered ScoreScreen to disable left click/flying
   currentstate = states.ScoreScreen;

   //destroy our gameloops
   clearInterval(loopGameloop);
   clearInterval(loopPipeloop);
   loopGameloop = null;
   loopPipeloop = null;

   //mobile browsers don't support buzz bindOnce event
   if(isIncompatible.any())
   {
      //skip right to showing score
      showScore();
   }
   else
   {
      //play the hit sound (then the dead sound) and then show score
      soundHit.play().bindOnce("ended", function() {
         soundDie.play().bindOnce("ended", function() {
            showScore();
         });
      });
   }
}

var History = {
   savedToTime: 0,
   compatible: (typeof(Storage) !== "undefined"),
   save: function(){
      if (inputHistory.pairs.length === 0)
         return false;
      if (!this.compatible)
         return false;
         
      var primary = inputHistory.pairs,
         secondary = yHistory.pairs,
         data = [["Time","Input","Bird"]];
      
      for(var i=0;i<inputHistory.pairs.length;i++){
         data.push([primary[i][0],primary[i][1],secondary[i][1]]);
      }
      History.savedToTime = primary.length -1;
      localStorage.setItem('data',JSON.stringify(data));
      
      console.log('Saved the History');
      return true;
   },
   clear: function(){
      localStorage.setItem('newData','erase');
      History.savedToTime = 0;
      console.log('Cleared the History');
      return true;
   },
   update: function(){
      if(!this.compatible)
         return false;
      if(inputHistory.pairs.length <= History.savedToTime)
         return false;
         
      var primary = inputHistory.pairs,
         secondary = yHistory.pairs,
         newData = [];
      
      for(var i=History.savedToTime;i<inputHistory.pairs.length;i++){
         newData.push([primary[i][0],primary[i][1],secondary[i][1]]);
      }
      History.savedToTime = primary.length -1;
      localStorage.setItem('newData',JSON.stringify(newData));
      
      console.log('Updated the History');
      return true;
   },
   viewGraph: function(){
      if(!History.save())
         return false;
      window.open('graph.html');
   },
   
};

function showScore(){
   //unhide us
   $("#scoreboard").css("display", "block");
   
   //remove the big score
   setBigScore(true);
   
   //have they beaten their high score?
   if(score > highscore){
      //yeah!
      highscore = score;
      //save it!
      setCookie("highscore", highscore, 999);
   }
   
   //update the scoreboard
   setSmallScore();
   setHighScore();
   var wonmedal = setMedal();
   
   //SWOOSH!
   soundSwoosh.stop();
   soundSwoosh.play();
   
   //show the scoreboard
   $("#scoreboard").css({ y: '40px', opacity: 0 }); //move it down so we can slide it up
   $("#replay").css({ y: '40px', opacity: 0 });
   $("#scoreboard").transition({ y: '0px', opacity: 1}, 600, 'ease', function() {
      //When the animation is done, animate in the replay button and SWOOSH!
      soundSwoosh.stop();
      soundSwoosh.play();
      $("#replay").transition({ y: '0px', opacity: 1}, 600, 'ease');
      
      //also animate in the MEDAL! WOO!
      if(wonmedal)
      {
         $("#medal").css({ scale: 2, opacity: 0 });
         $("#medal").transition({ opacity: 1, scale: 1 }, 1200, 'ease');
      }
   });
   
   //make the replay button clickable
   replayclickable = true;
}

$("#replay").click(function() {
   //make sure we can only click once
   if(!replayclickable)
      return;
   else
      replayclickable = false;
   //SWOOSH!
   soundSwoosh.stop();
   soundSwoosh.play();
   
   //fade out the scoreboard
   $("#scoreboard").transition({ y: '-40px', opacity: 0}, 1000, 'ease', function() {
      //when that's done, display us back to nothing
      $("#scoreboard").css("display", "none");
      
      //start the game over!
      showSplash();
   });
});

function playerScore(){
   score += 1;
   //play score sound
   soundScore.stop();
   soundScore.play();
   setBigScore();
}

function updatePipes(){
   //Do any pipes need removal?
   $(".pipe").filter(function() { return $(this).position().left <= -100; }).remove()
   
   //add a new pipe (top height + bottom height  + pipeheight == flyArea) and put it in our tracker
   var padding = 80;
   var constraint = flyArea - pipeheight - (padding * 2); //double padding (for top and bottom)
   var topheight = Math.floor((Math.random()*constraint) + padding); //add lower padding
   var bottomheight = (flyArea - pipeheight) - topheight;
   var newpipe = $('<div class="pipe animated"><div class="pipe_upper" style="height: ' + topheight + 'px;"></div><div class="pipe_lower" style="height: ' + bottomheight + 'px;"></div></div>');
   $("#flyarea").append(newpipe);
   pipes.push(newpipe);
}

var isIncompatible = {
   Android: function() {
   return navigator.userAgent.match(/Android/i);
   },
   BlackBerry: function() {
   return navigator.userAgent.match(/BlackBerry/i);
   },
   iOS: function() {
   return navigator.userAgent.match(/iPhone|iPad|iPod/i);
   },
   Opera: function() {
   return navigator.userAgent.match(/Opera Mini/i);
   },
   Safari: function() {
   return (navigator.userAgent.match(/OS X.*Safari/) && ! navigator.userAgent.match(/Chrome/));
   },
   Windows: function() {
   return navigator.userAgent.match(/IEMobile/i);
   },
   any: function() {
   return (isIncompatible.Android() || isIncompatible.BlackBerry() || isIncompatible.iOS() || isIncompatible.Opera() || isIncompatible.Safari() || isIncompatible.Windows());
   }
};