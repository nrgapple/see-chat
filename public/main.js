/* global io */

$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 2000; // ms
  var TYPING_UPDATE_INTERVAL_LENGTH = 400; //ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page
  var $header = $('#header');
  var $heading = $('.heading');
  var $users = $('#users');
  var $roomName = $('.room');

  // Prompt for setting a username
  var username;
  var connected = false;
  var typing = false;
  var startedTyping = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io();
  var isiOS = /iPhone|iPad|iPod|Opera Mini/i.test(navigator.userAgent);
  var id = -1;
  var room = "default";

  // Notifications
  if (!isiOS) {
    if (!Notification) {
      alert('Desktop notifications not available in your browser. Try Chromium.');
      return;
    }
    if (Notification.permission !== 'granted')
      Notification.requestPermission();
  }

  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.numUsers + " participants";
    }
    log(message);
  }

  // Sets the client's username
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();
      let usernameColor = getUsernameColor(username);
      let compColor = hexToComplimentary(usernameColor);
      $header.css('background', compColor);
      $heading.css('color', usernameColor);
      $inputMessage.css('border-color', compColor);
      room = getRoom();
      $roomName.text(room);
      
      // Tell the server your username
      socket.emit('add user', {"username": username, "room": room});
    }
  }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', {"msg": message, "room": room});
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = `is typing... ${data.message}`;
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!startedTyping)
      {
        startedTyping = true;
        socket.emit('started typing', {"room": room});
      }
      typing = true;
      var message = $inputMessage.val();
      // Prevent markup from being injected into the message
      message = cleanInput(message);
      socket.emit('typing', {"room": room, "msg": message});
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && $inputMessage.val() === "") {
          typing = false;
          startedTyping = false;
          socket.emit('stop typing', room);
        }
      }, TYPING_TIMER_LENGTH);
      
      //setTimeout(function () {
      //  var typingTimer = (new Date()).getTime();
      //  var timeDiff = typingTimer - lastTypingTime;
      //  if (timeDiff >= TYPING_UPDATE_INTERVAL_LENGTH && typing) {
      //    typing = false;
      //  }
      //}, TYPING_UPDATE_INTERVAL_LENGTH);
    }
  }
  
  function updateTotalOnline(data) {
    $users.text(data.totalUsers);
  }

  function getRoom () {
    room = window.location.pathname.substr(1);
    if (room === "")
    {
      room = "default"
    }
    console.log(`room: ${room}`);
    return room;
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }
  
  function hexToComplimentary(hex) {
    // Convert hex to rgb
    // Credit to Denis http://stackoverflow.com/a/36253499/4939630
    var rgb =
      "rgb(" +
      (hex = hex.replace("#", ""))
        .match(new RegExp("(.{" + hex.length / 3 + "})", "g"))
        .map(function(l) {
          return parseInt(hex.length % 2 ? l + l : l, 16);
        })
        .join(",") +
      ")";

    // Get array of RGB values
    rgb = rgb.replace(/[^\d,]/g, "").split(",");

    var r = rgb[0],
      g = rgb[1],
      b = rgb[2];

    // Convert RGB to HSL
    // Adapted from answer by 0x000f http://stackoverflow.com/a/34946092/4939630
    r /= 255.0;
    g /= 255.0;
    b /= 255.0;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var h,
      s,
      l = (max + min) / 2.0;

    if (max == min) {
      h = s = 0; //achromatic
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2.0 - max - min) : d / (max + min);

      if (max == r && g >= b) {
        h = (1.0472 * (g - b)) / d;
      } else if (max == r && g < b) {
        h = (1.0472 * (g - b)) / d + 6.2832;
      } else if (max == g) {
        h = (1.0472 * (b - r)) / d + 2.0944;
      } else if (max == b) {
        h = (1.0472 * (r - g)) / d + 4.1888;
      }
    }

    h = (h / 6.2832) * 360.0 + 0;

    // Shift hue to opposite side of wheel and convert to [0-1] value
    h += 180;
    if (h > 360) {
      h -= 360;
    }
    h /= 360;

    // Convert h s and l values into r g and b values
    // Adapted from answer by Mohsen http://stackoverflow.com/a/9493060/4939630
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      var hue2rgb = function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;

      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    r = Math.round(r * 255);
    g = Math.round(g * 255);
    b = Math.round(b * 255);

    // Convert r b and g values to hex
    rgb = b | (g << 8) | (r << 16);
    return "#" + (0x1000000 | rgb).toString(16).substring(1);
  }  
  
  function notifyMe(data) {
    if (Notification.permission !== 'granted')
     Notification.requestPermission();
    else {
     let notification = new Notification(data.title, {
      icon: data.icon,
      body: data.msg,
     });

     setTimeout(function() {notification.close(notification); console.log("timed out")}, 3000);
    }
  }

  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing', room);
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message
    var message = "Welcome to Socket.IO Chat – ";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' joined');
    addParticipantsMessage(data);
    if (!isiOS)
      notifyMe({ "title": `${data.username} joined`, "msg": "", "icon": "https://img.icons8.com/dusk/64/000000/connected--v1.png"});
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
    if (!isiOS)
      notifyMe({ "title": `${data.username} left`, "msg": "", "icon": "https://img.icons8.com/dusk/64/000000/disconnected.png"});
  });

  socket.on('started typing', function (username) {
    if (!isiOS)
      notifyMe({ "title": `${username} started typing!`, "icon": "https://img.icons8.com/flat_round/64/000000/filled-speech-bubble-with-dots.png"});
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });
  
  socket.on('total online', function (data) {
    updateTotalOnline(data);
  })
});