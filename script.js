PouchDB.debug.enable('*');

var current_mission;

function show_mission(mission_doc) {

  console.log("new mission to display!", mission_doc, "current is", current_mission);

  if (current_mission && current_mission._id && mission_doc._id === current_mission._id) {
    return 
  }

  current_mission = mission_doc;

  $("#inner").typed('reset');
  $("#inner").typed({
    showCursor: false,
    strings: [mission_doc.html] || ["[Communication failure]"],
    typeSpeed: 0
  });
}

function close_mission() {
  current_mission.status = 'closed';
  localDB.get(current_mission._id).then(function(doc) {
    console.log("Closing mission");
    doc.status = "closed";
    localDB.put(doc).then(function() {
      console.log("Closed mission", doc);
    });
  })
}

var season_name = 'preseason8';

var localDB = new PouchDB(season_name);

var remoteDB;
if (window.location.hostname === "localhost") {
  remoteDB = new PouchDB('http://localhost:5984/' + season_name + '/');
} else {
  remoteDB = new PouchDB('https://yarping.iriscouch.com/' + season_name + '/');
}

localDB.sync(remoteDB, {
  live: true,
  retry: true,
}).on('change', function (change) {
  console.log('something changed!', change);
  on_dbchange();
}).on('paused', function (info) {
  console.log('info!', info);
  on_dbchange();
}).on('active', function (info) {
  console.log('active', info);
  on_dbchange();
}).on('error', function (err) {
  console.error(err);
  alert('There was an error communicating with headquarters.')
});

function i_am_ready() {
  close_mission(current_mission);
  $("button").css({'visibility': 'none'});
  localDB.post({
    'type': 'mission',
    'status': 'open',
    'created': (new Date).getTime(),
    'user': window.localStorage.username,
    'identifier': 'showfind_other_agent_undecided',
    'html': "<p>Good choice, " + window.localStorage.username +
            ".^1000 <p>This screen will update with your first mission soon."
  });
}


function do_missions() {

  localDB.query(function (doc, emit) {
    if (doc.type === "mission" && doc.status === "open" && doc.user === window.localStorage.username) {
      emit(doc._id, doc.created);
    }
  }, {
    include_docs : true,
  }).then(function (result) {


    if (result.total_rows == 0) {
      console.log('Did not find any missions, creating the first.', result)

      window.localStorage.username = window.localStorage.username || ('agent' + (Math.floor((1000+Math.random()*1000)) - 1000));

      localDB.post({
        'type': 'mission',
        'status': 'open',
        'created': (new Date).getTime(),
        'user': window.localStorage.username,
        'html': (
          "<p>Welcome " +
          window.localStorage.username +
          ". <p>Are you ready for your first mission ? <br>" +
          "<button class=next onclick='javascript:i_am_ready(); return true;'>Yes, ready.</button>"
        )
      });
    } else {
      console.log('FOUND A MISSION');
      console.log(result.rows);
      show_mission(result.rows[0].doc);
    }
  }).catch(function (err) {
    console.error(err);
  });
};

var rendered;

function show_matches() {

  if (rendered) {
      return;
  }
  rendered = true;

  $("#inner").html("<h1>Yarping admin: Open missions</h1>");
  $("#inner").addClass("admin");

  localDB.query(function (doc, emit) {
    if (doc.type === "mission" && doc.status === "open") {
      emit(doc.created);
    }
  }, {
    include_docs : true,
    descending: true,
  }).then(function (result) {
    console.log("open missions", result)

    $(result.rows).each(function(index, entry) {

        var options = [
            "<option>not specified</option>"
        ];
        $(['red', 'blue', 'green']).map(function(i, color) {
            $(['find', 'show']).map(function(j, role) {
                var name = role + "_other_agent_" + color;
                console.log(name, entry.doc.identifier);
                var is_selected = ""
                if (name === entry.doc.identifier) {
                  is_selected = "selected=selected"
                }
                options.push("<option " + is_selected + " name='" + name + "' value='" + name + "'>" + name + "</option>");
            })
        })

        var select = "<select data-id='" + entry.doc._id + "'>" + options + "</select>";

        $("#inner").append("<p>" + entry.doc.user + ": " + select);

        $("#inner select").on("change", function(event) {
            var new_val = $(event.target).val();
            localDB.get($(event.target).data('id')).then(function(doc) {

              doc.status = "closed";
              localDB.put(doc).then(function() {
                console.log("Closed mission", doc);

                console.log("Assinging " + new_val);

                var newmission = {
                  'type': 'mission',
                  'status': 'open',
                  'created': (new Date).getTime(),
                  'user': doc.user,
                  'identifier': new_val,
                };

                var mission_info = new_val.split("_");
                var color = mission_info[3];
                var role = mission_info[0];

                console.log(entry.doc);

                if (role == "show") {
                  newmission.html = (
                    "Here is your first mission:" +
                    "<p>Keep your phone's screen visible. ^500" +
                    "You will be contacted. ^2000" +
                    " <div style='position: absolute; top: 0; left: 0; height: 100%; width:100%; background-color: " +
                    color +
                    "'></div>"
                  )
                } else {
                  newmission.html = (
                    "<p>Here is your first mission:^1000 Find the other agent with a <font color=" +
                    color +
                    ">" +
                    color +
                    "</font> screen."
                  )
                }

                localDB.post(newmission).then(function() {
                  console.log("Created mission", newmission);
                });

              });


            })
        })
    })

  }).catch(function (err) {
    console.error(err);
  });

  

}


var on_dbchange;

if (window.location.hash == "#admin") {
  on_dbchange = show_matches;


} else {
  // regular user then
  show_mission({
    html: "<br><span class='hexdots-loader'></span><p><br><br>Contacting headquarters ... "
  });
  on_dbchange = do_missions;
}

