import { clearAll } from '../data-providers/dexie'
import { never } from '../util'
import { EM_TOKEN, INITIAL_SETTINGS } from '../constants'
import { ActionCreator } from '../types'

/** Logs the user out of Firebase and clears the state. */
const logout = (): ActionCreator => dispatch => {

  // sign out first to prevent updates to remote
  window.firebase.auth().signOut()

  // clear local db
  clearAll().catch(err => {
    throw new Error(err)
  })

  // clear autologin
  localStorage.autologin = false

  // clear state variables
  dispatch({ type: 'clear' })

  // reset initial settings
  dispatch({
    type: 'importText',
    path: [{ value: EM_TOKEN, rank: 0 }],
    text: INITIAL_SETTINGS,
    lastUpdated: never(),
    preventSetCursor: true,
  })

  // scroll to top
  window.scrollTo(0, 0)
}

export default logout
