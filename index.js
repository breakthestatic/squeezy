/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk-core')
const {DynamoDbPersistenceAdapter} = require('ask-sdk-dynamodb-persistence-adapter')
const SqueezeboxServer = require('./SqueezeboxServer')

const skillName = 'Squeezy'
const server = new SqueezeboxServer({
  host: process.env.HOST,
  port: process.env.PORT,
  user: process.env.USER,
  password: process.env.PASSWORD,
})

function getPersistenceAdapter(tableName) {
  return new DynamoDbPersistenceAdapter({tableName, createTable: true})
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest'
  },
  handle(handlerInput) {
    const speechText = `Welcome to the ${skillName} skill!`

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard(skillName, speechText)
      .getResponse()
  },
}

const PlayMusicIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'PlayMusicIntent' &&
      handlerInput.requestEnvelope.request.dialogState === 'STARTED'
    )
  },
  async handle(handlerInput) {
    const {
      attributesManager,
      responseBuilder,
      requestEnvelope: {request},
    } = handlerInput
    const currentIntent = request.intent
    const playerName = currentIntent.slots.player.value
    const {currentPlayer} = (await attributesManager.getPersistentAttributes()) || {}

    if (!playerName) {
      currentIntent.slots.player.value = currentPlayer ? currentPlayer.name : undefined
    }

    // Return the Dialog.Delegate directive
    return responseBuilder.addDelegateDirective(currentIntent).getResponse()
  },
}

const InProgressPlayMusicIntentHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request
    return (
      request.type === 'IntentRequest' &&
      request.intent.name === 'PlayMusicIntent' &&
      request.dialogState === 'IN_PROGRESS'
    )
  },
  handle(handlerInput) {
    const currentIntent = handlerInput.requestEnvelope.request.intent
    return handlerInput.responseBuilder.addDelegateDirective(currentIntent).getResponse()
  },
}

const CompletedPlayMusicIntentHandler = {
  canHandle: ({
    requestEnvelope: {
      request: {dialogState, type, intent},
    },
  }) => type === 'IntentRequest' && intent.name === 'PlayMusicIntent' && dialogState === 'COMPLETED',
  handle: async ({attributesManager, responseBuilder, requestEnvelope}) => {
    const {currentPlayer} = (await attributesManager.getPersistentAttributes()) || {}
    let requestedPlayerName = requestEnvelope.request.intent.slots.player.value
    let targetPlayer = currentPlayer

    if (!(targetPlayer && targetPlayer.name === requestedPlayerName)) {
      targetPlayer = await server.getPlayerByName(requestedPlayerName)
      attributesManager.setPersistentAttributes({currentPlayer: targetPlayer})
      await attributesManager.savePersistentAttributes()
    }

    server.play(targetPlayer)

    const speechText = `Sure, playing some music in the ${requestedPlayerName}`

    return responseBuilder
      .speak(speechText)
      .withSimpleCard(skillName, speechText)
      .getResponse()
  },
}

const StopMusicIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'StopMusicIntent'
    )
  },
  async handle({attributesManager, responseBuilder}) {
    const speechText = 'Sure, stopping playback.'
    server.stop()

    attributesManager.setPersistentAttributes({currentPlayer: {}})
    attributesManager.savePersistentAttributes()

    return responseBuilder
      .speak(speechText)
      .withSimpleCard(skillName, speechText)
      .getResponse()
  },
}

const PlayArtistIntentHandler = {
  canHandle: ({requestEnvelope: {request}}) =>
    request.type === 'IntentRequest' && request.intent.name === 'PlayArtistIntent' && request.dialogState === 'STARTED',
  async handle(handlerInput) {
    const {
      attributesManager,
      responseBuilder,
      requestEnvelope: {request},
    } = handlerInput
    const currentIntent = request.intent
    const playerName = currentIntent.slots.player.value
    const {currentPlayer} = (await attributesManager.getPersistentAttributes()) || {}

    if (!playerName) {
      currentIntent.slots.player.value = currentPlayer ? currentPlayer.name : undefined
    }

    // Return the Dialog.Delegate directive
    return responseBuilder.addDelegateDirective(currentIntent).getResponse()
  },
}

const InProgressPlayArtistIntentHandler = {
  canHandle: ({requestEnvelope: {request}}) =>
    request.type === 'IntentRequest' &&
    request.intent.name === 'PlayArtistIntent' &&
    request.dialogState === 'IN_PROGRESS',
  handle(handlerInput) {
    const currentIntent = handlerInput.requestEnvelope.request.intent
    return handlerInput.responseBuilder.addDelegateDirective(currentIntent).getResponse()
  },
}

