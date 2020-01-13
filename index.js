// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

// Routing
app.use(express.static('public'));

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

app.get("/*", function(request, response) {
  console.log("Sending site index");
  response.sendFile(__dirname + "/views/index.html");
});

// Chatroom

var totalUsers = 0;

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    socket.in(data.room).broadcast.emit('new message', {
      username: socket.username,
      message: data.msg
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (data) {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = data.username;
    socket.room = data.room;
    ++totalUsers;
    addedUser = true;
    socket.join(data.room);
    socket.emit('login', {
      "numUsers": io.sockets.adapter.rooms[data.room].length,
    });

    // echo globally (all clients) that a person has connected
    socket.in(data.room).broadcast.emit('user joined', {
      username: socket.username,
      numUsers: io.sockets.adapter.rooms[data.room].length
    });
    io.emit('total online', {
      totalUsers: totalUsers
    });
  });

  socket.on('started typing', function (data) {
    socket.in(data.room).broadcast.emit('started typing', socket.username);
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function (data) {
    socket.in(data.room).broadcast.emit('typing', {
      username: socket.username,
      message: data.msg
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function (room) {
    socket.in(room).broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function (room) {
    if (addedUser) {
      --totalUsers;
      socket.leave(socket.room);
      console.log(`room: ${socket.room}`);
      if (io.sockets.adapter.rooms[socket.room])
      {
        // echo globally that this client has left
        socket.in(socket.room).broadcast.emit('user left', {
          username: socket.username,
          numUsers: io.sockets.adapter.rooms[socket.room].length
        });
      }
      io.emit('total online', {
        totalUsers: totalUsers
      });
    }
  });
});