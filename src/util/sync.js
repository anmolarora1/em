/* eslint-disable fp/no-mutating-methods */
import { store } from '../store.js'
import {
  RENDER_DELAY,
} from '../constants.js'

// util
import { timestamp } from './timestamp.js'
import { syncRemote } from './syncRemote.js'
import { updateThoughtIndex } from '../action-creators/updateThoughtIndex'
import { updateThought, deleteThought, updateLastUpdated, updateContext, deleteContext, updateRecentlyEdited, updateSchemaVersion } from '../db'

/** Saves thoughtIndex to state, localStorage, and Firebase. */
// assume timestamp has already been updated on thoughtIndexUpdates
export const sync = (thoughtIndexUpdates = {}, contextIndexUpdates = {}, { local = true, remote = true, state = true, forceRender, updates, callback, recentlyEdited } = {}) => {

  const lastUpdated = timestamp()
  // state
  // NOTE: state here is a boolean value indicating whether to sync to state
  if (state) {
    store.dispatch(updateThoughtIndex({ thoughtIndexUpdates, contextIndexUpdates, forceRender }))
  }

  // localStorage
  const localPromises = local ? (() => {
    // thoughtIndex

    const thoughtIndexPromises = [
      ...Object.keys(thoughtIndexUpdates).map(key => thoughtIndexUpdates[key] != null
        ? updateThought(key, thoughtIndexUpdates[key])
        : deleteThought(key)),
      updateLastUpdated(lastUpdated)
    ]

    // contextIndex
    const contextIndexPromises = [
      ...Object.keys(contextIndexUpdates).map(contextEncoded => {
        const children = contextIndexUpdates[contextEncoded]
        return (children && children.length > 0
          ? updateContext(contextEncoded, children)
          : deleteContext(contextEncoded))
      }),
      updateLastUpdated(lastUpdated)
    ]

    // recentlyEdited
    const recentlyEditedPromise = recentlyEdited
      ? updateRecentlyEdited(recentlyEdited)
      : null

    // schemaVersion
    const schemaVersionPromise = updates && updates.schemaVersion
      ? updateSchemaVersion(updates.schemaVersion)
      : null

    return [...thoughtIndexPromises, ...contextIndexPromises, recentlyEditedPromise, schemaVersionPromise]
  })()
    : []

  return Promise.all(localPromises).then(() => {
    // firebase
    if (remote) {
      return syncRemote(thoughtIndexUpdates, contextIndexUpdates, recentlyEdited, updates, callback)
    }
    else {
      // do not let callback outrace re-render
      if (callback) {
        setTimeout(callback, RENDER_DELAY)
      }
      return Promise.resolve()
    }
  })

}
