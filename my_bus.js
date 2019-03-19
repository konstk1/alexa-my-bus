'use strict';

const https = require('https');

const stopId = 12649;
const route = 87;
const mbtaHost = 'api-v3.mbta.com';
const predictionsByStopPath = `/predictions?filter[stop]=${stopId}&filter[route]=${route}&sort=arrival_time&include=vehicle`

console.log("My Bus...");
testBus();

function testBus() {
    var intent = {name: 'Test Bus'};

    var callback = function(attributes, response) {
        console.log(response.outputSpeech.text);
    }

    getNextBus(intent, null, callback);
}

async function getJson(host, path) {
    var options = {
        host,
        path,
    };

    console.log("URL: " + options.host + options.path);

    return new Promise((resolve, reject) => {
        const req = https.request(options, (response) => {
            // Continuously update stream with data
            var body = '';
            response.on('data', function (d) {
                body += d;
            });
            response.on('end', function () {
                // Data reception is done, do whatever with it!
                var parsed = JSON.parse(body);
                resolve(parsed);
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: 'PlainText',
            text: output,
        },
        card: {
            type: 'Simple',
            title: `My Bus - ${title}`,
            content: `My Bus - ${output}`,
        },
        reprompt: {
            outputSpeech: {
                type: 'PlainText',
                text: repromptText,
            },
        },
        shouldEndSession,
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: '1.0',
        sessionAttributes,
        response: speechletResponse,
    };
}


// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    const sessionAttributes = {};
    const cardTitle = 'Welcome';
    const speechOutput = 'Next bus or time for schedule?';
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    const repromptText = 'Say next bus or time for schedule';
    const shouldEndSession = false;

    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function handleSessionEndRequest(callback) {
    const cardTitle = 'Session Ended';
    const speechOutput = 'Have a nice day!';
    // Setting this to true ends the session and exits the skill.
    const shouldEndSession = true;

    callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}

async function getNextBus(intent, session, callback) {
    const repromptText = null;
    const sessionAttributes = {};
    let shouldEndSession = true;
    let speechOutput = 'Next bus is in x minutes.';

    const json = await getJson(mbtaHost, predictionsByStopPath);

    let predictions = new Array();

    // console.log('json :', json);

    json.data.forEach(prediction => {
        const arrivalTime = new Date(prediction.attributes.arrival_time);

        predictions.push({
            tripId: prediction.relationships.trip.data.id,
            routeId: prediction.relationships.route.data.id,
            arrivalTime,
            secUntilArrival: (arrivalTime - new Date()) / 1000,
        });
    });

    predictions.sort((a, b) => {
        return a.secUntilArrival - b.secUntilArrival;
    });

    console.log(predictions);

    if (predictions.length === 0) {
        speechOutput = "There is no bus in the near future.";
    } else {
        predictions.forEach((pred, idx) => {
            const mins = Math.floor(pred.secUntilArrival / 60);

            if (idx === 0) {
                speechOutput = "The next bus is in " + mins + " minutes. ";
                if (predictions.length > 1) {
                    speechOutput += "Another bus in ";
                }
            } else if (idx == (predictions.length - 1) && idx > 1) {
                speechOutput += "and " + mins + " minutes. ";
            } else {
                speechOutput += mins + " minutes, ";
            }
        });
    }

    // let numAlerts = json.alert_headers.length;
    // json.alert_headers.forEach((alert, idx) => {
    //     console.log("Alert " + idx);
    //     if (idx === 0) {
    //         speechOutput += "There " + (numAlerts > 1 ? "are " : "is ") + numAlerts + " service alert" + (numAlerts > 1 ? "s. " : ". ");
    //     }
    //     speechOutput += alert.header_text + " ";
    // });
    callback(sessionAttributes, buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
}


// --------------- Events -----------------------

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}`);

    const intent = intentRequest.intent;
    const intentName = intentRequest.intent.name;

    // Dispatch to your skill's intent handlers
    if (intentName === 'MyBusIsIntent') {
        getNextBus(intent, session, callback);
    } else if (intentName === 'GetNextBusIntent') {
        getNextBus(intent, session, callback);
    } else if (intentName === 'AMAZON.HelpIntent') {
        getWelcomeResponse(callback);
    } else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
        handleSessionEndRequest(callback);
    } else {
        throw new Error('Invalid intent');
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`);
    // Add cleanup logic here
}


// --------------- Main handler -----------------------

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = (event, context, callback) => {
    try {
        console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);

        /**
         * Uncomment this if statement and populate with your skill's application ID to
         * prevent someone else from configuring a skill that sends requests to this function.
         */
        /*
        if (event.session.application.applicationId !== 'amzn1.echo-sdk-ams.app.[unique-value-here]') {
             callback('Invalid Application ID');
        }
        */

        if (event.session.new) {
            onSessionStarted({ requestId: event.request.requestId }, event.session);
        }

        if (event.request.type === 'LaunchRequest') {
            onLaunch(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'IntentRequest') {
            onIntent(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'SessionEndedRequest') {
            onSessionEnded(event.request, event.session);
            callback();
        }
    } catch (err) {
        callback(err);
    }
};