const CompletedPlayArtistIntentHandler = {
  canHandle: ({requestEnvelope: {request}}) =>
    request.type === 'IntentRequest' &&
    request.intent.name === 'PlayArtistIntent' &&
    request.dialogState === 'COMPLETED',
  handle: async ({attributesManager, responseBuilder, requestEnvelope}) => {
    const {currentPlayer} = (await attributesManager.getPersistentAttributes()) || {}
    const requestedPlayerName = requestEnvelope.request.intent.slots.player.value
    const artist = requestEnvelope.request.intent.slots.artist.value
    let targetPlayer = currentPlayer

    if (!(targetPlayer && targetPlayer.name === requestedPlayerName)) {
      targetPlayer = await server.getPlayerByName(requestedPlayerName)
      attributesManager.setPersistentAttributes({currentPlayer: targetPlayer})
      await attributesManager.savePersistentAttributes()
    }

    server.playArtist(targetPlayer, artist)

    const speechText = `Sure, playing ${artist} in the ${requestedPlayerName}`

    return responseBuilder
      .speak(speechText)
      .withSimpleCard(skillName, speechText)
      .getResponse()
  },
}

const VolumeUpIntentHandler = {
  canHandle: ({requestEnvelope: {request}}) =>
    request.type === 'IntentRequest' && request.intent.name === 'VolumeUpIntent',
  handle: async ({attributesManager, requestEnvelope, responseBuilder}) => {
    const {currentPlayer} = (await attributesManager.getPersistentAttributes()) || {}

    if (currentPlayer) {
      server.volumeUp(currentPlayer, requestEnvelope.request.intent.slots.volumeDelta.value)
    }

    const speechText = 'Sure.'

    return responseBuilder
      .speak(speechText)
      .withSimpleCard(skillName, speechText)
      .getResponse()
  },
}

const VolumeDownIntentHandler = {
  canHandle: ({requestEnvelope: {request}}) =>
    request.type === 'IntentRequest' && request.intent.name === 'VolumeDownIntent',
  handle: async ({attributesManager, requestEnvelope, responseBuilder}) => {
    const {currentPlayer} = (await attributesManager.getPersistentAttributes()) || {}

    if (currentPlayer) {
      server.volumeDown(currentPlayer, requestEnvelope.request.intent.slots.volumeDelta.value)
    }

    const speechText = 'Sure.'

    return responseBuilder
      .speak(speechText)
      .withSimpleCard(skillName, speechText)
      .getResponse()
  },
}

const MuteIntentHandler = {
  canHandle: ({requestEnvelope: {request}}) => request.type === 'IntentRequest' && request.intent.name === 'MuteIntent',
  handle: async ({attributesManager, requestEnvelope, responseBuilder}) => {
    const {currentPlayer} = (await attributesManager.getPersistentAttributes()) || {}

    if (currentPlayer) {
      server.mute(currentPlayer)
    }

    const speechText = 'Sure.'

    return responseBuilder
      .speak(speechText)
      .withSimpleCard(skillName, speechText)
      .getResponse()
  },
}

const UnmuteIntentHandler = {
  canHandle: ({requestEnvelope: {request}}) =>
    request.type === 'IntentRequest' && request.intent.name === 'UnmuteIntent',
  handle: async ({attributesManager, requestEnvelope, responseBuilder}) => {
    const {currentPlayer} = (await attributesManager.getPersistentAttributes()) || {}

    if (currentPlayer) {
      server.unmute(currentPlayer)
    }

    const speechText = 'Sure.'

    return responseBuilder
      .speak(speechText)
      .withSimpleCard(skillName, speechText)
      .getResponse()
  },
}

const SetActivePlayerIntentHandler = {
  canHandle: ({requestEnvelope: {request}}) =>
    request.type === 'IntentRequest' && request.intent.name === 'SetActivePlayerIntent',
  handle: async ({attributesManager, requestEnvelope, responseBuilder}) => {
    const targetPlayer = await server.getPlayerByName(requestEnvelope.request.intent.slots.player.value)
    attributesManager.setPersistentAttributes({currentPlayer: targetPlayer})
    await attributesManager.savePersistentAttributes()
    const speechText = `Sure, setting ${targetPlayer.name} as the active player.`

    return responseBuilder
      .speak(speechText)
      .withSimpleCard(skillName, speechText)
      .getResponse()
  },
}

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent'
    )
  },
  handle(handlerInput) {
    const speechText = 'You can say hello to me!'

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('Hello World', speechText)
      .getResponse()
  },
}

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent' ||
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent')
    )
  },
  handle(handlerInput) {
    const speechText = 'Goodbye!'

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Hello World', speechText)
      .getResponse()
  },
}

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest'
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`)

    return handlerInput.responseBuilder.getResponse()
  },
}

const ErrorHandler = {
  canHandle() {
    return true
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`)

    return handlerInput.responseBuilder
      .speak("Sorry, I can't understand the command. Please say again.")
      .reprompt("Sorry, I can't understand the command. Please say again.")
      .getResponse()
  },
}

const skillBuilder = Alexa.SkillBuilders.custom()

exports.handler = skillBuilder
  .withPersistenceAdapter(getPersistenceAdapter('squeezy'))
  .addRequestHandlers(
    LaunchRequestHandler,
    PlayMusicIntentHandler,
    InProgressPlayMusicIntentHandler,
    CompletedPlayMusicIntentHandler,
    PlayArtistIntentHandler,
    InProgressPlayArtistIntentHandler,
    CompletedPlayArtistIntentHandler,
    StopMusicIntentHandler,
    VolumeUpIntentHandler,
    VolumeDownIntentHandler,
    MuteIntentHandler,
    UnmuteIntentHandler,
    SetActivePlayerIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda()
