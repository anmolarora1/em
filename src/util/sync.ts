// @ts-nocheck

/* eslint-disable fp/no-mutating-methods */
import _ from 'lodash'
import * as db from '../data-providers/dexie'
import * as firebase from '../data-providers/firebase'
import { store } from '../store'
import { clientId } from '../browser'
import { EMPTY_TOKEN, EM_TOKEN } from '../constants'
import { getSetting } from '../selectors'
import { hashContext, isFunction, logWithTime, timestamp } from '../util'

/** Options object for sync. */
interface Options {
  local?: boolean,
  remote?: boolean,
  updates?: GenericObject<string>,
  recentlyEdited: GenericObject<any>,
}

// store the hashes of the localStorage Settings contexts for quick lookup
// settings that are propagated to localStorage for faster load on startup
// e.g. {
//   [hashContext([EM_TOKEN, 'Settings', 'Tutorial'])]: 'Tutorial',
//   ...
// }
const localStorageSettingsContexts = _.keyBy(
  ['Font Size', 'Tutorial', 'Last Updated'],
  value => hashContext([EM_TOKEN, 'Settings', value])
)

/** Syncs thought updates to the local database. */
const syncLocal = (thoughtIndexUpdates = {}, contextIndexUpdates = {}, recentlyEdited, updates = {}) => {

  // thoughtIndex
  const thoughtIndexPromises = [
    ...Object.entries(thoughtIndexUpdates).map(([key, thought]) => {
      if (thought != null) {
        return db.updateThought(key, thought)
      }
      return db.deleteThought(key)
    }),
    db.updateLastUpdated(timestamp())
  ]

  logWithTime('sync: thoughtIndexPromises generated')

  // contextIndex
  const contextIndexPromises = [
    ...Object.keys(contextIndexUpdates).map(contextEncoded => {
      const contextIndexEntry = contextIndexUpdates[contextEncoded] || {}

      // some settings are propagated to localStorage for faster load on startup
      const name = localStorageSettingsContexts[contextEncoded]
      if (name) {
        const firstChild = contextIndexEntry.children && contextIndexEntry.children.find(child => !isFunction(child.value))
        if (firstChild) {
          localStorage.setItem(`Settings/${name}`, firstChild.value)
        }
      }

      return contextIndexEntry.children && contextIndexEntry.children.length > 0
        ? db.updateContext(contextEncoded, contextIndexEntry)
        : db.deleteContext(contextEncoded)
    }),
    db.updateLastUpdated(timestamp())
  ]

  logWithTime('sync: contextIndexPromises generated')

  // recentlyEdited
  const recentlyEditedPromise = recentlyEdited
    ? db.updateRecentlyEdited(recentlyEdited)
    : null

  // schemaVersion
  const schemaVersionPromise = updates && updates.schemaVersion
    ? db.updateSchemaVersion(updates.schemaVersion)
    : null

  logWithTime('sync: localPromises generated')

  return Promise.all([
    ...thoughtIndexPromises,
    ...contextIndexPromises,
    recentlyEditedPromise,
    schemaVersionPromise,
  ])
}

/** Prepends thoughtIndex and contextIndex keys for syncing to Firebase. */
const syncRemote = async (thoughtIndexUpdates = {}, contextIndexUpdates = {}, recentlyEdited, updates = {}) => {

  const state = store.getState()

  const hasUpdates =
    Object.keys(thoughtIndexUpdates).length > 0 ||
    Object.keys(contextIndexUpdates).length > 0 ||
    Object.keys(updates).length > 0

  // prepend thoughtIndex/ and encode key
  const prependedDataUpdates = _.transform(thoughtIndexUpdates, (accum, thought, key) => {
    if (!key) {
      console.error('Unescaped empty key', thought, new Error())
      return
    }

    // fix undefined/NaN rank
    accum['thoughtIndex/' + (key || EMPTY_TOKEN)] = thought && getSetting(state, 'Data Integrity Check') === 'On'
      ? {
        lastUpdated: thought.lastUpdated || timestamp(),
        value: thought.value,
        contexts: thought.contexts.map(cx => ({
          context: cx.context || null, // guard against NaN or undefined
          rank: cx.rank || 0, // guard against NaN or undefined
          ...cx.lastUpdated ? {
            lastUpdated: cx.lastUpdated
          } : null
        }))
      }
      : thought
  }, {})

  logWithTime('syncRemote: prepend thoughtIndex key')

  const dataIntegrityCheck = getSetting(state, 'Data Integrity Check') === 'On'
  const prependedcontextIndexUpdates = _.transform(contextIndexUpdates, (accum, contextIndexEntry, key) => {
    // fix undefined/NaN rank
    const children = contextIndexEntry && contextIndexEntry.children
    accum['contextIndex/' + key] = children && children.length > 0
      ? {
        children: dataIntegrityCheck
          ? children.map(subthought => ({
            value: subthought.value || '', // guard against NaN or undefined,
            rank: subthought.rank || 0, // guard against NaN or undefined
            ...subthought.lastUpdated ? {
              lastUpdated: subthought.lastUpdated
            } : null
          }))
          : children,
        lastUpdated: contextIndexEntry.lastUpdated || timestamp(),
      }
      : null
  }, {})

  logWithTime('syncRemote: prepend contextIndex key')

  // add updates to queue appending clientId and timestamp
  const allUpdates = {
    // encode keys for firebase
    ...hasUpdates ? {
      ...updates,
      ...prependedDataUpdates,
      ...prependedcontextIndexUpdates,
      ...recentlyEdited ? { recentlyEdited } : null,
      // do not update lastClientId and lastUpdated if there are no thoughtIndex updates (e.g. just a settings update)
      // there are some trivial settings updates that get pushed to the remote when the app loads, setting lastClientId and lastUpdated, which can cause the client to ignore thoughtIndex updates from the remote thinking it is already up-to-speed
      // TODO: A root level lastClientId/lastUpdated is an overreaching solution.
      ...Object.keys(thoughtIndexUpdates).length > 0 ? {
        lastClientId: clientId,
        lastUpdated: timestamp()
      } : null
    } : {}
  }

  logWithTime('syncRemote: allUpdates')

  if (Object.keys(allUpdates).length > 0) {
    return firebase.update(allUpdates)
      .catch((e: Error) => {
        store.dispatch({ type: 'error', value: e.message })
        console.error(e.message, allUpdates)
        throw e
      })
  }
}

/** Syncs updates to local database and Firebase. */
export const sync = (thoughtIndexUpdates = {}, contextIndexUpdates = {}, { local = true, remote = true, updates, recentlyEdited }: SyncOptions = {}) => {

  const { authenticated, userRef } = store.getState()

  return Promise.all([

    // sync local
    local && syncLocal(thoughtIndexUpdates, contextIndexUpdates, recentlyEdited, updates),

    // sync remote
    remote && authenticated && userRef && syncRemote(thoughtIndexUpdates, contextIndexUpdates, recentlyEdited, updates),
  ])

}
