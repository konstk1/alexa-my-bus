'use strict';

const Alexa = require('ask-sdk-core');
const https = require('https');

const stopId = 12649;
const route = 87;
const mbtaHost = 'api-v3.mbta.com';
const predictionsByStopPath = `/predictions?filter[stop]=${stopId}&filter[route]=${route}&sort=arrival_time&include=vehicle`

console.log("My Bus...");
testBus();

function testBus() {
  var intent = { name: 'Test Bus' };

  var callback = function (attributes, response) {
    console.log(response.outputSpeech.text);
  }

  getNextBus(intent, null, callback);
}

async function getJson(host, path) {
  var options = {
    host,
    path,
  };

  console.log("MBTA URL: " + options.host + options.path);

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

// --------------- Functions that control the skill's behavior -----------------------

async function getNextBus() {
  let speechOutput = '';

  const json = await getJson(mbtaHost, predictionsByStopPath);

  const predictions = json.data.map(prediction => {
    const arrivalTime = new Date(prediction.attributes.arrival_time);
    return {
      tripId: prediction.relationships.trip.data.id,
      routeId: prediction.relationships.route.data.id,
      arrivalTime,
      secUntilArrival: (arrivalTime - new Date()) / 1000,
    };
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
  return speechOutput;
}


// --------------- Handlers -----------------------
const CanFulfillIntentHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'CanFulfillIntentRequest';
  },
  handle(handlerInput) {
    console.log (`In CFIR, intent: ${handlerInput.requestEnvelope.request.intent.name}`);
    return handlerInput.responseBuilder
      .withCanFulfillIntent({
        canFulfill: 'YES',
      })
      .getResponse();
  },
}

const LaunchHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("Welcome to My Bus, ask for next bus")
      .reprompt("Say next bus.")
      .getResponse();
  },
};

const GetNextBusHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === 'GetNextBusIntent';
  },
  async handle(handlerInput) {
    const response = await getNextBus();
    console.log('GetNextBusHandler response:', response);
    return handlerInput.responseBuilder
      .speak(response)
      .getResponse();
  },
};

const HelpHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    return handlerInput.responseBuilder
      .speak("You can say: when is the next bus?")
      .getResponse();
  },
};

const FallbackHandler = {
  // 2018-Aug-01: AMAZON.FallbackIntent is only currently available in en-* locales.
  //              This handler will not be triggered except in those locales, so it can be
  //              safely deployed for any locale.
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && request.intent.name === 'AMAZON.FallbackIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('My Bus can\'t help you with that')
      .reprompt('My Bus can\'t help you with that')
      .getResponse();
  },
};

const ExitHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request.intent.name === 'AMAZON.CancelIntent'
        || request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Goodbye.')
      .getResponse();
  },
}

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);
    console.log(`Error stack: ${error.stack}`);
    return handlerInput.responseBuilder
      .speak('Sorry, an error occurred.')
      .reprompt('Sorry, an error occurred.')
      .getResponse();
  },
};

// --------------- Main handler -----------------------
const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    CanFulfillIntentHandler,
    LaunchHandler,
    GetNextBusHandler,
    HelpHandler,
    ExitHandler,
    FallbackHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();


// (event, context, callback) => {
//     try {
//         console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);

//         if (event.session.new) {
//             onSessionStarted({ requestId: event.request.requestId }, event.session);
//         }

//         console.log('Request type: ', event.request.type);
        
//         if (event.request.type === 'CanFulfillIntentRequest') {
//             console.log(event.request);
//             callback(null, buildResponse({}, { canFulfill: 'YES' }));

// };
