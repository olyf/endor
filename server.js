var express = require('express'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    Fitbit = require('fitbit'),
    config = require('./config.js'),
    async = require('async'),
    app = express();

app.set('port', process.env.PORT || config.PORT);
app.use(cookieParser());



app.listen(app.get('port'), function() {
	console.log('Application up and running on port ' + app.get('port'));
});



app.use(cookieParser());
app.use(session({secret: config.SESSION_SECRET}));

// OAuth flow
app.get('/login', function (req, res) {
    // Create an API client and start authentication via OAuth
    var client = new Fitbit(config.CONSUMER_KEY, config.CONSUMER_SECRET);

    client.getRequestToken(function (err, token, tokenSecret) {
        if (err) {
            // Take action
            return;
        }

        req.session.oauth = {
            requestToken: token
            , requestTokenSecret: tokenSecret
        };
        res.redirect(client.authorizeUrl(token));
    });
});

// On return from the authorization
app.get('/oauth_callback', function (req, res) {
    var verifier = req.query.oauth_verifier,
        oauthSettings = req.session.oauth,
        client = new Fitbit(config.CONSUMER_KEY, config.CONSUMER_SECRET);

    // Request an access token
    client.getAccessToken(
        oauthSettings.requestToken
        , oauthSettings.requestTokenSecret
        , verifier
        , function (err, token, secret) {
            if (err) {
                // Take action
                return;
            }

            oauthSettings.accessToken = token;
            oauthSettings.accessTokenSecret = secret;
            console.log('Token: ', token, ' & secret: ', secret);

            res.redirect('/stats');
        }
    );
});

// Display some stats
app.get('/', function (req, res) {
    var id = req.query.id;

    client = new Fitbit(
        config.CONSUMER_KEY
        , config.CONSUMER_SECRET
        , { // Now set with access tokens
            accessToken: config.USERS[id].TOKEN,
            accessTokenSecret: config.USERS[id].TOKEN_SECRET,
            unitMeasure: 'en_GB'
        }
    );
    // Fetch todays activities

    async.parallel([
        function(callback) {
            client.getSleep(function (err, sleep) {
                if (err) {
                    console.log("This is err:" ,err);
                    callback("something bad happened", null);
                }
                data = {sleep: sleep.minutesAsleep()};
                callback(null, sleep.minutesAsleep());
            })
        },
        function(callback) {
            client.getActivities(function (err, activities) {
                if (err) {
                    // Take action
                    console.log("The err is: ", err);
                    callback("something bad happened", null);
                }
                callback(null, {
                    steps: activities.steps(),
                    floors: activities.floors(),
                    activeScore: activities.activeScore(),
                    distance: activities.totalDistance()
                });
            })
        }], function(err, record) {
            console.log(err);
            record[1].sleep = record[0];
            res.setHeader('Content-Type', 'application/json');
            res.json(record[1]);
        }
    );
});