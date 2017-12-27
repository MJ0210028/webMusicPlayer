(function(window, undefined) {

'use strict';

var AudioPlayer = (function() {

  // Player vars!
  var
  docTitle = document.title,
  player   = document.getElementById('ap'),
  playBtn,
  playSvg,
  playSvgPath,
  prevBtn,
  nextBtn,
  plBtn,
  repeatBtn,
  volumeBtn,
  progressBar,
  preloadBar,
  curTime,
  durTime,
  trackTitle,
  audio,
  index = 0,
  playList,
  volumeBar,
  wheelVolumeValue = 0,
  volumeLength,
  repeating = false,
  seeking = false,
  seekingVol = false,
  rightClick = false,
  apActive = false,
  // playlist vars
  pl,
  plUl,
  plLi,
  tplList =
            '<li class="pl-list" data-track="{count}">'+
              '<div class="pl-list__track">'+
                '<div class="pl-list__icon"></div>'+
                '<div class="pl-list__eq">'+
                  '<div class="eq">'+
                    '<div class="eq__bar"></div>'+
                    '<div class="eq__bar"></div>'+
                    '<div class="eq__bar"></div>'+
                  '</div>'+
                '</div>'+
              '</div>'+
              '<div class="pl-list__title" style="font-family: Microsoft JhengHei;">{title}</div>'+
              '<button style="visibility: hidden;" class="pl-list__remove">'+
                '<svg fill="#000000" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">'+
                    '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>'+
                    '<path d="M0 0h24v24H0z" fill="none"/>'+
                '</svg>'+
              '</button>'+
            '</li>',
  // settings
  settings = {
    volume        : 0.5,
    changeDocTitle: true,
    confirmClose  : true,
    autoPlay      : true,
    buffered      : true,
    notification  : false,
    playList      : []
  };

  function init(options) {

    if(!('classList' in document.documentElement)) {
      return false;
    }

    if(apActive || player === null) {
      return 'Player already init';
    }

    settings = extend(settings, options);

    // get player elements
    playBtn        = player.querySelector('.ap__controls--toggle');
    playSvg        = playBtn.querySelector('.icon-play');
    playSvgPath    = playSvg.querySelector('path');
    prevBtn        = player.querySelector('.ap__controls--prev');
    nextBtn        = player.querySelector('.ap__controls--next');
    repeatBtn      = player.querySelector('.ap__controls--repeat');
    volumeBtn      = player.querySelector('.volume-btn');
    plBtn          = player.querySelector('.ap__controls--playlist');
    curTime        = player.querySelector('.track__time--current');
    durTime        = player.querySelector('.track__time--duration');
    trackTitle     = player.querySelector('.track__title');
    progressBar    = player.querySelector('.progress__bar');
    preloadBar     = player.querySelector('.progress__preload');
    volumeBar      = player.querySelector('.volume__bar');

    playList = settings.playList;

    playBtn.addEventListener('click', playToggle, false);
    volumeBtn.addEventListener('click', volumeToggle, false);
    repeatBtn.addEventListener('click', repeatToggle, false);

    progressBar.closest('.progress-container').addEventListener('mousedown', handlerBar, false);
    progressBar.closest('.progress-container').addEventListener('mousemove', seek, false);

    document.documentElement.addEventListener('mouseup', seekingFalse, false);

    volumeBar.closest('.volume').addEventListener('mousedown', handlerVol, false);
    volumeBar.closest('.volume').addEventListener('mousemove', setVolume);
    volumeBar.closest('.volume').addEventListener(wheel(), setVolume, false);

    prevBtn.addEventListener('click', prev, false);
    nextBtn.addEventListener('click', next, false);

    apActive = true;

    // Create playlist
    renderPL();
    plBtn.addEventListener('click', plToggle, true);

    plBtn.classList.toggle('is-active');
    pl.classList.toggle('h-show');

    // Create audio object
    audio = new Audio();
    audio.volume = settings.volume;
    audio.preload = 'auto';

    audio.addEventListener('error', errorHandler, false);
    audio.addEventListener('timeupdate', timeUpdate, false);
    audio.addEventListener('ended', doEnd, false);

    volumeBar.style.height = audio.volume * 100 + '%';
    volumeLength = volumeBar.css('height');

    if(settings.confirmClose) {
      window.addEventListener("beforeunload", beforeUnload, false);
    }

    if(isEmptyList()) {
      return false;
    }
    audio.src = playList[index].file;
    trackTitle.innerHTML = playList[index].title;

    if(settings.autoPlay) {
      audio.play();
      playBtn.classList.add('is-playing');
      playSvgPath.setAttribute('d', playSvg.getAttribute('data-pause'));
      plLi[index].classList.add('pl-list--current');
      notify(playList[index].title, {
        icon: playList[index].icon,
        body: 'Now playing'
      });
    }
  }

  function changeDocumentTitle(title) {
    if(settings.changeDocTitle) {
      if(title) {
        document.title = title;
      }
      else {
        document.title = docTitle;
      }
    }
  }

  function beforeUnload(evt) {
    if(!audio.paused) {
      var message = 'Music still playing';
      evt.returnValue = message;
      return message;
    }
  }

  function errorHandler(evt) {
    if(isEmptyList()) {
      return;
    }
    var mediaError = {
      '1': 'MEDIA_ERR_ABORTED',
      '2': 'MEDIA_ERR_NETWORK',
      '3': 'MEDIA_ERR_DECODE',
      '4': 'MEDIA_ERR_SRC_NOT_SUPPORTED'
    };
    audio.pause();
    curTime.innerHTML = '--';
    durTime.innerHTML = '--';
    progressBar.style.width = 0;
    preloadBar.style.width = 0;
    playBtn.classList.remove('is-playing');
    playSvgPath.setAttribute('d', playSvg.getAttribute('data-play'));
    plLi[index] && plLi[index].classList.remove('pl-list--current');
    changeDocumentTitle();
    throw new Error('Houston we have a problem: ' + mediaError[evt.target.error.code]);
  }

/**
 * UPDATE PL
 */
  function updatePL(addList) {
    if(!apActive) {
      return 'Player is not yet initialized';
    }
    if(!Array.isArray(addList)) {
      return;
    }
    if(addList.length === 0) {
      return;
    }

    var count = playList.length;
    var html  = [];
    playList.push.apply(playList, addList);
    addList.forEach(function(item) {
      html.push(
        tplList.replace('{count}', count++).replace('{title}', item.title)
      );
    });
    // If exist empty message
    if(plUl.querySelector('.pl-list--empty')) {
      plUl.removeChild( pl.querySelector('.pl-list--empty') );
      audio.src = playList[index].file;
      trackTitle.innerHTML = playList[index].title;
    }
    // Add song into playlist
    plUl.insertAdjacentHTML('beforeEnd', html.join(''));
    plLi = pl.querySelectorAll('li');
  }

/**
 *  PlayList methods
 */
    function renderPL() {
      var html = [];

      playList.forEach(function(item, i) {
        html.push(
          tplList.replace('{count}', i).replace('{title}', item.title)
        );
      });

      pl = create('div', {
        'className': 'pl-container',
        'id': 'pl',
        'innerHTML': '<ul class="pl-ul"><h3 style="font-size:16px;font-family:Microsoft JhengHei; margin-left:20px;">'+ document.getElementById('albumName').innerHTML +'</h3>' + (!isEmptyList() ? html.join('') : '<li class="pl-list--empty">PlayList is empty</li>') + '</ul>'
      });

      player.parentNode.insertBefore(pl, player.nextSibling);

      plUl = pl.querySelector('.pl-ul');
      plLi = plUl.querySelectorAll('li');

      pl.addEventListener('click', listHandler, false);
    }

    function listHandler(evt) {
      evt.preventDefault();

      if(evt.target.matches('.pl-list__title')) {
        var current = parseInt(evt.target.closest('.pl-list').getAttribute('data-track'), 10);
        if(index !== current) {
          index = current;
          play(current);
        }
        else {
          playToggle();
        }
      }
      else {
          if(!!evt.target.closest('.pl-list__remove')) {
            var parentEl = evt.target.closest('.pl-list');
            var isDel = parseInt(parentEl.getAttribute('data-track'), 10);

            playList.splice(isDel, 1);
            parentEl.closest('.pl-ul').removeChild(parentEl);

            plLi = pl.querySelectorAll('li');

            [].forEach.call(plLi, function(el, i) {
              el.setAttribute('data-track', i);
            });

            if(!audio.paused) {

              if(isDel === index) {
                play(index);
              }

            }
            else {
              if(isEmptyList()) {
                clearAll();
              }
              else {
                if(isDel === index) {
                  if(isDel > playList.length - 1) {
                    index -= 1;
                  }
                  audio.src = playList[index].file;
                  trackTitle.innerHTML = playList[index].title;
                  progressBar.style.width = 0;
                }
              }
            }
            if(isDel < index) {
              index--;
            }
          }

      }
    }

    function plActive() {
      if(audio.paused) {
        plLi[index].classList.remove('pl-list--current');
        return;
      }
      var current = index;
      for(var i = 0, len = plLi.length; len > i; i++) {
        plLi[i].classList.remove('pl-list--current');
      }
      plLi[current].classList.add('pl-list--current');
    }


/**
 * Player methods
 */
  function play(currentIndex) {

    if(isEmptyList()) {
      return clearAll();
    }

    index = (currentIndex + playList.length) % playList.length;

    audio.src = playList[index].file;
    trackTitle.innerHTML = playList[index].title;

    // Change document title
    changeDocumentTitle(playList[index].title);

    // Audio play
    audio.play();

    // Show notification
    notify(playList[index].title, {
      icon: playList[index].icon,
      body: 'Now playing',
      tag: 'music-player'
    });

    // Toggle play button
    playBtn.classList.add('is-playing');
    playSvgPath.setAttribute('d', playSvg.getAttribute('data-pause'));

    // Set active song playlist
    plActive();
  }

  function prev() {
    play(index - 1);
  }

  function next() {
    play(index + 1);
  }

  function isEmptyList() {
    return playList.length === 0;
  }

  function clearAll() {
    audio.pause();
    audio.src = '';
    trackTitle.innerHTML = 'queue is empty';
    curTime.innerHTML = '--';
    durTime.innerHTML = '--';
    progressBar.style.width = 0;
    preloadBar.style.width = 0;
    playBtn.classList.remove('is-playing');
    playSvgPath.setAttribute('d', playSvg.getAttribute('data-play'));
    if(!plUl.querySelector('.pl-list--empty')) {
      plUl.innerHTML = '<li class="pl-list--empty">PlayList is empty</li>';
    }
    changeDocumentTitle();
  }

  function playToggle() {
    if(isEmptyList()) {
      return;
    }
    if(audio.paused) {

      if(audio.currentTime === 0) {
        notify(playList[index].title, {
          icon: playList[index].icon,
          body: 'Now playing'
        });
      }
      changeDocumentTitle(playList[index].title);

      audio.play();

      playBtn.classList.add('is-playing');
      playSvgPath.setAttribute('d', playSvg.getAttribute('data-pause'));
    }
    else {
      changeDocumentTitle();
      audio.pause();
      playBtn.classList.remove('is-playing');
      playSvgPath.setAttribute('d', playSvg.getAttribute('data-play'));
    }
    plActive();
  }

  function volumeToggle() {
    if(audio.muted) {
      if(parseInt(volumeLength, 10) === 0) {
        volumeBar.style.height = settings.volume * 100 + '%';
        audio.volume = settings.volume;
      }
      else {
        volumeBar.style.height = volumeLength;
      }
      audio.muted = false;
      volumeBtn.classList.remove('has-muted');
    }
    else {
      audio.muted = true;
      volumeBar.style.height = 0;
      volumeBtn.classList.add('has-muted');
    }
  }

  function repeatToggle() {
    if(repeatBtn.classList.contains('is-active')) {
      repeating = false;
      repeatBtn.classList.remove('is-active');
    }
    else {
      repeating = true;
      repeatBtn.classList.add('is-active');
    }
  }

  function plToggle() {
    plBtn.classList.toggle('is-active');
    pl.classList.toggle('h-show');
  }

  function timeUpdate() {
    if(audio.readyState === 0 || seeking) return;

    var barlength = Math.round(audio.currentTime * (100 / audio.duration));
    progressBar.style.width = barlength + '%';

    var
    curMins = Math.floor(audio.currentTime / 60),
    curSecs = Math.floor(audio.currentTime - curMins * 60),
    mins = Math.floor(audio.duration / 60),
    secs = Math.floor(audio.duration - mins * 60);
    (curSecs < 10) && (curSecs = '0' + curSecs);
    (secs < 10) && (secs = '0' + secs);

    curTime.innerHTML = curMins + ':' + curSecs;
    durTime.innerHTML = mins + ':' + secs;

    if(settings.buffered) {
      var buffered = audio.buffered;
      if(buffered.length) {
        var loaded = Math.round(100 * buffered.end(0) / audio.duration);
        preloadBar.style.width = loaded + '%';
      }
    }
  }

  /**
   * TODO shuffle
   */
  function shuffle() {
    if(shuffle) {
      index = Math.round(Math.random() * playList.length);
    }
  }

  function doEnd() {
    if(index === playList.length - 1) {
      if(!repeating) {
        audio.pause();
        plActive();
        playBtn.classList.remove('is-playing');
        playSvgPath.setAttribute('d', playSvg.getAttribute('data-play'));
        return;
      }
      else {
        play(0);
      }
    }
    else {
      play(index + 1);
    }
  }

  function moveBar(evt, el, dir) {
    var value;
    if(dir === 'horizontal') {
      value = Math.round( ((evt.clientX - el.offset().left) + window.pageXOffset)  * 100 / el.parentNode.offsetWidth);
      el.style.width = value + '%';
      return value;
    }
    else {
      if(evt.type === wheel()) {
        value = parseInt(volumeLength, 10);
        var delta = evt.deltaY || evt.detail || -evt.wheelDelta;
        value = (delta > 0) ? value - 10 : value + 10;
      }
      else {
        var offset = (el.offset().top + el.offsetHeight) - window.pageYOffset;
        value = Math.round((offset - evt.clientY));
      }
      if(value > 100) value = wheelVolumeValue = 100;
      if(value < 0) value = wheelVolumeValue = 0;
      volumeBar.style.height = value + '%';
      return value;
    }
  }

  function handlerBar(evt) {
    rightClick = (evt.which === 3) ? true : false;
    seeking = true;
    !rightClick && progressBar.classList.add('progress__bar--active');
    seek(evt);
  }

  function handlerVol(evt) {
    rightClick = (evt.which === 3) ? true : false;
    seekingVol = true;
    setVolume(evt);
  }

  function seek(evt) {
    evt.preventDefault();
    if(seeking && rightClick === false && audio.readyState !== 0) {
      window.value = moveBar(evt, progressBar, 'horizontal');
    }
  }

  function seekingFalse() {
    if(seeking && rightClick === false && audio.readyState !== 0) {
      audio.currentTime = audio.duration * (window.value / 100);
      progressBar.classList.remove('progress__bar--active');
    }
    seeking = false;
    seekingVol = false;
  }

  function setVolume(evt) {
    evt.preventDefault();
    volumeLength = volumeBar.css('height');
    if(seekingVol && rightClick === false || evt.type === wheel()) {
      var value = moveBar(evt, volumeBar.parentNode, 'vertical') / 100;
      if(value <= 0) {
        audio.volume = 0;
        audio.muted = true;
        volumeBtn.classList.add('has-muted');
      }
      else {
        if(audio.muted) audio.muted = false;
        audio.volume = value;
        volumeBtn.classList.remove('has-muted');
      }
    }
  }

  function notify(title, attr) {
    if(!settings.notification) {
      return;
    }
    if(window.Notification === undefined) {
      return;
    }
    attr.tag = 'AP music player';
    window.Notification.requestPermission(function(access) {
      if(access === 'granted') {
        var notice = new Notification(title.substr(0, 110), attr);
        setTimeout(notice.close.bind(notice), 5000);
      }
    });
  }

/* Destroy method. Clear All */
  function destroy() {
    if(!apActive) return;

    if(settings.confirmClose) {
      window.removeEventListener('beforeunload', beforeUnload, false);
    }

    playBtn.removeEventListener('click', playToggle, false);
    volumeBtn.removeEventListener('click', volumeToggle, false);
    repeatBtn.removeEventListener('click', repeatToggle, false);
    plBtn.removeEventListener('click', plToggle, false);

    progressBar.closest('.progress-container').removeEventListener('mousedown', handlerBar, false);
    progressBar.closest('.progress-container').removeEventListener('mousemove', seek, false);
    document.documentElement.removeEventListener('mouseup', seekingFalse, false);

    volumeBar.closest('.volume').removeEventListener('mousedown', handlerVol, false);
    volumeBar.closest('.volume').removeEventListener('mousemove', setVolume);
    volumeBar.closest('.volume').removeEventListener(wheel(), setVolume);
    document.documentElement.removeEventListener('mouseup', seekingFalse, false);

    prevBtn.removeEventListener('click', prev, false);
    nextBtn.removeEventListener('click', next, false);

    audio.removeEventListener('error', errorHandler, false);
    audio.removeEventListener('timeupdate', timeUpdate, false);
    audio.removeEventListener('ended', doEnd, false);

    // Playlist
    pl.removeEventListener('click', listHandler, false);
    pl.parentNode.removeChild(pl);

    audio.pause();
    apActive = false;
    index = 0;

    playBtn.classList.remove('is-playing');
    playSvgPath.setAttribute('d', playSvg.getAttribute('data-play'));
    volumeBtn.classList.remove('has-muted');
    plBtn.classList.remove('is-active');
    repeatBtn.classList.remove('is-active');

    // Remove player from the DOM if necessary
    // player.parentNode.removeChild(player);
  }


/**
 *  Helpers
 */
  function wheel() {
    var wheel;
    if ('onwheel' in document) {
      wheel = 'wheel';
    } else if ('onmousewheel' in document) {
      wheel = 'mousewheel';
    } else {
      wheel = 'MozMousePixelScroll';
    }
    return wheel;
  }

  function extend(defaults, options) {
    for(var name in options) {
      if(defaults.hasOwnProperty(name)) {
        defaults[name] = options[name];
      }
    }
    return defaults;
  }
  function create(el, attr) {
    var element = document.createElement(el);
    if(attr) {
      for(var name in attr) {
        if(element[name] !== undefined) {
          element[name] = attr[name];
        }
      }
    }
    return element;
  }

  Element.prototype.offset = function() {
    var el = this.getBoundingClientRect(),
    scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
    scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    return {
      top: el.top + scrollTop,
      left: el.left + scrollLeft
    };
  };

  Element.prototype.css = function(attr) {
    if(typeof attr === 'string') {
      return getComputedStyle(this, '')[attr];
    }
    else if(typeof attr === 'object') {
      for(var name in attr) {
        if(this.style[name] !== undefined) {
          this.style[name] = attr[name];
        }
      }
    }
  };

  // matches polyfill
  window.Element && function(ElementPrototype) {
      ElementPrototype.matches = ElementPrototype.matches ||
      ElementPrototype.matchesSelector ||
      ElementPrototype.webkitMatchesSelector ||
      ElementPrototype.msMatchesSelector ||
      function(selector) {
          var node = this, nodes = (node.parentNode || node.document).querySelectorAll(selector), i = -1;
          while (nodes[++i] && nodes[i] != node);
          return !!nodes[i];
      };
  }(Element.prototype);

  // closest polyfill
  window.Element && function(ElementPrototype) {
      ElementPrototype.closest = ElementPrototype.closest ||
      function(selector) {
          var el = this;
          while (el.matches && !el.matches(selector)) el = el.parentNode;
          return el.matches ? el : null;
      };
  }(Element.prototype);

/**
 *  Public methods
 */
  return {
    init: init,
    update: updatePL,
    destroy: destroy
  };

})();

window.AP = AudioPlayer;

})(window);

// TEST: image for web notifications
var iconImage = 'http://funkyimg.com/i/21pX5.png';

$(window).on('load',function(){
  $('#exampleModalLong').modal('show');
});


AP.init({
  playList: [

  ]
});

function updateAlbumSeletion(){
  document.getElementsByTagName('list-group').getElementsByTagName('a');  
}

function loadClass(classID){
  var totalClass = 4;
  for(i=0;i<=totalClass;i++){
    document.getElementById('class'+i.toString()).style.display="none";
  }

  document.getElementById('class'+classID.toString()).style.display="inline";

  var titleList = ["音樂類別","熱門歌曲","中文歌手","英文歌手","純音樂"]  
  if(classID==0)
    document.getElementById('exampleModalLongTitle').innerHTML=titleList[classID];
  else
    document.getElementById('exampleModalLongTitle').innerHTML="<img src=\"previousPage.png\" style=\"width: 25px; margin-top: -5px; cursor: pointer;\" type=\"button\" onclick=\"loadClass(0)\">"+titleList[classID];
  
}


function loadNewAlbum(albumid){

  document.getElementById('albumName').innerHTML = document.getElementById('track'+albumid.toString()).innerHTML;

  AP.destroy();
  if(albumid==1){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '連名帶姓', 'file': 'music/熱門排行榜/aMEI張惠妹 [ Full Name 連名帶姓 ] Official Music Video.mp3'},
      {'icon': iconImage, 'title': '偷故事的人', 'file': 'music/熱門排行榜/AMEI張惠妹 [ STORY THIEF 偷故事的人 ] Official Music Video.mp3'},
      {'icon': iconImage, 'title': '如果雨之後', 'file': 'music/熱門排行榜/Eric周興哲《 如果雨之後 The Chaos After You 》Official Music Video.mp3'},
      {'icon': iconImage, 'title': '秘果', 'file': 'music/熱門排行榜/Fish Leong  梁靜茹 - 秘果 (官方完整上字 HD 版).mp3'},
      {'icon': iconImage, 'title': '我們不一樣', 'file': 'music/熱門排行榜/大壯 - 我們不一樣（官方版MV）.mp3'},
      {'icon': iconImage, 'title': '我多喜歡你,你會知道', 'file': 'music/熱門排行榜/王俊琪 - 我多喜歡你,你會知道致我們單純的小美好推廣曲動態歌詞Lyrics.mp3'},
      {'icon': iconImage, 'title': '追光者', 'file': 'music/熱門排行榜/岑寧兒《追光者》 電視劇《夏至未至》插曲.mp3'},
      {'icon': iconImage, 'title': 'Will You Remember Me', 'file': 'music/熱門排行榜/李玖哲Nicky Lee-Will You Remember Me (Official MV).mp3'},
      {'icon': iconImage, 'title': '祝你幸福', 'file': 'music/熱門排行榜/李榮浩 Ronghao Li - 祝你幸福 I Wish You Happiness (華納 Official HD 官方MV).mp3'},
      {'icon': iconImage, 'title': '風衣', 'file': 'music/熱門排行榜/孫燕姿 風衣 Official Music Video  Sun Yanzi Windbreaker.mp3'},
      {'icon': iconImage, 'title': '言不由衷', 'file': 'music/熱門排行榜/徐佳瑩 LaLa【言不由衷The Prayer】[HD] Official Music Video.mp3'},
      {'icon': iconImage, 'title': '我想你了', 'file': 'music/熱門排行榜/我想你了.mp3'},
      {'icon': iconImage, 'title': '了不起寂寞', 'file': 'music/熱門排行榜/戴愛玲 Princess Ai《了不起寂寞 Its No Big Deal》Official Lyrics MV.mp3'},
      {'icon': iconImage, 'title': 'Perfect Duet', 'file': 'music/熱門排行榜/Ed Sheeran - Perfect Duet (with Beyoncé) [Official Audio].mp3'},
      {'icon': iconImage, 'title': 'Naked', 'file': 'music/熱門排行榜/James Arthur - Naked.mp3'},
      {'icon': iconImage, 'title': 'Mistletoe', 'file': 'music/熱門排行榜/Justin Bieber - Mistletoe.mp3'},
      {'icon': iconImage, 'title': 'This Christmas', 'file': 'music/熱門排行榜/TAEYEON 태연 This Christmas MV.mp3'}
    ]});  
  }
  else if(albumid==2){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '身旁', 'file': 'music/韋禮安/韋禮安 Weibird Wei - 身旁（官方歌詞版）- 電視劇《盲約》插曲.mp3'},
      {'icon': iconImage, 'title': '分享快樂', 'file': 'music/韋禮安/韋禮安 Weibird Wei - 分享快樂 Sharing Is Joy (官方歌詞版) - 品客2017廣告曲.mp3'},
      {'icon': iconImage, 'title': '龍八夷', 'file': 'music/韋禮安/_韓劇《龍八夷》《我女婿的女人》《請回答1988》片尾曲.mp3'},
      {'icon': iconImage, 'title': '別來無恙', 'file': 'music/韋禮安/范瑋琪 Christine Fan + 韋禮安 Weibird Wei  - 別來無恙 How Have You Been (官方版MV).mp3'},
      {'icon': iconImage, 'title': 'Intro', 'file': 'music/韋禮安/韋禮安 Weibird Wei - Intro (官方版MV).mp3'},
      {'icon': iconImage, 'title': 'Luvin U', 'file': 'music/韋禮安/韋禮安 Weibird Wei - Luvin U.mp3'},
      {'icon': iconImage, 'title': '一個人 Single', 'file': 'music/韋禮安/韋禮安 Weibird Wei - 一個人 Single (官方歌詞版) - 電視劇 《幸福不二家》片尾曲.mp3'},
      {'icon': iconImage, 'title': '在意 What You Think Of Me', 'file': 'music/韋禮安/韋禮安 Weibird Wei - 在意 What You Think Of Me (官方版MV).mp3'},
      {'icon': iconImage, 'title': '別說沒愛過 Dont Say', 'file': 'music/韋禮安/韋禮安 Weibird Wei - 別說沒愛過 Dont Say (官方版MV) - 電視劇「致,第三者」片尾曲.mp3'},
      {'icon': iconImage, 'title': '為了你活 Live For You', 'file': 'music/韋禮安/韋禮安 Weibird Wei - 為了你活 Live For You (官方歌詞版) - 電視劇《聶小倩》片頭曲.mp3'},
      {'icon': iconImage, 'title': '崑崙鏡 Mirror of Sanctity', 'file': 'music/韋禮安/韋禮安 Weibird Wei - 崑崙鏡 Mirror of Sanctity (官方版MV) -「軒轅劍之崑崙鏡」遊戲主題曲.mp3'},
      {'icon': iconImage, 'title': '第一個想到你 Think Of You First', 'file': 'music/韋禮安/韋禮安 Weibird Wei - 第一個想到你 Think Of You First (官方版MV) - 電視劇 《後菜鳥的燦爛時代》片尾曲.mp3'},
      {'icon': iconImage, 'title': '傻瓜愛我', 'file': 'music/韋禮安/韋禮安 Weibird Wei - 傻瓜愛我 (官方歌詞版) - 電視劇《守護麗人》片頭曲.mp3'},
      {'icon': iconImage, 'title': '愛如空氣', 'file': 'music/韋禮安/韋禮安 Weibird Wei - 愛如空氣 (片花版MV) - 電視劇《復合大師》插曲、韓劇《鄰家律師趙德浩》片尾曲.mp3'},
      {'icon': iconImage, 'title': '風景舊曾諳', 'file': 'music/韋禮安/韋禮安 Weibird Wei + 郭靜 Claire Kuo - 風景舊曾諳 (官方版MV) - 電視劇《孤芳不自賞》插曲.mp3'}
    ]});   
  }
  else if(albumid==3){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '01. The Touch of Love', 'file': 'music/The Winding Path/01. The Touch of Love.mp3'},
      {'icon': iconImage, 'title': '02. The Way of the Stream', 'file': 'music/The Winding Path/02. The Way of the Stream.mp3'},
      {'icon': iconImage, 'title': '03. A Million Stars', 'file': 'music/The Winding Path/03. A Million Stars.mp3'},
      {'icon': iconImage, 'title': '04. High Above the Valley', 'file': 'music/The Winding Path/04. High Above the Valley.mp3'},
      {'icon': iconImage, 'title': '05. Ancient Guardians', 'file': 'music/The Winding Path/05. Ancient Guardians.mp3'},
      {'icon': iconImage, 'title': '06. Cauldron of Healing', 'file': 'music/The Winding Path/06. Cauldron of Healing.mp3'},
      {'icon': iconImage, 'title': '07. Filled With Light', 'file': 'music/The Winding Path/07. Filled With Light.mp3'},
      {'icon': iconImage, 'title': '08. Through the Veil', 'file': 'music/The Winding Path/08. Through the Veil.mp3'},
      {'icon': iconImage, 'title': '09. Softly Falling', 'file': 'music/The Winding Path/09. Softly Falling.mp3'},
      {'icon': iconImage, 'title': '10. The Winding Path', 'file': 'music/The Winding Path/10. The Winding Path.mp3'}
      
    ]});   
  }
  else if(albumid==4){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '01. Yiruma - Kiss The Rain', 'file': 'music/Yiruma - Healing Piano (2013)/CD-1/01. Yiruma - Kiss The Rain.mp3'},
      {'icon': iconImage, 'title': '02. Yiruma - Love Me', 'file': 'music/Yiruma - Healing Piano (2013)/CD-1/02. Yiruma - Love Me.mp3'},
      {'icon': iconImage, 'title': '03. Yiruma - All Myself To You', 'file': 'music/Yiruma - Healing Piano (2013)/CD-1/03. Yiruma - All Myself To You.mp3'},
      {'icon': iconImage, 'title': '04. Yiruma - Chaconne', 'file': 'music/Yiruma - Healing Piano (2013)/CD-1/04. Yiruma - Chaconne.mp3'},
      {'icon': iconImage, 'title': '05. Yiruma - I', 'file': 'music/Yiruma - Healing Piano (2013)/CD-1/05. Yiruma - I.mp3'},
      {'icon': iconImage, 'title': '06. Yiruma - Beloved', 'file': 'music/Yiruma - Healing Piano (2013)/CD-1/06. Yiruma - Beloved.mp3'},
      {'icon': iconImage, 'title': '07. Yiruma - Its Your Day', 'file': 'music/Yiruma - Healing Piano (2013)/CD-1/07. Yiruma - Its Your Day.mp3'},
      {'icon': iconImage, 'title': '08. Yiruma - Because I Love You', 'file': 'music/Yiruma - Healing Piano (2013)/CD-1/08. Yiruma - Because I Love You.mp3'},
      {'icon': iconImage, 'title': '09. Yiruma - Do You', 'file': 'music/Yiruma - Healing Piano (2013)/CD-1/09. Yiruma - Do You.mp3'},
      {'icon': iconImage, 'title': '10. Yiruma - Letter', 'file': 'music/Yiruma - Healing Piano (2013)/CD-1/10. Yiruma - Letter.mp3'},
      {'icon': iconImage, 'title': '11. Yiruma - Passing By', 'file': 'music/Yiruma - Healing Piano (2013)/CD-1/11. Yiruma - Passing By.mp3'},
      {'icon': iconImage, 'title': '12. Yiruma - Nocturnal Rainbow (밤의 무지개)', 'file': 'music/Yiruma - Healing Piano (2013)/CD-1/12. Yiruma - Nocturnal Rainbow (밤의 무지개).mp3'},
      {'icon': iconImage, 'title': '01. Yiruma - River Flows In You', 'file': 'music/Yiruma - Healing Piano (2013)/CD-2/01. Yiruma - River Flows In You.mp3'},
      {'icon': iconImage, 'title': '02. Yiruma - Indigo', 'file': 'music/Yiruma - Healing Piano (2013)/CD-2/02. Yiruma - Indigo.mp3'},
      {'icon': iconImage, 'title': '03. Yiruma - Elegy (내 마음에 비친 내 모습)', 'file': 'music/Yiruma - Healing Piano (2013)/CD-2/03. Yiruma - Elegy (내 마음에 비친 내 모습).mp3'},
      {'icon': iconImage, 'title': '04. Yiruma - Sometimes Someone', 'file': 'music/Yiruma - Healing Piano (2013)/CD-2/04. Yiruma - Sometimes Someone.mp3'},
      {'icon': iconImage, 'title': '05. Yiruma - May Be', 'file': 'music/Yiruma - Healing Piano (2013)/CD-2/05. Yiruma - May Be.mp3'},
      {'icon': iconImage, 'title': '06. Yiruma - Dream A Little Dream Of Me', 'file': 'music/Yiruma - Healing Piano (2013)/CD-2/06. Yiruma - Dream A Little Dream Of Me.mp3'},
      {'icon': iconImage, 'title': '07. Yiruma - Fotografia (희망이란 아이)', 'file': 'music/Yiruma - Healing Piano (2013)/CD-2/07. Yiruma - Fotografia (희망이란 아이).mp3'},
      {'icon': iconImage, 'title': '08. Yiruma - The Sunbeams They Scatter', 'file': 'music/Yiruma - Healing Piano (2013)/CD-2/08. Yiruma - The Sunbeams They Scatter.mp3'},
      {'icon': iconImage, 'title': '09. Yiruma - Journey', 'file': 'music/Yiruma - Healing Piano (2013)/CD-2/09. Yiruma - Journey.mp3'},
      {'icon': iconImage, 'title': '10. Yiruma - 약속 (Piano Solo)', 'file': 'music/Yiruma - Healing Piano (2013)/CD-2/10. Yiruma - 약속 (Piano Solo).mp3'},
      {'icon': iconImage, 'title': '11. Yiruma - Memories In My Eyes', 'file': 'music/Yiruma - Healing Piano (2013)/CD-2/11. Yiruma - Memories In My Eyes.mp3'},
      {'icon': iconImage, 'title': '12. Yiruma - When The Love Falls', 'file': 'music/Yiruma - Healing Piano (2013)/CD-2/12. Yiruma - When The Love Falls.mp3'}
    ]});   
  }
  else if(albumid==5){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '01. 序曲：調音', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/01. 序曲：調音.mp3'},
      {'icon': iconImage, 'title': '02. 不為誰而作的歌', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/02. 不為誰而作的歌.mp3'},
      {'icon': iconImage, 'title': '03. 序曲：中場休息', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/03. 序曲：中場休息.mp3'},
      {'icon': iconImage, 'title': '04. 關鍵詞', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/04. 關鍵詞.mp3'},
      {'icon': iconImage, 'title': '05. 只要有你的地方 (晚安版)', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/05. 只要有你的地方 (晚安版).mp3'},
      {'icon': iconImage, 'title': '06. 彈唱', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/06. 彈唱.mp3'},
      {'icon': iconImage, 'title': '07. 有夢不難', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/07. 有夢不難.mp3'},
      {'icon': iconImage, 'title': '08. 序曲：Welcome to the Livehouse', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/08. 序曲：Welcome to the Livehouse08. 序曲：Welcome to the Livehouse.mp3'},
      {'icon': iconImage, 'title': '09. Too Bad', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/09. Too Bad.mp3'},
      {'icon': iconImage, 'title': '10. 你,有沒有過 (Livehouse版)', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/10. 你,有沒有過 (Livehouse版).mp3'},
      {'icon': iconImage, 'title': '11. 序曲：12年前', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/11. 序曲：12年前.mp3'},
      {'icon': iconImage, 'title': '12. 現在的我和她', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/12. 現在的我和她.mp3'},
      {'icon': iconImage, 'title': '13. 序曲：海邊 初', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/13. 序曲：海邊 初.mp3'},
      {'icon': iconImage, 'title': '14. Lier and Accuser', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/14. Lier and Accuser.mp3'},
      {'icon': iconImage, 'title': '15. 獨舞', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/15. 獨舞.mp3'},
      {'icon': iconImage, 'title': '16. 序曲：海邊 終', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/16. 序曲：海邊 終.mp3'},
      {'icon': iconImage, 'title': '17. 你,有沒有過 (電影《破風》主題曲)', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/.mp3'},
      {'icon': iconImage, 'title': '18. 只要有你的地方 (電影《消失的愛人》主題曲)', 'file': 'music/林俊傑/2015-12-林俊傑-和自己對話/18. 只要有你的地方 (電影《消失的愛人》主題曲).mp3'}
    ]});   
  }
  else if(albumid==6){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '01 - 迴', 'file': 'music/林俊傑/2014-12-新地球/01 - 迴.mp3'},
      {'icon': iconImage, 'title': '02 - 新地球', 'file': 'music/林俊傑/2014-12-新地球/02 - 新地球.mp3'},
      {'icon': iconImage, 'title': '03 - 水仙', 'file': 'music/林俊傑/2014-12-新地球/03 - 水仙.mp3'},
      {'icon': iconImage, 'title': '04 - 浪漫血液', 'file': 'music/林俊傑/2014-12-新地球/04 - 浪漫血液.mp3'},
      {'icon': iconImage, 'title': '05 - 黑鍵', 'file': 'music/林俊傑/2014-12-新地球/05 - 黑鍵.mp3'},
      {'icon': iconImage, 'title': '06 - 手心的薔薇', 'file': 'music/林俊傑/2014-12-新地球/06 - 手心的薔薇.mp3'},
      {'icon': iconImage, 'title': '07 - 可惜沒如果', 'file': 'music/林俊傑/2014-12-新地球/07 - 可惜沒如果.mp3'},
      {'icon': iconImage, 'title': '08 - I Am Alive', 'file': 'music/林俊傑/2014-12-新地球/08 - I Am Alive.mp3'},
      {'icon': iconImage, 'title': '09 - 愛的鼓勵', 'file': 'music/林俊傑/2014-12-新地球/09 - 愛的鼓勵.mp3'},
      {'icon': iconImage, 'title': '10 - 茉莉雨', 'file': 'music/林俊傑/2014-12-新地球/10 - 茉莉雨.mp3'},
      {'icon': iconImage, 'title': '11 - 生生', 'file': 'music/林俊傑/2014-12-新地球/11 - 生生.mp3'}
    ]});   
  }
  else if(albumid==7){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '01 - 因你而在', 'file': 'music/林俊傑/2013-03-因你而在/01 - 因你而在.mp3'},
      {'icon': iconImage, 'title': '02 - 零度的親吻', 'file': 'music/林俊傑/2013-03-因你而在/02 - 零度的親吻.mp3'},
      {'icon': iconImage, 'title': '03 - 黑暗騎士', 'file': 'music/林俊傑/2013-03-因你而在/03 - 黑暗騎士.mp3'},
      {'icon': iconImage, 'title': '04 - 修煉愛情', 'file': 'music/林俊傑/2013-03-因你而在/04 - 修煉愛情.mp3'},
      {'icon': iconImage, 'title': '05 - 飛機', 'file': 'music/林俊傑/2013-03-因你而在/05 - 飛機.mp3'},
      {'icon': iconImage, 'title': '06 - 巴洛克先生', 'file': 'music/林俊傑/2013-03-因你而在/06 - 巴洛克先生.mp3'},
      {'icon': iconImage, 'title': '07 - One Shot', 'file': 'music/林俊傑/2013-03-因你而在/07 - One Shot.mp3'},
      {'icon': iconImage, 'title': '08 - 裂縫中的陽光', 'file': 'music/林俊傑/2013-03-因你而在/08 - 裂縫中的陽光.mp3'},
      {'icon': iconImage, 'title': '09 - 友人說', 'file': 'music/林俊傑/2013-03-因你而在/09 - 友人說.mp3'},
      {'icon': iconImage, 'title': '10 - 十秒的沖動', 'file': 'music/林俊傑/2013-03-因你而在/10 - 十秒的沖動.mp3'},
      {'icon': iconImage, 'title': '11 - 以后要做的事', 'file': 'music/林俊傑/2013-03-因你而在/11 - 以后要做的事.mp3'},
      {'icon': iconImage, 'title': '12 - 一千年后記得我', 'file': 'music/林俊傑/2013-03-因你而在/12 - 一千年后記得我.mp3'}
    ]});   
  }
  else if(albumid==8){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '01.Prologue', 'file': 'music/林俊傑/2011-12-學不會/01.Prologue.mp3'},
      {'icon': iconImage, 'title': '02.學不會', 'file': 'music/林俊傑/2011-12-學不會/02.學不會.mp3'},
      {'icon': iconImage, 'title': '03.故事細膩', 'file': 'music/林俊傑/2011-12-學不會/03.故事細膩.mp3'},
      {'icon': iconImage, 'title': '04.那些你很冒險的夢', 'file': 'music/林俊傑/2011-12-學不會/04.那些你很冒險的夢.mp3'},
      {'icon': iconImage, 'title': '05.白羊夢', 'file': 'music/林俊傑/2011-12-學不會/05.白羊夢.mp3'},
      {'icon': iconImage, 'title': '06.靈魂的共鳴', 'file': 'music/林俊傑/2011-12-學不會/06.靈魂的共鳴.mp3'},
      {'icon': iconImage, 'title': '07.We Together', 'file': 'music/林俊傑/2011-12-學不會/07.We Together.mp3'},
      {'icon': iconImage, 'title': '08.Cinderella', 'file': 'music/林俊傑/2011-12-學不會/08.Cinderella.mp3'},
      {'icon': iconImage, 'title': '09.白蘭花', 'file': 'music/林俊傑/2011-12-學不會/09.白蘭花.mp3'},
      {'icon': iconImage, 'title': '10.陌生老朋友', 'file': 'music/林俊傑/2011-12-學不會/10.陌生老朋友.mp3'},
      {'icon': iconImage, 'title': '11.不存在的情人', 'file': 'music/林俊傑/2011-12-學不會/11.不存在的情人.mp3'},
      {'icon': iconImage, 'title': '12.Love U U', 'file': 'music/林俊傑/2011-12-學不會/12.Love U U.mp3'}
    ]});   
  }
  else if(albumid==9){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '01-她說', 'file': 'music/林俊傑/2010-12-她說/01-她說.mp3'},
      {'icon': iconImage, 'title': '02-愛笑的眼睛', 'file': 'music/林俊傑/2010-12-她說/02-愛笑的眼睛.mp3'},
      {'icon': iconImage, 'title': '03-只對你有感覺', 'file': 'music/林俊傑/2010-12-她說/03-只對你有感覺.mp3'},
      {'icon': iconImage, 'title': '04-當你', 'file': 'music/林俊傑/2010-12-她說/04-當你.mp3'},
      {'icon': iconImage, 'title': '05-一眼萬年', 'file': 'music/林俊傑/2010-12-她說/05-一眼萬年.mp3'},
      {'icon': iconImage, 'title': '06-保護色', 'file': 'music/林俊傑/2010-12-她說/06-保護色.mp3'},
      {'icon': iconImage, 'title': '07-握不住的他', 'file': 'music/林俊傑/2010-12-她說/07-握不住的他.mp3'},
      {'icon': iconImage, 'title': '08-心牆', 'file': 'music/林俊傑/2010-12-她說/08-心牆.mp3'},
      {'icon': iconImage, 'title': '09-我很想愛他', 'file': 'music/林俊傑/2010-12-她說/09-我很想愛他.mp3'},
      {'icon': iconImage, 'title': '10-一生的愛', 'file': 'music/林俊傑/2010-12-她說/10-一生的愛.mp3'},
      {'icon': iconImage, 'title': '11-記得', 'file': 'music/林俊傑/2010-12-她說/11-記得.mp3'},
      {'icon': iconImage, 'title': '12-完美新世界', 'file': 'music/林俊傑/2010-12-她說/12-完美新世界.mp3'},
      {'icon': iconImage, 'title': '13-I Am', 'file': 'music/林俊傑/2010-12-她說/13-I Am.mp3'},
      {'icon': iconImage, 'title': '14-真材實料的我', 'file': 'music/林俊傑/2010-12-她說/14-真材實料的我.mp3'}      
    ]});   
  }
  else if(albumid==10){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': 'still moving under gunfire', 'file': 'music/林俊傑/2009-12-100天/林俊傑_still moving under gunfire.mp3'},
      {'icon': iconImage, 'title': 'x', 'file': 'music/林俊傑/2009-12-100天/林俊傑_x.mp3'},
      {'icon': iconImage, 'title': '一個又一個', 'file': 'music/林俊傑/2009-12-100天/林俊傑_一個又一個.mp3'},
      {'icon': iconImage, 'title': '加油!', 'file': 'music/林俊傑/2009-12-100天/林俊傑_加油!.mp3'},
      {'icon': iconImage, 'title': '表達愛 (林俊傑+廖君)', 'file': 'music/林俊傑/2009-12-100天/林俊傑_表達愛 (林俊傑+廖君).mp3'},
      {'icon': iconImage, 'title': '背對背擁抱', 'file': 'music/林俊傑/2009-12-100天/林俊傑_背對背擁抱.mp3'},
      {'icon': iconImage, 'title': '第幾個100天', 'file': 'music/林俊傑/2009-12-100天/林俊傑_第幾個100天.mp3'},
      {'icon': iconImage, 'title': '第幾個100天demo版', 'file': 'music/林俊傑/2009-12-100天/林俊傑_第幾個100天demo版.mp3'},
      {'icon': iconImage, 'title': '無法克制', 'file': 'music/林俊傑/2009-12-100天/林俊傑_無法克制.mp3'},
      {'icon': iconImage, 'title': '媽媽的娜魯娃', 'file': 'music/林俊傑/2009-12-100天/林俊傑_媽媽的娜魯娃.mp3'},
      {'icon': iconImage, 'title': '愛不會絕跡', 'file': 'music/林俊傑/2009-12-100天/林俊傑_愛不會絕跡.mp3'},
      {'icon': iconImage, 'title': '跟屁蟲', 'file': 'music/林俊傑/2009-12-100天/林俊傑_跟屁蟲.mp3'},
      {'icon': iconImage, 'title': '曙光', 'file': 'music/林俊傑/2009-12-100天/林俊傑_曙光.mp3'},
      {'icon': iconImage, 'title': '轉動', 'file': 'music/林俊傑/2009-12-100天/林俊傑_轉動.mp3'}
    ]});   
  }
  else if(albumid==11){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': 'Always Online', 'file': 'music/林俊傑/2008-10-JJ陸/林俊傑-Always Online.mp3'},
      {'icon': iconImage, 'title': 'Cries in a Distance', 'file': 'music/林俊傑/2008-10-JJ陸/林俊傑-Cries in a Distance.mp3'},
      {'icon': iconImage, 'title': 'SIXOLOGY', 'file': 'music/林俊傑/2008-10-JJ陸/林俊傑-SIXOLOGY.mp3'},
      {'icon': iconImage, 'title': '小酒窩', 'file': 'music/林俊傑/2008-10-JJ陸/林俊傑-小酒窩.mp3'},
      {'icon': iconImage, 'title': '不潮不用花錢', 'file': 'music/林俊傑/2008-10-JJ陸/林俊傑-不潮不用花錢.mp3'},
      {'icon': iconImage, 'title': '主角', 'file': 'music/林俊傑/2008-10-JJ陸/林俊傑-主角.mp3'},
      {'icon': iconImage, 'title': '由你選擇 ', 'file': 'music/林俊傑/2008-10-JJ陸/林俊傑-由你選擇 .mp3'},
      {'icon': iconImage, 'title': '我還想她', 'file': 'music/林俊傑/2008-10-JJ陸/林俊傑-我還想她.mp3'},
      {'icon': iconImage, 'title': '期待愛 ', 'file': 'music/林俊傑/2008-10-JJ陸/林俊傑-期待愛 .mp3'},
      {'icon': iconImage, 'title': '街道', 'file': 'music/林俊傑/2008-10-JJ陸/林俊傑-街道.mp3'},
      {'icon': iconImage, 'title': '黑武士', 'file': 'music/林俊傑/2008-10-JJ陸/林俊傑-黑武士.mp3'},
      {'icon': iconImage, 'title': '愛與希望 ', 'file': 'music/林俊傑/2008-10-JJ陸/林俊傑--愛與希望 .mp3'},
      {'icon': iconImage, 'title': '醉赤壁', 'file': 'music/林俊傑/2008-10-JJ陸/林俊傑-醉赤壁.mp3'},
      {'icon': iconImage, 'title': '點一把火炬', 'file': 'music/林俊傑/2008-10-JJ陸/林俊傑-點一把火炬.mp3'}

    ]});   
  }
  else if(albumid==12){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '01 獨白', 'file': 'music/林俊傑/2007-06-西界/01 獨白.mp3'},
      {'icon': iconImage, 'title': '02 殺手', 'file': 'music/林俊傑/2007-06-西界/02 殺手.mp3'},
      {'icon': iconImage, 'title': '03 殺手 續', 'file': 'music/林俊傑/2007-06-西界/03 殺手 續.mp3'},
      {'icon': iconImage, 'title': '04 西界', 'file': 'music/林俊傑/2007-06-西界/04 西界.mp3'},
      {'icon': iconImage, 'title': '05 無聊', 'file': 'music/林俊傑/2007-06-西界/05 無聊.mp3'},
      {'icon': iconImage, 'title': '06 單挑', 'file': 'music/林俊傑/2007-06-西界/06 單挑.mp3'},
      {'icon': iconImage, 'title': '07 K-O', 'file': 'music/林俊傑/2007-06-西界/07 K-O.mp3'},
      {'icon': iconImage, 'title': '08 大男人 小女孩', 'file': 'music/林俊傑/2007-06-西界/08 大男人 小女孩.mp3'},
      {'icon': iconImage, 'title': '09 L-O-V-E', 'file': 'music/林俊傑/2007-06-西界/09 L-O-V-E.mp3'},
      {'icon': iconImage, 'title': '10 發現愛', 'file': 'music/林俊傑/2007-06-西界/10 發現愛.mp3'},
      {'icon': iconImage, 'title': '11 不流淚的機場', 'file': 'music/林俊傑/2007-06-西界/11 不流淚的機場.mp3'},
      {'icon': iconImage, 'title': '12 Baby Baby', 'file': 'music/林俊傑/2007-06-西界/12 Baby Baby.mp3'},
      {'icon': iconImage, 'title': '13 自由不變', 'file': 'music/林俊傑/2007-06-西界/13 自由不變.mp3'}
    ]});   
  }
  else if(albumid==13){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '01 只對你說', 'file': 'music/林俊傑/2006-02-曹操/01 只對你說.mp3'},
      {'icon': iconImage, 'title': '02 曹操', 'file': 'music/林俊傑/2006-02-曹操/02 曹操.mp3'},
      {'icon': iconImage, 'title': '03 熟能生巧', 'file': 'music/林俊傑/2006-02-曹操/03 熟能生巧.mp3'},
      {'icon': iconImage, 'title': '04 波間帶', 'file': 'music/林俊傑/2006-02-曹操/04 波間帶.mp3'},
      {'icon': iconImage, 'title': '05 原來', 'file': 'music/林俊傑/2006-02-曹操/05 原來.mp3'},
      {'icon': iconImage, 'title': '06 不死之身', 'file': 'music/林俊傑/2006-02-曹操/06 不死之身.mp3'},
      {'icon': iconImage, 'title': '07 愛情yogurt', 'file': 'music/林俊傑/2006-02-曹操/07 愛情yogurt.mp3'},
      {'icon': iconImage, 'title': '08 進化論', 'file': 'music/林俊傑/2006-02-曹操/08 進化論.mp3'},
      {'icon': iconImage, 'title': '09 Now That She\'s Gone', 'file': 'music/林俊傑/2006-02-曹操/09 Now That She\'s Gone.mp3'},
      {'icon': iconImage, 'title': '10 你要的不是我', 'file': 'music/林俊傑/2006-02-曹操/10 你要的不是我.mp3'},
      {'icon': iconImage, 'title': '11 Down', 'file': 'music/林俊傑/2006-02-曹操/11 Down.mp3'}
    ]});   
  }
  else if(albumid==14){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '01 一千年以前…', 'file': 'music/林俊傑/2005-04-編號89757/01 一千年以前….mp3'},
      {'icon': iconImage, 'title': '02 木乃伊', 'file': 'music/林俊傑/2005-04-編號89757/02 木乃伊.mp3'},
      {'icon': iconImage, 'title': '03 編號89757', 'file': 'music/林俊傑/2005-04-編號89757/03 編號89757.mp3'},
      {'icon': iconImage, 'title': '04 莎士比亞的天份', 'file': 'music/林俊傑/2005-04-編號89757/04 莎士比亞的天份.mp3'},
      {'icon': iconImage, 'title': '05 突然累了', 'file': 'music/林俊傑/2005-04-編號89757/05 突然累了.mp3'},
      {'icon': iconImage, 'title': '06 明天', 'file': 'music/林俊傑/2005-04-編號89757/06 明天.mp3'},
      {'icon': iconImage, 'title': '07 簡簡單單', 'file': 'music/林俊傑/2005-04-編號89757/07 簡簡單單.mp3'},
      {'icon': iconImage, 'title': '08 無盡的思念', 'file': 'music/林俊傑/2005-04-編號89757/08 無盡的思念.mp3'},
      {'icon': iconImage, 'title': '09 盜', 'file': 'music/林俊傑/2005-04-編號89757/09 盜.mp3'},
      {'icon': iconImage, 'title': '10 聽不懂 沒關係', 'file': 'music/林俊傑/2005-04-編號89757/10 聽不懂 沒關係.mp3'},
      {'icon': iconImage, 'title': '11 來不及了...', 'file': 'music/林俊傑/2005-04-編號89757/11 來不及了....mp3'},
      {'icon': iconImage, 'title': '12 一千年以後...', 'file': 'music/林俊傑/2005-04-編號89757/12 一千年以後....mp3'}
    ]});   
  }
  else if(albumid==15){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '01 開始', 'file': 'music/林俊傑/2004-06-第二天堂/01 開始.mp3'},
      {'icon': iconImage, 'title': '02 江南', 'file': 'music/林俊傑/2004-06-第二天堂/02 江南.mp3'},
      {'icon': iconImage, 'title': '02 第二天堂', 'file': 'music/林俊傑/2004-06-第二天堂/02 第二天堂.mp3'},
      {'icon': iconImage, 'title': '03 子彈列車', 'file': 'music/林俊傑/2004-06-第二天堂/03 子彈列車.mp3'},
      {'icon': iconImage, 'title': '04 起床了', 'file': 'music/林俊傑/2004-06-第二天堂/04 起床了.mp3'},
      {'icon': iconImage, 'title': '05 豆漿油條', 'file': 'music/林俊傑/2004-06-第二天堂/05 豆漿油條.mp3'},
      {'icon': iconImage, 'title': '07 害怕', 'file': 'music/林俊傑/2004-06-第二天堂/07 害怕.mp3'},
      {'icon': iconImage, 'title': '08 天使心', 'file': 'music/林俊傑/2004-06-第二天堂/08 天使心.mp3'},
      {'icon': iconImage, 'title': '09 森林浴', 'file': 'music/林俊傑/2004-06-第二天堂/09 森林浴.mp3'},
      {'icon': iconImage, 'title': '10 精靈', 'file': 'music/林俊傑/2004-06-第二天堂/10 精靈.mp3'},
      {'icon': iconImage, 'title': '11 相信無限', 'file': 'music/林俊傑/2004-06-第二天堂/11 相信無限.mp3'},
      {'icon': iconImage, 'title': '12 美人魚', 'file': 'music/林俊傑/2004-06-第二天堂/12 美人魚.mp3'},
      {'icon': iconImage, 'title': '13 距離', 'file': 'music/林俊傑/2004-06-第二天堂/13 距離.mp3'},
      {'icon': iconImage, 'title': '14 未完成', 'file': 'music/林俊傑/2004-06-第二天堂/14 未完成.mp3'},
      {'icon': iconImage, 'title': '15 Endless Road', 'file': 'music/林俊傑/2004-06-第二天堂/15 Endless Road.mp3'}
    ]});   
  }
  else if(albumid==16){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '01 就是我', 'file': 'music/林俊傑/2003-04-樂行者/01 就是我.mp3'},
      {'icon': iconImage, 'title': '02 會讀書', 'file': 'music/林俊傑/2003-04-樂行者/02 會讀書.mp3'},
      {'icon': iconImage, 'title': '03 翅膀', 'file': 'music/林俊傑/2003-04-樂行者/03 翅膀.mp3'},
      {'icon': iconImage, 'title': '04 星球', 'file': 'music/林俊傑/2003-04-樂行者/04 星球.mp3'},
      {'icon': iconImage, 'title': '05 凍結', 'file': 'music/林俊傑/2003-04-樂行者/05 凍結.mp3'},
      {'icon': iconImage, 'title': '06 壓力', 'file': 'music/林俊傑/2003-04-樂行者/06 壓力.mp3'},
      {'icon': iconImage, 'title': '07 女兒家', 'file': 'music/林俊傑/2003-04-樂行者/07 女兒家.mp3'},
      {'icon': iconImage, 'title': '08 星空下的吻', 'file': 'music/林俊傑/2003-04-樂行者/08 星空下的吻.mp3'},
      {'icon': iconImage, 'title': '09 讓我心動的人', 'file': 'music/林俊傑/2003-04-樂行者/09 讓我心動的人.mp3'},
      {'icon': iconImage, 'title': '10 會有那麼一天', 'file': 'music/林俊傑/2003-04-樂行者/10 會有那麼一天.mp3'},
      {'icon': iconImage, 'title': '11 不懂', 'file': 'music/林俊傑/2003-04-樂行者/11 不懂.mp3'}
    ]});   
  }
  else if(albumid==17){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '01 Despacito (feat. Daddy Yankee)', 'file': 'music/Power Hits 2017/01 Despacito (feat. Daddy Yankee).mp3'},
      {'icon': iconImage, 'title': '02 Don\'t Wanna Know (feat. Kendrick Lamar)', 'file': 'music/Power Hits 2017/02 Don\'t Wanna Know (feat. Kendrick Lamar).mp3'},
      {'icon': iconImage, 'title': '03 Chained To the Rhythm (feat. Skip Skip Marley)', 'file': 'music/Power Hits 2017/03 Chained To the Rhythm (feat. Skip Skip Marley).mp3'},
      {'icon': iconImage, 'title': '04 Mercy', 'file': 'music/Power Hits 2017/04 Mercy.mp3'},
      {'icon': iconImage, 'title': '05 Side to Side (feat. Nicki Minaj)', 'file': 'music/Power Hits 2017/05 Side to Side (feat. Nicki Minaj).mp3'},
      {'icon': iconImage, 'title': '06 Perfect Strangers (feat. JP Coope)', 'file': 'music/Power Hits 2017/06 Perfect Strangers (feat. JP Coope).mp3'},
      {'icon': iconImage, 'title': '07 Body Moves', 'file': 'music/Power Hits 2017/07 Body Moves.mp3'},
      {'icon': iconImage, 'title': '08 Green Light', 'file': 'music/Power Hits 2017/08 Green Light.mp3'},
      {'icon': iconImage, 'title': '09 Strip That Down (feat. Quavo)', 'file': 'music/Power Hits 2017/09 Strip That Down (feat. Quavo).mp3'},
      {'icon': iconImage, 'title': '10 Slow Hands', 'file': 'music/Power Hits 2017/10 Slow Hands.mp3'},
      {'icon': iconImage, 'title': '11 I Feel It Coming (feat. Daft Punk)', 'file': 'music/Power Hits 2017/11 I Feel It Coming (feat. Daft Punk).mp3'},
      {'icon': iconImage, 'title': '12 Believer', 'file': 'music/Power Hits 2017/12 Believer.mp3'},
      {'icon': iconImage, 'title': '13 The Cure', 'file': 'music/Power Hits 2017/13 The Cure.mp3'},
      {'icon': iconImage, 'title': '14 Starving (feat. Zedd)', 'file': 'music/Power Hits 2017/14 Starving (feat. Zedd).mp3'},
      {'icon': iconImage, 'title': '16 ILYSB', 'file': 'music/Power Hits 2017/16 ILYSB.mp3'},
      {'icon': iconImage, 'title': '17 Stay (feat. Alessia Cara)', 'file': 'music/Power Hits 2017/17 Stay (feat. Alessia Cara).mp3'},
      {'icon': iconImage, 'title': '18 Bad Liar', 'file': 'music/Power Hits 2017/18 Bad Liar.mp3'},
      {'icon': iconImage, 'title': '19 Issues', 'file': 'music/Power Hits 2017/19 Issues.mp3'},
      {'icon': iconImage, 'title': '20 Wherever I Go', 'file': 'music/Power Hits 2017/20 Wherever I Go.mp3'}
      
    ]});   
  }
  else if(albumid==18){
    AP.init({
    playList: [
      {'icon': iconImage, 'title': '001-Alan Walker - All Falls Down (feat. Noah Cyrus with Digital Farm Animals)', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/048-The Chainsmokers - All We Know ft. Phoebe Ryan.mp3'},
      {'icon': iconImage, 'title': '002-Selena Gomez, Marshmello - Wolves (Visualizer)', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/099-Alesso & Anitta - Is That For Me.mp3'},
      {'icon': iconImage, 'title': '003-Ed Sheeran - Shape of You', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/100-Ed Sheeran - Shape of You.mp3'},
      {'icon': iconImage, 'title': '004-The Chainsmokers & Coldplay - Something Just Like This', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/015-Taylor Swift - Call It What You Want.mp3'},
      {'icon': iconImage, 'title': '005-Luis Fonsi, Daddy Yankee - Despacito (Remix Audio) ft. Justin Bieber', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/072-Avicii - Lonely Together “Audio” ft. Rita Ora.mp3'},
      {'icon': iconImage, 'title': '006-Charlie Puth - How Long', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/085-Liam Payne - Strip That Down ft. Quavo.mp3'},
      {'icon': iconImage, 'title': '007-Alan Walker - Faded', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/019-Camila Cabello - Havana ft. Young Thug.mp3'},
      {'icon': iconImage, 'title': '008-The Chainsmokers - Closer ft. Halsey', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/027-Maroon 5 - Sugar.mp3'},
      {'icon': iconImage, 'title': '009-Taylor Swift - Look What You Made Me Do', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/017-Mike Perry - The Ocean ft. Shy Martin.mp3'},
      {'icon': iconImage, 'title': '010-Taylor Swift - Gorgeous', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/028-The Chainsmokers - Don\'t Let Me Down ft. Daya.mp3'},
      {'icon': iconImage, 'title': '011-Alan Walker - The Spectre', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/029-Justin Bieber - Love Yourself.mp3'},
      {'icon': iconImage, 'title': '012-Luis Fonsi - Despacito ft. Daddy Yankee', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/011-Alan Walker - The Spectre.mp3'},
      {'icon': iconImage, 'title': '013-Henry - It\'s You', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/076-Jessie J - Flashlight (from Pitch Perfect 2).mp3'},
      {'icon': iconImage, 'title': '014-Sam Smith - Too Good At Goodbyes', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/053-Jonas Blue - Mama ft. William Singe.mp3'},
      {'icon': iconImage, 'title': '015-Taylor Swift - Call It What You Want', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/066-Louis Tomlinson - Back to You ft. Bebe Rexha, Digital Farm Animals.mp3'},
      {'icon': iconImage, 'title': '016-CHARLIE PUTH - We Don\'t Talk Anymore', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/068-Maroon 5 - Payphone ft. Wiz Khalifa.mp3'},
      {'icon': iconImage, 'title': '017-Mike Perry - The Ocean ft. Shy Martin', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/069-Kelly Clarkson - Love So Soft (Mark Knight & Ben Remember Remix).mp3'},
      {'icon': iconImage, 'title': '018-Clean Bandit - I Miss You feat. Julia Michaels', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/024-Martin Garrix & Troye Sivan - There For You.mp3'},
      {'icon': iconImage, 'title': '019-Camila Cabello - Havana ft. Young Thug', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/012-Luis Fonsi - Despacito ft. Daddy Yankee.mp3'},
      {'icon': iconImage, 'title': '020-Charlie Puth - Attention', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/037-Ed Sheeran - Photograph.mp3'},
      {'icon': iconImage, 'title': '021-Clean Bandit - Symphony feat. Zara Larsson', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/091-Zedd - Beautiful Now ft. Jon Bellion.mp3'},
      {'icon': iconImage, 'title': '022-Maroon 5 - What Lovers Do ft. SZA', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/061-Shawn Mendes - There\'s Nothing Holdin\' Me Back.mp3'},
      {'icon': iconImage, 'title': '023-Alan Walker - Alone', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/070-JUSTIN TIMBERLAKE - CAN\'T STOP THE FEELING.mp3'},
      {'icon': iconImage, 'title': '024-Martin Garrix & Troye Sivan - There For You', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/040-Calvin Harris - This Is What You Came For ft. Rihanna.mp3'},
      {'icon': iconImage, 'title': '025-Zedd, Alessia Cara - Stay', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/036-Ed Sheeran - Galway Girl.mp3'},
      {'icon': iconImage, 'title': '026-ZAYN - Dusk Till Dawn ft. Sia', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/021-Clean Bandit - Symphony feat. Zara Larsson.mp3'},
      {'icon': iconImage, 'title': '027-Maroon 5 - Sugar', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/038-Ed Sheeran - Perfect.mp3'},
      {'icon': iconImage, 'title': '028-The Chainsmokers - Don\'t Let Me Down ft. Daya', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/049-Ed Sheeran - Thinking Out Loud.mp3'},
      {'icon': iconImage, 'title': '029-Justin Bieber - Love Yourself', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/089-Maroon 5 - Animals.mp3'},
      {'icon': iconImage, 'title': '030-Alan Walker ft. Gavin James - Tired', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/046-The Chainsmokers - Paris.mp3'},
      {'icon': iconImage, 'title': '031-DJ Snake - Let Me Love You ft. Justin Bieber', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/063-Fifth Harmony - Work from Home ft. Ty Dolla $ign.mp3'},
      {'icon': iconImage, 'title': '032-Linkin Park - One More Light (Steve Aoki Chester Forever Remix)', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/031-DJ Snake - Let Me Love You ft. Justin Bieber.mp3'},
      {'icon': iconImage, 'title': '033-Kygo - Stranger Things ft. OneRepublic', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/047-Lion - You\'re Beautiful.mp3'},
      {'icon': iconImage, 'title': '034-王詩安 Diana Wang - HOME', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/056-Martin Garrix & Bebe Rexha - In The Name Of Love.mp3'},
      {'icon': iconImage, 'title': '035-Daniel Powter - Bad Day', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/052-Martin Garrix & Dua Lipa - Scared To Be Lonely.mp3'},
      {'icon': iconImage, 'title': '036-Ed Sheeran - Galway Girl', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/090-Avicii - Without You “Audio” ft. Sandro Cavazza.mp3'},
      {'icon': iconImage, 'title': '037-Ed Sheeran - Photograph', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/010-Taylor Swift - Gorgeous.mp3'},
      {'icon': iconImage, 'title': '038-Ed Sheeran - Perfect', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/064-Lady Gaga - The Cure.mp3'},
      {'icon': iconImage, 'title': '039-DJ Snake - A Different Way ft. Lauv', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/081-Adele - Rolling in the Deep.mp3'},
      {'icon': iconImage, 'title': '040-Calvin Harris - This Is What You Came For ft. Rihanna', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/087-Sia - Cheap Thrills (Performance Edit).mp3'},
      {'icon': iconImage, 'title': '041-Bruno Mars - That_ What I Like', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/074-Maroon 5 - Maps.mp3'},
      {'icon': iconImage, 'title': '042-G-Eazy & Kehlani - Good Life (from The Fate of the Furious_ The Album)', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/014-Sam Smith - Too Good At Goodbyes.mp3'},
      {'icon': iconImage, 'title': '043-Clean Bandit - Rockabye ft. Sean Paul & Anne-Marie', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/073-Fifth Harmony - Worth It ft. Kid Ink.mp3'},
      {'icon': iconImage, 'title': '044-Taylor Swift - Ready For It', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/058-Justin Bieber - Sorry.mp3'},
      {'icon': iconImage, 'title': '045-David Guetta ft Justin Bieber - 2U', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/042-G-Eazy & Kehlani - Good Life (from The Fate of the Furious_ The Album).mp3'},
      {'icon': iconImage, 'title': '046-The Chainsmokers - Paris', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/079-Calvin Harris - Outside ft. Ellie Goulding.mp3'},
      {'icon': iconImage, 'title': '047-Lion - You\'re Beautiful', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/018-Clean Bandit - I Miss You feat. Julia Michaels.mp3'},
      {'icon': iconImage, 'title': '048-The Chainsmokers - All We Know ft. Phoebe Ryan', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/057-Kris Wu - Deserve ft. Travis Scott.mp3'},
      {'icon': iconImage, 'title': '049-Ed Sheeran - Thinking Out Loud', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/007-Alan Walker - Faded.mp3'},
      {'icon': iconImage, 'title': '050-Bruno Mars - Just The Way You Are', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/097-Everybody Knows - Sigrid - From Justice League Original Motion Picture Soundtrack.mp3'},
      {'icon': iconImage, 'title': '051-Alan Walker - Sing Me To Sleep', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/051-Alan Walker - Sing Me To Sleep.mp3'},
      {'icon': iconImage, 'title': '052-Martin Garrix & Dua Lipa - Scared To Be Lonely', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/086-James Arthur - Say You Won\'t Let Go.mp3'},
      {'icon': iconImage, 'title': '053-Jonas Blue - Mama ft. William Singe', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/025-Zedd, Alessia Cara - Stay.mp3'},
      {'icon': iconImage, 'title': '054-Charlie Puth - One Call Away', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/008-The Chainsmokers - Closer ft. Halsey.mp3'},
      {'icon': iconImage, 'title': '055-David Guetta & Afrojack - Dirty Sexy Money feat. Charli XCX & French Montana', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/062-Ellie Goulding - Love Me Like You Do _ Drum Cover _ Ronald Frist.mp3'},
      {'icon': iconImage, 'title': '056-Martin Garrix & Bebe Rexha - In The Name Of Love', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/020-Charlie Puth - Attention.mp3'},
      {'icon': iconImage, 'title': '057-Kris Wu - Deserve ft. Travis Scott', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/078-Sia - Chandelier.mp3'},
      {'icon': iconImage, 'title': '058-Justin Bieber - Sorry', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/045-David Guetta ft Justin Bieber - 2U.mp3'},
      {'icon': iconImage, 'title': '059-Gryffin - Nobody Compares To You (ft. Katie Pearlman)', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/092-Imagine Dragons - Believer.mp3'},
      {'icon': iconImage, 'title': '060-Justin Bieber & BloodPop® - Friends', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/055-David Guetta & Afrojack - Dirty Sexy Money feat. Charli XCX & French Montana.mp3'},
      {'icon': iconImage, 'title': '061-Shawn Mendes - There\'s Nothing Holdin\' Me Back', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/088-Carly Rae Jepsen - I Really Like You.mp3'},
      {'icon': iconImage, 'title': '062-Ellie Goulding - Love Me Like You Do _ Drum Cover _ Ronald Frist', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/026-ZAYN - Dusk Till Dawn ft. Sia.mp3'},
      {'icon': iconImage, 'title': '063-Fifth Harmony - Work from Home ft. Ty Dolla $ign', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/065-Mike Posner - I Took A Pill In Ibiza (Seeb Remix).mp3'},
      {'icon': iconImage, 'title': '064-Lady Gaga - The Cure', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/077-MØ - When I Was Young.mp3'},
      {'icon': iconImage, 'title': '065-Mike Posner - I Took A Pill In Ibiza (Seeb Remix)', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/093-獅子合唱團 - It\'s My Life.mp3'},
      {'icon': iconImage, 'title': '066-Louis Tomlinson - Back to You ft. Bebe Rexha, Digital Farm Animals', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/004-The Chainsmokers & Coldplay - Something Just Like This.mp3'},
      {'icon': iconImage, 'title': '067-Jason Mraz - I\'m Yours', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/039-DJ Snake - A Different Way ft. Lauv.mp3'},
      {'icon': iconImage, 'title': '068-Maroon 5 - Payphone ft. Wiz Khalifa', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/060-Justin Bieber & BloodPop® - Friends.mp3'},
      {'icon': iconImage, 'title': '069-Kelly Clarkson - Love So Soft (Mark Knight & Ben Remember Remix)', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/022-Maroon 5 - What Lovers Do ft. SZA.mp3'},
      {'icon': iconImage, 'title': '070-JUSTIN TIMBERLAKE - CAN\'T STOP THE FEELING', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/044-Taylor Swift - Ready For It.mp3'},
      {'icon': iconImage, 'title': '071-Justin Bieber - What Do You Mean', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/001-Alan Walker - All Falls Down (feat. Noah Cyrus with Digital Farm Animals).mp3'},
      {'icon': iconImage, 'title': '072-Avicii - Lonely Together “Audio” ft. Rita Ora', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/084-Major Lazer - Cold Water (feat. Justin Bieber & MØ).mp3'},
      {'icon': iconImage, 'title': '073-Fifth Harmony - Worth It ft. Kid Ink', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/043-Clean Bandit - Rockabye ft. Sean Paul & Anne-Marie.mp3'},
      {'icon': iconImage, 'title': '074-Maroon 5 - Maps', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/023-Alan Walker - Alone.mp3'},
      {'icon': iconImage, 'title': '075-Lukas Graham - 7 Years', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/095-Craig David - Heartline.mp3'},
      {'icon': iconImage, 'title': '076-Jessie J - Flashlight (from Pitch Perfect 2)', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/050-Bruno Mars - Just The Way You Are.mp3'},
      {'icon': iconImage, 'title': '077-MØ - When I Was Young', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/034-王詩安 Diana Wang - HOME.mp3'},
      {'icon': iconImage, 'title': '078-Sia - Chandelier', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/080-Cheat Codes - Feels Great ft. Fetty Wap.mp3'},
      {'icon': iconImage, 'title': '079-Calvin Harris - Outside ft. Ellie Goulding', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/016-CHARLIE PUTH - We Don\'t Talk Anymore.mp3'},
      {'icon': iconImage, 'title': '080-Cheat Codes - Feels Great ft. Fetty Wap', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/054-Charlie Puth - One Call Away.mp3'},
      {'icon': iconImage, 'title': '081-Adele - Rolling in the Deep', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/082-Adele - Hello.mp3'},
      {'icon': iconImage, 'title': '082-Adele - Hello', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/013-Henry - It\'s You.mp3'},
      {'icon': iconImage, 'title': '083-The Chainsmokers & Coldplay - Something Just Like This', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/005-Luis Fonsi, Daddy Yankee - Despacito (Remix Audio) ft. Justin Bieber.mp3'},
      {'icon': iconImage, 'title': '084-Major Lazer - Cold Water (feat. Justin Bieber & MØ)', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/041-Bruno Mars - That_ What I Like.mp3'},
      {'icon': iconImage, 'title': '085-Liam Payne - Strip That Down ft. Quavo', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/098-Niall Horan - On The Loose.mp3'},
      {'icon': iconImage, 'title': '086-James Arthur - Say You Won\'t Let Go', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/003-Ed Sheeran - Shape of You.mp3'},
      {'icon': iconImage, 'title': '087-Sia - Cheap Thrills (Performance Edit)', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/002-Selena Gomez, Marshmello - Wolves (Visualizer).mp3'},
      {'icon': iconImage, 'title': '088-Carly Rae Jepsen - I Really Like You', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/009-Taylor Swift - Look What You Made Me Do.mp3'},
      {'icon': iconImage, 'title': '089-Maroon 5 - Animals', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/030-Alan Walker ft. Gavin James - Tired.mp3'},
      {'icon': iconImage, 'title': '090-Avicii - Without You “Audio” ft. Sandro Cavazza', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/006-Charlie Puth - How Long.mp3'},
      {'icon': iconImage, 'title': '091-Zedd - Beautiful Now ft. Jon Bellion', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/071-Justin Bieber - What Do You Mean.mp3'},
      {'icon': iconImage, 'title': '092-Imagine Dragons - Believer', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/094-Sam Smith - Burning (Live From The Hackney Round Chapel).mp3'},
      {'icon': iconImage, 'title': '093-獅子合唱團 - It\'s My Life', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/032-Linkin Park - One More Light (Steve Aoki Chester Forever Remix).mp3'},
      {'icon': iconImage, 'title': '094-Sam Smith - Burning (Live From The Hackney Round Chapel)', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/059-Gryffin - Nobody Compares To You (ft. Katie Pearlman).mp3'},
      {'icon': iconImage, 'title': '095-Craig David - Heartline', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/075-Lukas Graham - 7 Years.mp3'},
      {'icon': iconImage, 'title': '096-Rita Ora - Anywhere', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/033-Kygo - Stranger Things ft. OneRepublic.mp3'},
      {'icon': iconImage, 'title': '097-Everybody Knows - Sigrid - From Justice League Original Motion Picture Soundtrack', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/035-Daniel Powter - Bad Day.mp3'},
      {'icon': iconImage, 'title': '098-Niall Horan - On The Loose', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/067-Jason Mraz - I\'m Yours.mp3'},
      {'icon': iconImage, 'title': '099-Alesso & Anitta - Is That For Me', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/083-The Chainsmokers & Coldplay - Something Just Like This.mp3'},
      {'icon': iconImage, 'title': '100-Ed Sheeran - Shape of You', 'file': 'music/KKBOX十一月份西洋單曲排行榜TOP100/096-Rita Ora - Anywhere.mp3'}
    ]});   
  }
}

